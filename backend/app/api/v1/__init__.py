from fastapi import APIRouter
from app.api.v1.inspection import router as inspection_router
from app.api.v1.statistics import router as statistics_router

api_router = APIRouter()
api_router.include_router(inspection_router, prefix="/inspection", tags=["inspection"])
api_router.include_router(statistics_router, prefix="/inspection", tags=["statistics"])
