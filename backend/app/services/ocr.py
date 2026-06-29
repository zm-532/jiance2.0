import json
import asyncio
import logging
import uuid
import httpx
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.services.table_parser import parse_html_tables
from app.services.extractors import get_extractor, get_extractor_for_config
from app.models.photo import Photo

logger = logging.getLogger(__name__)

PADDLEOCR_JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
MAX_POLLS = 100
POLL_INTERVAL = 2.0


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


def compress_image(file_bytes: bytes, filename: str, content_type: str, max_size: int = 5 * 1024 * 1024) -> tuple[bytes, str, str]:
    """压缩超过 max_size 的图片，返回 (bytes, filename, content_type)。

    使用 Pillow 按比例缩小图片直到小于 max_size，重新编码为 JPEG。
    如果图片本身不大或 Pillow 不可用，返回原始数据。
    """
    if len(file_bytes) <= max_size:
        return file_bytes, filename, content_type

    try:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(file_bytes))
        # 转为 RGB（去掉 alpha 通道）
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # 逐步缩小尺寸
        quality = 85
        output = io.BytesIO()
        img.save(output, format="JPEG", quality=quality)
        while output.tell() > max_size and quality > 30:
            output.seek(0)
            output.truncate()
            quality -= 10
            img.save(output, format="JPEG", quality=quality)

        if output.tell() > max_size:
            # 还是不够小，缩小尺寸
            ratio = (max_size / output.tell()) ** 0.5
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.LANCZOS)
            output.seek(0)
            output.truncate()
            img.save(output, format="JPEG", quality=60)

        compressed = output.getvalue()
        logger.info(f"图片压缩: {len(file_bytes)} -> {len(compressed)} bytes (quality={quality})")
        new_name = filename.rsplit(".", 1)[0] + ".jpg"
        return compressed, new_name, "image/jpeg"

    except ImportError:
        logger.warning("Pillow 未安装，跳过图片压缩")
        return file_bytes, filename, content_type
    except Exception as e:
        logger.warning(f"图片压缩失败: {e}，使用原始图片")
        return file_bytes, filename, content_type


async def submit_ocr_job(file_bytes: bytes, filename: str, content_type: str) -> str | None:
    """Submit OCR job to PaddleOCR and return the job ID."""
    # 压缩大图片
    file_bytes, filename, content_type = compress_image(file_bytes, filename, content_type)

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


async def poll_ocr_and_update_db_with_config(
    photo_id: str,
    job_id: str,
    db: AsyncSession,
    device_key: str,
    sample_name: str,
    group_id: str,
    configs: list[dict],
):
    """带配置的 OCR 轮询：OCR 完成后按配置组批量提取多个检测项。

    Args:
        photo_id: 主照片 ID（OCR 结果存于此）
        job_id: PaddleOCR job ID
        db: 异步数据库会话
        device_key: 设备编号
        sample_name: 样品名称
        group_id: 检测项配置组 ID（本次测试共享）
        configs: 该设备+样品的配置列表（来自 config_cache）
    """
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
                    tables = parsed.get("tables", []) or []
                    raw_text = parsed.get("raw_text", "")

                    # 按配置组批量提取
                    photo_records = []

                    if configs:
                        for cfg in configs:
                            try:
                                # 按配置的 extraction_rule.type 选择提取器（优先），
                                # fallback 到 device_key 映射
                                extractor = get_extractor_for_config(cfg)
                                if not extractor:
                                    logger.warning(
                                        f"No extractor for config {cfg.get('id')} "
                                        f"(type={cfg.get('extraction_rule', {}).get('type', '?')}, "
                                        f"device={device_key}), skip extraction"
                                    )
                                    raise ValueError("no matching extractor")

                                extract_result = extractor.extract(tables, raw_text, cfg)
                                values = extract_result.get("values", [])
                                result_val = extract_result.get("result")
                                frequency_data = extract_result.get("frequency_data")

                                # 提取返回空结果时设置错误提示，触发手动填写
                                extract_error = None
                                if result_val is None and not values:
                                    extract_error = "未提取到数据，请手动填写"

                                # 每个检测项生成一条 Photo 记录，共享 group_id
                                child_photo = Photo(
                                    id=uuid.uuid4().hex,
                                    original_name=f"{cfg['test_item']}",
                                    filename=f"child_{uuid.uuid4().hex}",  # 子记录用唯一标识，避免空字符串冲突
                                    photo_url="",
                                    size=0,
                                    mimetype="",
                                    ocr_status="completed",
                                    status="待确认",
                                    error=extract_error,
                                    ocr_raw_text=raw_text if cfg == configs[0] else None,
                                    pages=parsed.get("pages") if cfg == configs[0] else None,
                                    tables=tables if cfg == configs[0] else None,
                                    test_item=cfg["test_item"],
                                    sub_item=cfg.get("sub_item"),
                                    recognized_value=str(result_val) if result_val is not None else None,
                                    standard_requirement=cfg.get("judgment_indicator"),
                                    judgment="待判定",
                                    sample_name=sample_name,
                                    device_key=device_key,
                                    group_id=group_id,
                                    config_id=cfg["id"],
                                    material_spec=cfg.get("material_spec"),
                                    sample_count=cfg.get("sample_count"),
                                    aggregation_method=cfg.get("aggregation_method"),
                                    result_values=values,
                                    frequency_data=frequency_data,
                                )
                                photo_records.append(child_photo)
                            except Exception as e:
                                logger.warning(
                                    f"Extractor {device_key} failed for config {cfg.get('id')}: {e}"
                                )
                                # 失败的检测项仍创建记录，标记需手动填写
                                child_photo = Photo(
                                    id=uuid.uuid4().hex,
                                    original_name=f"{cfg['test_item']}",
                                    filename=f"child_{uuid.uuid4().hex}",  # 子记录用唯一标识
                                    photo_url="",
                                    size=0,
                                    mimetype="",
                                    ocr_status="completed",
                                    status="待确认",
                                    test_item=cfg["test_item"],
                                    sub_item=cfg.get("sub_item"),
                                    recognized_value=None,
                                    standard_requirement=cfg.get("judgment_indicator"),
                                    judgment="待判定",
                                    error="未提取到数据，请手动填写",
                                    sample_name=sample_name,
                                    device_key=device_key,
                                    group_id=group_id,
                                    config_id=cfg["id"],
                                    material_spec=cfg.get("material_spec"),
                                    sample_count=cfg.get("sample_count"),
                                    aggregation_method=cfg.get("aggregation_method"),
                                    result_values=[],
                                )
                                photo_records.append(child_photo)
                    else:
                        # 无配置：回退为通用模式，仅存原始数据
                        logger.warning(
                            f"No configs for device {device_key} + sample {sample_name}, fallback to raw mode"
                        )

                    # 更新主照片记录（保留 OCR 原始结果）
                    async with db.begin():
                        result = await db.execute(select(Photo).where(Photo.id == photo_id))
                        photo = result.scalar_one_or_none()
                        if photo:
                            photo.ocr_status = "completed"
                            photo.status = "待确认"
                            photo.ocr_raw_text = raw_text
                            photo.pages = parsed.get("pages")
                            photo.tables = tables
                            photo.device_key = device_key
                            photo.group_id = group_id
                            photo.sample_name = sample_name
                            photo.updated_at = datetime.utcnow()

                    # 批量插入子记录
                    if photo_records:
                        async with db.begin():
                            for rec in photo_records:
                                db.add(rec)

                    logger.info(
                        f"OCR with config completed for photo {photo_id}, "
                        f"extracted {len(photo_records)} items"
                    )
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
