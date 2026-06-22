"""提取器包：策略模式实现设备维度的 OCR 数据提取。

通过 EXTRACTOR_MAP 将设备编号映射到对应的提取器类。
get_extractor(device_key) 返回提取器实例，未匹配返回 None。
"""
from app.services.extractors.base import BaseExtractor
from app.services.extractors.table_row_column import TableRowColumnExtractor
from app.services.extractors.table_column_row import TableColumnRowExtractor
from app.services.extractors.table_avg import TableColumnRowWithAvgExtractor
from app.services.extractors.table_id_rows import TableIdRowsExtractor
from app.services.extractors.table_pressure import TablePressureRowExtractor
from app.services.extractors.single_value import SingleValueExtractor
from app.services.extractors.aggregation import aggregate

# 设备编号 → 提取器类映射（向后兼容，优先级低于 type 映射）
EXTRACTOR_MAP: dict[str, type[BaseExtractor]] = {
    "ZC-40": TableRowColumnExtractor,        # 低温回缩仪：行→列取值
    "ZC-29": TableColumnRowExtractor,         # 电液伺服万能试验机：列→行取值
    "ZC-16": TableColumnRowWithAvgExtractor,  # 光电直读光谱仪：列→行+AVG列直取
    "ZC-36": TablePressureRowExtractor,       # 抗风压检测试验机：压力行→正负压取值
    "ZC-56": TableIdRowsExtractor,            # 扭矩系数测定仪：ID行→特殊行取值
    "ZC-43": TableColumnRowExtractor,         # 热空气老化箱：列→行取值（聚合用 median）
    "ZC-49": SingleValueExtractor,            # 声学实验室设备：单值直取+频率子表
    "ZC-09": TableColumnRowExtractor,         # 万能试验机：列→行取值
}

# extraction_rule.type → 提取器类映射（推荐方式，配置驱动）
TYPE_EXTRACTOR_MAP: dict[str, type[BaseExtractor]] = {
    "table_row_column": TableRowColumnExtractor,
    "table_column_row": TableColumnRowExtractor,
    "table_avg": TableColumnRowWithAvgExtractor,
    "table_id_rows": TableIdRowsExtractor,
    "table_pressure": TablePressureRowExtractor,
    "single_value": SingleValueExtractor,
}


def get_extractor(device_key: str) -> BaseExtractor | None:
    """根据设备编号获取提取器实例（向后兼容）。

    Args:
        device_key: 设备编号，如 "ZC-40"

    Returns:
        提取器实例，未匹配返回 None
    """
    cls = EXTRACTOR_MAP.get(device_key)
    return cls() if cls else None


def get_extractor_by_type(rule_type: str) -> BaseExtractor | None:
    """根据 extraction_rule.type 获取提取器实例（推荐方式）。

    Args:
        rule_type: 提取规则类型，如 "table_row_column"

    Returns:
        提取器实例，未匹配返回 None
    """
    cls = TYPE_EXTRACTOR_MAP.get(rule_type)
    return cls() if cls else None


def get_extractor_for_config(config: dict) -> BaseExtractor | None:
    """根据配置项选择提取器：优先按 extraction_rule.type，其次按 device_key。

    Args:
        config: test_item_configs 行的字典（含 extraction_rule、device_key 等）

    Returns:
        提取器实例，未匹配返回 None
    """
    rule = config.get("extraction_rule", {})
    if isinstance(rule, dict):
        rule_type = rule.get("type", "")
        if rule_type:
            ext = get_extractor_by_type(rule_type)
            if ext:
                return ext
    # fallback: 按 device_key
    device_key = config.get("device_key", "")
    return get_extractor(device_key)


__all__ = [
    "BaseExtractor",
    "EXTRACTOR_MAP",
    "TYPE_EXTRACTOR_MAP",
    "get_extractor",
    "get_extractor_by_type",
    "get_extractor_for_config",
    "aggregate",
]
