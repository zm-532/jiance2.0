import os
import uuid
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".gif"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def ensure_upload_dir():
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def safe_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    return ext if ext in ALLOWED_EXTENSIONS else ".jpg"


def generate_filename(original_name: str) -> str:
    ext = safe_extension(original_name)
    return f"{uuid.uuid4().hex}{ext}"


def validate_file(size: int, mimetype: str | None) -> str | None:
    if size > MAX_FILE_SIZE:
        return f"文件大小超出限制 ({MAX_FILE_SIZE // 1024 // 1024}MB)"
    if mimetype and not mimetype.startswith("image/"):
        return f"不支持的文件类型: {mimetype}"
    return None


def get_file_path(filename: str) -> Path:
    return UPLOAD_DIR / filename


def get_photo_url(filename: str) -> str:
    return f"/uploads/{filename}"


def delete_file(filename: str) -> bool:
    path = get_file_path(filename)
    if path.exists():
        path.unlink()
        return True
    return False
