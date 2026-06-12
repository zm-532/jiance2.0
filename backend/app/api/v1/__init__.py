from fastapi import APIRouter
from app.api.v1.inspection import router as inspection_router

api_router = APIRouter()
api_router.include_router(inspection_router, prefix="/inspection", tags=["inspection"])
