from pydantic import BaseModel
from datetime import datetime


class OCRTable(BaseModel):
    rows: list[list[str]]


class PhotoResponse(BaseModel):
    id: str
    original_name: str
    filename: str
    photo_url: str
    size: int
    mimetype: str
    uploaded_at: datetime
    ocr_status: str
    ocr_job_id: str | None = None
    ocr_raw_text: str | None = None
    pages: list | None = None
    tables: list[OCRTable] | None = None
    error: str | None = None
    matched_rule_id: str | None = None
    matched_rule_name: str | None = None
    test_item: str | None = None
    sub_item: str | None = None
    recognized_value: str | None = None
    standard_requirement: str | None = None
    judgment: str
    status: str
    include_in_report: bool
    sample_name: str | None = None
    entrust_no: str | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhotoUpdate(BaseModel):
    test_item: str | None = None
    sub_item: str | None = None
    recognized_value: str | None = None
    standard_requirement: str | None = None
    judgment: str | None = None
    status: str | None = None
    include_in_report: bool | None = None
    sample_name: str | None = None
    entrust_no: str | None = None
    matched_rule_id: str | None = None
    matched_rule_name: str | None = None


class PhotoListParams(BaseModel):
    sample_name: str | None = None
    entrust_no: str | None = None
    include_in_report: bool | None = None
    status: str | None = None


class OCRRecognizeResponse(BaseModel):
    success: bool
    photo_id: str | None = None
    photo_url: str | None = None
    error: str | None = None


class OCRJobStatusResponse(BaseModel):
    ocr_status: str
    status: str
    pages: list | None = None
    tables: list[OCRTable] | None = None
    raw_text: str | None = None
    error: str | None = None


class BatchDeleteRequest(BaseModel):
    ids: list[str]


class BatchDeleteResponse(BaseModel):
    success: int
    failed: int
