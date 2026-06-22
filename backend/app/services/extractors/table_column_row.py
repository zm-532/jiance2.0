"""ZC-29/ZC-09/ZC-43 列→行取值提取器。

识别表格中试样1~5列（或001~005列）对应某行的值。
适用于：电液伺服万能试验机、万能试验机、热空气老化箱。
表格示例：
    | 项目       | 试样1 | 试样2 | 试样3 | 试样4 | 试样5 |
    | 拉伸强度   | 65.2  | 66.1  | 64.8  | 65.5  | 66.0  |
"""
import logging
from app.services.extractors.base import BaseExtractor
from app.services.extractors.aggregation import aggregate

logger = logging.getLogger(__name__)


class TableColumnRowExtractor(BaseExtractor):
    """列→行取值提取器（ZC-29/ZC-09/ZC-43）。"""

    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        result = {"values": [], "result": None, "frequency_data": None}

        try:
            rule = config.get("extraction_rule", {}) if isinstance(config.get("extraction_rule"), dict) else config
            column_headers = rule.get("column_headers", ["试样1", "试样2", "试样3", "试样4", "试样5"])
            row_key = rule.get("row_key", "")
            row_alternatives = rule.get("row_alternatives", [])
            value_pattern = rule.get("value_pattern", r"(-?\d+\.?\d*)")
            aggregation_method = config.get("aggregation_method", "average")

            if not tables:
                logger.warning("TableColumnRowExtractor: 无表格数据")
                return result

            values = []
            for table in tables:
                rows = table.get("rows", [])
                if not rows:
                    continue

                header_row = rows[0]
                # 查找目标行
                row_idx = self._find_row_index(rows, [row_key], row_alternatives)
                if row_idx == -1:
                    continue

                target_row = rows[row_idx]

                # 遍历列头，找到匹配的列并取值
                for col_header in column_headers:
                    col_idx = self._find_column_index(header_row, [col_header])
                    if col_idx == -1 or col_idx >= len(target_row):
                        continue
                    val = self._parse_value(target_row[col_idx], value_pattern)
                    if val is not None:
                        values.append(val)

                if values:
                    break

            result["values"] = values
            result["result"] = aggregate(values, aggregation_method)

        except Exception as e:
            logger.warning(f"TableColumnRowExtractor 提取失败: {e}")

        return result
