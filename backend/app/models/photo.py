from datetime import datetime
from sqlalchemy import String, Integer, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    original_name: Mapped[str] = mapped_column(String(500), default="")
    filename: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    photo_url: Mapped[str] = mapped_column(String(500), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    mimetype: Mapped[str] = mapped_column(String(100), default="image/jpeg")
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # OCR status
    ocr_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / completed / failed
    ocr_job_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    pages: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    tables: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Matched rule
    matched_rule_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    matched_rule_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Test result fields
    test_item: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sub_item: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recognized_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    standard_requirement: Mapped[str | None] = mapped_column(String(500), nullable=True)
    judgment: Mapped[str] = mapped_column(String(20), default="待判定")  # 合格 / 不合格 / 待判定

    # Workflow
    status: Mapped[str] = mapped_column(String(20), default="识别中")  # 识别中 / 待确认 / 已识别 / 识别失败
    include_in_report: Mapped[bool] = mapped_column(Boolean, default=False)
    sample_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    entrust_no: Mapped[str | None] = mapped_column(String(255), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
