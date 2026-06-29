import asyncio
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Query, HTTPException, BackgroundTasks, Depends, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db, async_session
from app.models.photo import Photo
from app.models.test_item_config import TestItemConfig
from app.schemas.photo import (
    PhotoResponse,
    PhotoUpdate,
    OCRRecognizeResponse,
    OCRJobStatusResponse,
    BatchDeleteRequest,
    BatchDeleteResponse,
)
from app.schemas.config import (
    DeviceResponse,
    SampleResponse,
    ConfigGroupItemResponse,
    ConfigGroupResponse,
    RecognizeWithConfigResponse,
)
from app.services.ocr import (
    submit_ocr_job,
    poll_ocr_and_update_db,
    poll_ocr_and_update_db_with_config,
)
from app.services.config_cache import (
    load_config_cache,
    get_configs,
    get_devices,
    get_samples,
    get_image_description,
    is_loaded,
)
from app.services.storage import (
    ensure_upload_dir,
    generate_filename,
    validate_file,
    get_file_path,
    get_photo_url,
    delete_file,
    UPLOAD_DIR,
)

router = APIRouter(tags=["inspection"])


@router.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ---- OCR Recognition (async, non-blocking) ----

@router.post("/ocr/recognize", response_model=OCRRecognizeResponse)
async def ocr_recognize(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    ensure_upload_dir()

    file_bytes = await file.read()

    # Validate
    error = validate_file(len(file_bytes), file.content_type)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # Save to disk
    original_name = file.filename or "upload"
    filename = generate_filename(original_name)
    file_path = get_file_path(filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    photo_url = get_photo_url(filename)

    # Create DB record
    import uuid
    photo_id = uuid.uuid4().hex
    photo = Photo(
        id=photo_id,
        original_name=original_name,
        filename=filename,
        photo_url=photo_url,
        size=len(file_bytes),
        mimetype=file.content_type or "image/jpeg",
        ocr_status="pending",
        status="识别中",
    )

    async with db.begin():
        db.add(photo)

    # Submit OCR job
    job_id = await submit_ocr_job(file_bytes, original_name, file.content_type or "image/jpeg")
    if not job_id:
        async with db.begin():
            result = await db.execute(select(Photo).where(Photo.id == photo_id))
            p = result.scalar_one_or_none()
            if p:
                p.ocr_status = "failed"
                p.status = "识别失败"
                p.error = "PaddleOCR 提交失败"
        return OCRRecognizeResponse(success=False, photo_id=photo_id, photo_url=photo_url, error="PaddleOCR 提交失败")

    # Save job_id
    async with db.begin():
        result = await db.execute(select(Photo).where(Photo.id == photo_id))
        p = result.scalar_one_or_none()
        if p:
            p.ocr_job_id = job_id

    # Start background polling
    background_tasks.add_task(_run_ocr_poll, photo_id, job_id)

    return OCRRecognizeResponse(success=True, photo_id=photo_id, photo_url=photo_url)


async def _run_ocr_poll(photo_id: str, job_id: str):
    """Standalone background task that creates its own DB session."""
    from app.db.base import async_session
    async with async_session() as db:
        await poll_ocr_and_update_db(photo_id, job_id, db)


# ---- Job status polling endpoint ----

@router.get("/ocr/jobs/{photo_id}", response_model=OCRJobStatusResponse)
async def get_job_status(photo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")

    return OCRJobStatusResponse(
        ocr_status=photo.ocr_status,
        status=photo.status,
        pages=photo.pages,
        tables=photo.tables,
        raw_text=photo.ocr_raw_text,
        error=photo.error,
    )


# ---- Photo CRUD ----

@router.get("/ocr/photos", response_model=list[PhotoResponse])
async def list_photos(
    sample_name: str | None = Query(None),
    entrust_no: str | None = Query(None),
    include_in_report: bool | None = Query(None),
    status: str | None = Query(None),
    group_id: str | None = Query(None),
    device_key: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Photo).order_by(Photo.uploaded_at.desc())
    if sample_name:
        stmt = stmt.where(Photo.sample_name == sample_name)
    if entrust_no:
        stmt = stmt.where(Photo.entrust_no == entrust_no)
    if include_in_report is not None:
        stmt = stmt.where(Photo.include_in_report == include_in_report)
    if status:
        stmt = stmt.where(Photo.status == status)
    if group_id:
        stmt = stmt.where(Photo.group_id == group_id)
    if device_key:
        stmt = stmt.where(Photo.device_key == device_key)

    result = await db.execute(stmt)
    photos = result.scalars().all()
    return [PhotoResponse.model_validate(p) for p in photos]


@router.get("/ocr/photos/{photo_id}", response_model=PhotoResponse)
async def get_photo(photo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    return PhotoResponse.model_validate(photo)


@router.patch("/ocr/photos/{photo_id}", response_model=PhotoResponse)
async def update_photo(photo_id: str, update: PhotoUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(photo, key, value)
    photo.updated_at = datetime.utcnow()

    await db.commit()

    return PhotoResponse.model_validate(photo)


@router.delete("/ocr/photos/{photo_id}")
async def delete_photo(photo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")

    # Delete file from disk
    delete_file(photo.filename)

    # Delete from DB
    await db.execute(delete(Photo).where(Photo.id == photo_id))
    await db.commit()

    return {"success": True, "message": "照片已删除"}


@router.delete("/ocr/photos/batch", response_model=BatchDeleteResponse)
async def batch_delete_photos(request: BatchDeleteRequest, db: AsyncSession = Depends(get_db)):
    success = 0
    failed = 0
    for photo_id in request.ids:
        try:
            result = await db.execute(select(Photo).where(Photo.id == photo_id))
            photo = result.scalar_one_or_none()
            if photo:
                delete_file(photo.filename)
                await db.execute(delete(Photo).where(Photo.id == photo_id))
                await db.commit()
                success += 1
            else:
                failed += 1
        except Exception:
            failed += 1

    return BatchDeleteResponse(success=success, failed=failed)


@router.get("/ocr/photos/{photo_id}/download")
async def download_photo(photo_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")

    file_path = get_file_path(photo.filename)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=str(file_path),
        filename=photo.original_name,
        media_type=photo.mimetype,
    )


# ---- Device idle warning ----

@router.get("/device-idle-warning")
async def device_idle_warning(
    days: int = Query(7, ge=1, le=90, description="回溯天数，默认7天（一周）"),
    db: AsyncSession = Depends(get_db),
):
    """
    设备闲置预警接口。
    返回指定时间范围内有上传记录的 matched_rule_id 列表，
    前端据此与 OCR 规则表中的 equipment 字段比对，确定哪些设备闲置。
    """
    since = datetime.utcnow() - timedelta(days=days)

    # 查询时间范围内有 matched_rule_id 的所有照片（按 rule_id 聚合计数）
    stmt = (
        select(
            Photo.matched_rule_id,
            Photo.matched_rule_name,
            func.count(Photo.id).label("photo_count"),
            func.max(Photo.uploaded_at).label("last_upload"),
        )
        .where(Photo.uploaded_at >= since)
        .where(Photo.matched_rule_id.isnot(None))
        .group_by(Photo.matched_rule_id, Photo.matched_rule_name)
    )
    result = await db.execute(stmt)
    rows = result.all()

    active_rules = [
        {
            "rule_id": row.matched_rule_id,
            "rule_name": row.matched_rule_name,
            "photo_count": row.photo_count,
            "last_upload": row.last_upload.isoformat() if row.last_upload else None,
        }
        for row in rows
    ]

    # 同时统计时间范围内的总照片数（含未匹配规则的）
    total_stmt = select(func.count(Photo.id)).where(Photo.uploaded_at >= since)
    total_result = await db.execute(total_stmt)
    total_photos = total_result.scalar() or 0

    return {
        "days": days,
        "since": since.isoformat(),
        "now": datetime.utcnow().isoformat(),
        "total_photos": total_photos,
        "active_rules": active_rules,
    }


# ---- 配置驱动 OCR：设备/样品/配置组查询 ----

@router.get("/configs/devices", response_model=list[DeviceResponse])
async def list_devices(db: AsyncSession = Depends(get_db)):
    """返回所有设备列表（设备名 + 设备编号）。"""
    if not is_loaded():
        await load_config_cache(db)
    return [DeviceResponse(device_key=k, device_name=n) for k, n in get_devices()]


@router.get("/configs/devices/{device_key}/samples", response_model=list[SampleResponse])
async def list_samples(device_key: str, db: AsyncSession = Depends(get_db)):
    """返回该设备支持的样品名称列表。"""
    if not is_loaded():
        await load_config_cache(db)
    samples = get_samples(device_key)
    return [SampleResponse(sample_name=s, material_spec=m) for s, m in samples]


@router.get("/configs/groups", response_model=list[ConfigGroupResponse])
async def list_config_groups(
    device_key: str = Query(..., description="设备编号"),
    sample_name: str = Query(..., description="样品名称"),
    db: AsyncSession = Depends(get_db),
):
    """返回该设备+样品组合的检测项配置组（按 group_key 聚合）。"""
    if not is_loaded():
        await load_config_cache(db)

    configs = get_configs(device_key, sample_name)
    if not configs:
        return []

    # 按 group_key 聚合
    groups: dict[str, list[dict]] = {}
    for cfg in configs:
        groups.setdefault(cfg["group_key"], []).append(cfg)

    result = []
    for group_key, items in groups.items():
        first = items[0]
        result.append(ConfigGroupResponse(
            group_key=group_key,
            device_key=first["device_key"],
            device_name=first["device_name"],
            sample_name=first["sample_name"],
            group_item_count=first["group_item_count"],
            items=[ConfigGroupItemResponse(**item) for item in items],
            image_description=get_image_description(first["device_name"], first["sample_name"]),
        ))
    return result


# ---- 配置驱动 OCR：带配置的识别端点 ----

@router.post("/ocr/recognize_with_config", response_model=RecognizeWithConfigResponse)
async def ocr_recognize_with_config(
    file: UploadFile = File(...),
    device_key: str = Form(...),
    sample_name: str = Form(...),
    entrust_no: str | None = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    """上传照片 + 按配置规则批量提取所有检测项。

    流程：
    1. 落盘 + 创建主 Photo 记录（含 device_key/group_id）
    2. 提交 PaddleOCR job
    3. 后台轮询 + 按配置组批量提取 N 个检测项
    4. 返回 group_id 供前端轮询
    """
    ensure_upload_dir()

    file_bytes = await file.read()
    error = validate_file(len(file_bytes), file.content_type)
    if error:
        raise HTTPException(status_code=400, detail=error)

    # 确保配置缓存已加载
    if not is_loaded():
        await load_config_cache(db)

    configs = get_configs(device_key, sample_name)
    if not configs:
        raise HTTPException(
            status_code=404,
            detail=f"未找到设备 {device_key} + 样品 {sample_name} 的配置",
        )

    # 保存文件
    original_name = file.filename or "upload"
    filename = generate_filename(original_name)
    file_path = get_file_path(filename)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    photo_url = get_photo_url(filename)
    group_id = uuid.uuid4().hex
    photo_id = uuid.uuid4().hex

    # 创建主 Photo 记录
    photo = Photo(
        id=photo_id,
        original_name=original_name,
        filename=filename,
        photo_url=photo_url,
        size=len(file_bytes),
        mimetype=file.content_type or "image/jpeg",
        ocr_status="pending",
        status="识别中",
        device_key=device_key,
        group_id=group_id,
        sample_name=sample_name,
        entrust_no=entrust_no,
    )

    async with db.begin():
        db.add(photo)

    # 提交 OCR job
    job_id = await submit_ocr_job(file_bytes, original_name, file.content_type or "image/jpeg")
    if not job_id:
        async with db.begin():
            result = await db.execute(select(Photo).where(Photo.id == photo_id))
            p = result.scalar_one_or_none()
            if p:
                p.ocr_status = "failed"
                p.status = "识别失败"
                p.error = "PaddleOCR 提交失败"
        return RecognizeWithConfigResponse(
            success=False, group_id=group_id, error="PaddleOCR 提交失败"
        )

    # 保存 job_id
    async with db.begin():
        result = await db.execute(select(Photo).where(Photo.id == photo_id))
        p = result.scalar_one_or_none()
        if p:
            p.ocr_job_id = job_id

    # 启动带配置的后台轮询
    background_tasks.add_task(
        _run_ocr_poll_with_config,
        photo_id, job_id, device_key, sample_name, group_id, configs,
    )

    return RecognizeWithConfigResponse(
        success=True, group_id=group_id, photo_ids=[photo_id]
    )


async def _run_ocr_poll_with_config(
    photo_id: str,
    job_id: str,
    device_key: str,
    sample_name: str,
    group_id: str,
    configs: list[dict],
):
    """带配置的后台轮询任务（创建独立 DB 会话）。"""
    async with async_session() as db:
        await poll_ocr_and_update_db_with_config(
            photo_id, job_id, db, device_key, sample_name, group_id, configs
        )


# ---- 报告生成 ----

@router.post("/reports/generate")
async def generate_report_endpoint(
    template_id: str = Form(...),
    entrust_no: str | None = Form(None),
    sample_name: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """生成 Word 检测报告。

    从纳入报告的 OCR 检测数据中，按 group_id 聚合后填充 Word 模板。
    """
    from app.services.report_generator import generate_report

    try:
        file_stream = await generate_report(db, template_id, entrust_no, sample_name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filename = f"report_{template_id}_{timestamp}.docx"

    return StreamingResponse(
        file_stream,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reports/templates")
async def list_report_templates():
    """返回可用的报告模板列表。"""
    return [
        {"id": "R001", "name": "检测报告模版-1", "file": "检测报告模版-1.docx", "category": "标准报告（含声学频率数据）"},
        {"id": "R002", "name": "检测报告模版-2", "file": "检测报告模版-2.docx", "category": "详细报告（含声学数据+试验照片）"},
        {"id": "R003", "name": "检测报告模版-3", "file": "检测报告模版-3.docx", "category": "简要报告（仅结果汇总）"},
    ]
