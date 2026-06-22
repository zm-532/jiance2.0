from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1 import api_router
from app.core.config import settings
from app.services.storage import UPLOAD_DIR, ensure_upload_dir
from app.db.base import async_session
from app.services.config_cache import load_config_cache

app = FastAPI(title="检测系统 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

# Serve uploaded files as static
ensure_upload_dir()
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.on_event("startup")
async def _startup_load_config_cache():
    """应用启动时加载检测项配置到内存缓存。"""
    async with async_session() as db:
        await load_config_cache(db)
