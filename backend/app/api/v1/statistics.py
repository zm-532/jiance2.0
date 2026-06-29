"""统计 API 路由：实验数据统计、供应商统计、检测量统计、时效性统计等。

所有数据来自 data_cache 服务，从 JSON 文件加载到内存后计算。
"""
from fastapi import APIRouter, Query, HTTPException
from app.services.data_cache import (
    is_loaded,
    load_data_cache,
    get_records,
    get_manufacturers,
    get_sample_categories,
    get_devices,
    get_capability_items,
    get_ocr_rules,
    build_supplier_stats,
    build_material_stats,
    build_timeliness_data,
    build_monthly_volume,
    get_test_item_distribution,
    build_dashboard_data,
    get_volume_by_dimension,
    get_volume_by_supplier,
)

router = APIRouter(tags=["statistics"])


# ---- 实验记录查询 ----

@router.get("/stats/experiment-records")
async def list_experiment_records(
    manufacturer: str | None = Query(None, description="生产厂家"),
    sample_name: str | None = Query(None, description="样品名称"),
    entrust_no: str | None = Query(None, description="委托编号"),
    test_item: str | None = Query(None, description="检测项目"),
    start_date: str | None = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(50, ge=1, le=10000, description="每页条数"),
):
    """实验记录列表（分页 + 筛选）。"""
    if not is_loaded():
        await load_data_cache()

    records = get_records()

    # 筛选
    filtered = records
    if manufacturer:
        filtered = [r for r in filtered if r.get("manufacturer") == manufacturer]
    if sample_name:
        filtered = [r for r in filtered if r.get("sampleName") == sample_name]
    if entrust_no:
        filtered = [r for r in filtered if entrust_no in (r.get("entrustNo") or "")]
    if test_item:
        filtered = [r for r in filtered if test_item in (r.get("testItem") or "")]
    if start_date:
        filtered = [r for r in filtered if (r.get("testDate") or "") >= start_date]
    if end_date:
        filtered = [r for r in filtered if (r.get("testDate") or "") <= end_date]

    total = len(filtered)
    start = (page - 1) * page_size
    end = start + page_size
    page_records = filtered[start:end]

    return {
        "records": page_records,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": (total + page_size - 1) // page_size,
    }


@router.get("/stats/manufacturers")
async def list_manufacturers():
    """去重厂家列表。"""
    if not is_loaded():
        await load_data_cache()
    return get_manufacturers()


@router.get("/stats/sample-categories")
async def list_sample_categories(
    manufacturer: str | None = Query(None, description="生产厂家（正反链接筛选）"),
):
    """样品类别列表。传入 manufacturer 时返回正反链接筛选结果。"""
    if not is_loaded():
        await load_data_cache()
    return get_sample_categories(manufacturer)


# ---- 供应商统计 ----

@router.get("/stats/suppliers")
async def list_supplier_stats(
    sample_name: str | None = Query(None, description="按样品名称过滤"),
):
    """供应商检测数据统计。"""
    if not is_loaded():
        await load_data_cache()

    stats = build_supplier_stats()
    if sample_name:
        stats = [s for s in stats if s.get("sampleName") == sample_name]
    return stats


@router.get("/stats/materials")
async def list_material_stats():
    """材料统计（按样品类别聚合）。"""
    if not is_loaded():
        await load_data_cache()
    return build_material_stats()


# ---- 检测量统计 ----

@router.get("/stats/volume")
async def get_volume_stats(
    dimension: str = Query("month", description="时间维度: month/quarter/year/week/custom"),
    start_month: str | None = Query(None, description="自定义起始月份 YYYY-MM"),
    end_month: str | None = Query(None, description="自定义结束月份 YYYY-MM"),
):
    """检测量统计（按时间维度聚合）。"""
    if not is_loaded():
        await load_data_cache()
    return get_volume_by_dimension(dimension, start_month, end_month)


@router.get("/stats/volume/trend")
async def get_volume_trend():
    """月度检测趋势数据。"""
    if not is_loaded():
        await load_data_cache()
    return build_monthly_volume()


@router.get("/stats/volume/by-supplier")
async def get_volume_by_supplier_endpoint(
    manufacturers: str = Query(..., description="供应商名称列表（逗号分隔）"),
    dimension: str = Query("month", description="时间维度: month/quarter/year/week"),
):
    """供应商检测量对比。"""
    if not is_loaded():
        await load_data_cache()

    mfr_list = [m.strip() for m in manufacturers.split(",") if m.strip()]
    if len(mfr_list) < 2:
        raise HTTPException(status_code=400, detail="至少需要选择2家供应商")
    if len(mfr_list) > 10:
        raise HTTPException(status_code=400, detail="最多选择10家供应商")

    return get_volume_by_supplier(mfr_list, dimension)


# ---- 检测时效性统计 ----

@router.get("/stats/timeliness")
async def get_timeliness_stats():
    """检测时效性统计。"""
    if not is_loaded():
        await load_data_cache()
    return build_timeliness_data()


# ---- 总览工作台 ----

@router.get("/stats/dashboard")
async def get_dashboard_stats():
    """总览工作台聚合数据。"""
    if not is_loaded():
        await load_data_cache()
    return build_dashboard_data()


# ---- 设备管理 ----

@router.get("/stats/devices")
async def list_devices():
    """设备台账列表（含校准状态）。"""
    if not is_loaded():
        await load_data_cache()
    return get_devices()


# ---- 能力表 ----

@router.get("/stats/capability-items")
async def list_capability_items():
    """检测能力表数据。"""
    if not is_loaded():
        await load_data_cache()
    return get_capability_items()


@router.get("/stats/ocr-rules")
async def list_ocr_rules():
    """OCR识别规则数据（用于设备闲置预警映射）。"""
    if not is_loaded():
        await load_data_cache()
    from app.services.data_cache import get_ocr_rules
    return get_ocr_rules()
