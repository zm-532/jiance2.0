import json
import asyncio
import logging
import httpx
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.services.table_parser import parse_html_tables
from app.models.photo import Photo

logger = logging.getLogger(__name__)

PADDLEOCR_JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
MAX_POLLS = 60
POLL_INTERVAL = 3.0


def _parse_ocr_result(jsonl_text: str) -> dict:
    lines = [l for l in jsonl_text.strip().split("\n") if l.strip()]
    pages = []
    raw_text = ""

    for line in lines:
        try:
            parsed = json.loads(line)
            results = parsed.get("result", {}).get("layoutParsingResults", [])
            for res in results:
                page_text = res.get("markdown", {}).get("text", "")
                raw_text += page_text + "\n"
                pages.append({
                    "page_number": len(pages) + 1,
                    "text": page_text,
                    "images": res.get("markdown", {}).get("images", {}),
                })
        except (json.JSONDecodeError, KeyError):
            continue

    # Parse HTML tables from combined markdown
    tables = parse_html_tables(raw_text)

    return {"pages": pages, "raw_text": raw_text.strip(), "tables": tables}


async def submit_ocr_job(file_bytes: bytes, filename: str, content_type: str) -> str | None:
    """Submit OCR job to PaddleOCR and return the job ID."""
    async with httpx.AsyncClient(timeout=60) as client:
        files = {"file": (filename, file_bytes, content_type)}
        data = {
            "model": settings.paddleocr_model,
            "optionalPayload": json.dumps({
                "useDocOrientationClassify": False,
                "useDocUnwarping": False,
                "useChartRecognition": False,
            }),
        }
        headers = {"Authorization": f"bearer {settings.paddleocr_token}"}

        resp = await client.post(PADDLEOCR_JOB_URL, headers=headers, files=files, data=data)
        if resp.status_code != 200:
            logger.error(f"PaddleOCR submit failed: {resp.status_code} {resp.text}")
            return None

        job_data = resp.json()
        return job_data.get("data", {}).get("jobId")


async def poll_ocr_and_update_db(photo_id: str, job_id: str, db: AsyncSession):
    """Background task: poll PaddleOCR for result and update DB record."""
    headers = {"Authorization": f"bearer {settings.paddleocr_token}"}

    for i in range(MAX_POLLS):
        await asyncio.sleep(POLL_INTERVAL)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                poll_resp = await client.get(
                    f"{PADDLEOCR_JOB_URL}/{job_id}",
                    headers=headers,
                )
                if poll_resp.status_code != 200:
                    continue

                poll_data = poll_resp.json()
                state = poll_data.get("data", {}).get("state")

                if state == "done":
                    json_url = poll_data.get("data", {}).get("resultUrl", {}).get("jsonUrl")
                    if not json_url:
                        await _mark_failed(db, photo_id, "未获取到结果 URL")
                        return

                    result_resp = await client.get(json_url)
                    if result_resp.status_code != 200:
                        await _mark_failed(db, photo_id, "获取识别结果失败")
                        return

                    parsed = _parse_ocr_result(result_resp.text)

                    async with db.begin():
                        result = await db.execute(select(Photo).where(Photo.id == photo_id))
                        photo = result.scalar_one_or_none()
                        if photo:
                            photo.ocr_status = "completed"
                            photo.status = "待确认"
                            photo.ocr_raw_text = parsed["raw_text"]
                            photo.pages = parsed["pages"]
                            photo.tables = [t for t in (parsed["tables"] or [])]
                            photo.updated_at = datetime.utcnow()

                    logger.info(f"OCR completed for photo {photo_id}")
                    return

                if state == "failed":
                    error_msg = poll_data.get("data", {}).get("errorMsg", "识别失败")
                    await _mark_failed(db, photo_id, error_msg)
                    return

        except Exception as e:
            logger.error(f"OCR poll error for {photo_id}: {e}")
            continue

    # Timeout
    await _mark_failed(db, photo_id, "识别超时")


async def _mark_failed(db: AsyncSession, photo_id: str, error: str):
    try:
        async with db.begin():
            result = await db.execute(select(Photo).where(Photo.id == photo_id))
            photo = result.scalar_one_or_none()
            if photo:
                photo.ocr_status = "failed"
                photo.status = "识别失败"
                photo.error = error
                photo.updated_at = datetime.utcnow()
        logger.warning(f"OCR failed for photo {photo_id}: {error}")
    except Exception as e:
        logger.error(f"Failed to mark photo {photo_id} as failed: {e}")
