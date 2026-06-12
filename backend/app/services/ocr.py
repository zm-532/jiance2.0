import json
import httpx
from app.core.config import settings

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

    return {"pages": pages, "raw_text": raw_text.strip()}


async def recognize_image(file_bytes: bytes, filename: str, content_type: str) -> dict:
    async with httpx.AsyncClient(timeout=300) as client:
        # Submit OCR job
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
            return {"success": False, "error": f"PaddleOCR 提交失败: {resp.status_code}"}

        job_data = resp.json()
        job_id = job_data.get("data", {}).get("jobId")
        if not job_id:
            return {"success": False, "error": "未获取到 jobId"}

        # Poll for result
        import asyncio
        for _ in range(MAX_POLLS):
            await asyncio.sleep(POLL_INTERVAL)

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
                    return {"success": False, "error": "未获取到结果 URL"}

                result_resp = await client.get(json_url)
                if result_resp.status_code != 200:
                    return {"success": False, "error": "获取识别结果失败"}

                parsed = _parse_ocr_result(result_resp.text)
                return {"success": True, **parsed}

            if state == "failed":
                error_msg = poll_data.get("data", {}).get("errorMsg", "识别失败")
                return {"success": False, "error": error_msg}

        return {"success": False, "error": "识别超时"}
