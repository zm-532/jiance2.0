"""检测项配置相关 Schema。"""
from pydantic import BaseModel
from datetime import datetime


class DeviceResponse(BaseModel):
    """设备列表项。"""
    device_key: str
    device_name: str


class SampleResponse(BaseModel):
    """样品列表项。"""
    sample_name: str
    material_spec: str | None = None


class ConfigGroupItemResponse(BaseModel):
    """检测项配置组中的单个配置项。"""
    id: str
    device_name: str
    device_key: str
    sample_name: str
    material_spec: str | None = None
    judgment_standard: str | None = None
    group_key: str
    group_item_count: int
    test_item: str
    sub_item: str | None = None
    judgment_indicator: str | None = None
    test_standard: str | None = None
    extraction_rule: dict
    aggregation_method: str
    sample_count: int
    needs_subtable: bool
    report_section: str | None = None
    # created_at/updated_at 在内存缓存中可能不存在，设为可选
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ConfigGroupResponse(BaseModel):
    """检测项配置组响应（按 group_key 聚合）。"""
    group_key: str
    device_key: str
    device_name: str
    sample_name: str
    group_item_count: int
    items: list[ConfigGroupItemResponse]
    image_description: str | None = None


class RecognizeWithConfigResponse(BaseModel):
    """配置驱动 OCR 识别响应。"""
    success: bool
    group_id: str | None = None
    photo_ids: list[str] = []
    error: str | None = None
