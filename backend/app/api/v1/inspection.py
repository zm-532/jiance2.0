import asyncio
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Query, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.models.photo import Photo
from app.schemas.photo import (
    PhotoResponse,
    PhotoUpdate,
    OCRRecognizeResponse,
    OCRJobStatusResponse,
    BatchDeleteRequest,
    BatchDeleteResponse,
)
from app.services.ocr import submit_ocr_job, poll_ocr_and_update_db
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

    async with db.begin():
        pass  # commit happens on session exit

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
    async with db.begin():
        await db.execute(delete(Photo).where(Photo.id == photo_id))

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
                async with db.begin():
                    await db.execute(delete(Photo).where(Photo.id == photo_id))
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
