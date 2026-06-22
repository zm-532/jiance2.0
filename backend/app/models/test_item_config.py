from datetime import datetime
from sqlalchemy import String, Integer, Text, Boolean, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class TestItemConfig(Base):
    """检测项配置表：配置驱动的 OCR 提取规则。

    每条记录描述一个检测项的提取规则；同一次测试产生的多个检测项
    共享同一个 group_key，称为"检测项配置组"。
    """
    __tablename__ = "test_item_configs"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # 设备维度
    device_name: Mapped[str] = mapped_column(String(100), nullable=False)
    device_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    sample_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    material_spec: Mapped[str | None] = mapped_column(String(200), nullable=True)
    judgment_standard: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # 配置组：同一次测试产生的所有检测项共享同一个 group_key
    group_key: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    group_item_count: Mapped[int] = mapped_column(Integer, default=1)

    # 检测项信息
    test_item: Mapped[str] = mapped_column(String(200), nullable=False)
    sub_item: Mapped[str | None] = mapped_column(String(200), nullable=True)
    judgment_indicator: Mapped[str | None] = mapped_column(String(200), nullable=True)
    test_standard: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # OCR 提取规则（JSON 格式，描述如何从图片中提取数据）
    extraction_rule: Mapped[dict] = mapped_column(JSON, nullable=False)

    # 聚合方式：average/median/max/abs_max/single/direct
    aggregation_method: Mapped[str] = mapped_column(String(20), default="average")
    sample_count: Mapped[int] = mapped_column(Integer, default=3)

    # 特殊标记
    needs_subtable: Mapped[bool] = mapped_column(Boolean, default=False)
    report_section: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
