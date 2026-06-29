"""ZC-40 低温回缩仪提取器：行→列取值。

识别表格中 1#/2#/3# 行对应 TR 列的值，取平均值。
表格示例：
    | 编号 | TR10  | TR30  | TR50  | TR70  |
    | 1#   | -45.1 | -45.1 | -45.1 | -45.1 |
    | 2#   | -44.8 | -44.8 | -44.8 | -44.8 |
    | 3#   | -44.8 | -44.8 | -44.8 | -44.8 |
"""
import logging
from app.services.extractors.base import BaseExtractor
from app.services.extractors.aggregation import aggregate

logger = logging.getLogger(__name__)


class TableRowColumnExtractor(BaseExtractor):
    """行→列取值提取器（ZC-40 低温回缩仪）。"""

    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        result = {"values": [], "result": None, "frequency_data": None}

        try:
            rule = config.get("extraction_rule", {}) if isinstance(config.get("extraction_rule"), dict) else config
            row_headers = rule.get("row_headers", ["1#", "2#", "3#"])
            column_key = rule.get("column_key", "")
            column_alternatives = rule.get("column_alternatives", [])
            value_pattern = rule.get("value_pattern", r"(-?\d+\.?\d*)")
            aggregation_method = config.get("aggregation_method", "average")

            if not tables:
                logger.warning("TableRowColumnExtractor: 无表格数据，将尝试从 raw_text 提取")

            # 在所有表格中查找包含目标列的表
            values = []
            for table in tables:
                rows = table.get("rows", [])
                if not rows:
                    continue

                # 第一行通常是表头
                header_row = rows[0]
                col_idx = self._find_column_index(header_row, [column_key], column_alternatives)
                if col_idx == -1:
                    continue

                # 查找每个试样行
                for row_header in row_headers:
                    row_idx = self._find_row_index(rows, [row_header])
                    if row_idx == -1 or row_idx >= len(rows):
                        continue
                    row = rows[row_idx]
                    if col_idx < len(row):
                        val = self._parse_value(row[col_idx], value_pattern)
                        if val is not None:
                            values.append(val)

                if values:
                    break  # 找到数据即停止

            # 无表格或表格中未找到时，尝试从 raw_text 提取
            if not values and raw_text:
                val = self._extract_value_from_text(
                    raw_text, [column_key],
                    list(column_alternatives or []) + list(row_headers or []),
                    value_pattern.replace(r"(", "").replace(r")", ""),
                )
                if val is not None:
                    values = [val]

            result["values"] = values
            result["result"] = aggregate(values, aggregation_method)

        except Exception as e:
            logger.warning(f"TableRowColumnExtractor 提取失败: {e}")

        return result
