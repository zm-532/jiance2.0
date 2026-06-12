from fastapi import APIRouter, UploadFile, File
from app.services.ocr import recognize_image

router = APIRouter(tags=["inspection"])


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/ocr/recognize")
async def ocr_recognize(file: UploadFile = File(...)):
    file_bytes = await file.read()
    result = await recognize_image(file_bytes, file.filename or "upload", file.content_type or "image/jpeg")
    return result
