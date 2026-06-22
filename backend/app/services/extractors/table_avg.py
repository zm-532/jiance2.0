"""ZC-16 光电直读光谱仪提取器：列→行取值 + AVG列直取。

识别试样1~5列对应元素行，但最终值直接取 AVG 列。
表格示例：
    | 元素 | 试样1 | 试样2 | 试样3 | 试样4 | 试样5 | AVG  |
    | Si   | 0.42  | 0.40  | 0.41  | 0.39  | 0.42  | 0.41 |
"""
import logging
from app.services.extractors.base import BaseExtractor

logger = logging.getLogger(__name__)


class TableColumnRowWithAvgExtractor(BaseExtractor):
    """列→行取值 + AVG列直取提取器（ZC-16 光电直读光谱仪）。"""

    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        result = {"values": [], "result": None, "frequency_data": None}

        try:
            rule = config.get("extraction_rule", {}) if isinstance(config.get("extraction_rule"), dict) else config
            column_headers = rule.get("column_headers", ["试样1", "试样2", "试样3", "试样4", "试样5"])
            avg_column = rule.get("avg_column", "AVG")
            row_key = rule.get("row_key", "")
            value_pattern = rule.get("value_pattern", r"(-?\d+\.?\d*)")

            if not tables:
                logger.warning("TableColumnRowWithAvgExtractor: 无表格数据")
                return result

            values = []
            avg_value = None
            for table in tables:
                rows = table.get("rows", [])
                if not rows:
                    continue

                header_row = rows[0]
                row_idx = self._find_row_index(rows, [row_key])
                if row_idx == -1:
                    continue

                target_row = rows[row_idx]

                # 收集各试样值
                for col_header in column_headers:
                    col_idx = self._find_column_index(header_row, [col_header])
                    if col_idx == -1 or col_idx >= len(target_row):
                        continue
                    val = self._parse_value(target_row[col_idx], value_pattern)
                    if val is not None:
                        values.append(val)

                # 直接取 AVG 列
                avg_col_idx = self._find_column_index(header_row, [avg_column])
                if avg_col_idx != -1 and avg_col_idx < len(target_row):
                    avg_value = self._parse_value(target_row[avg_col_idx], value_pattern)

                if values or avg_value is not None:
                    break

            result["values"] = values
            # AVG 列优先作为最终结果
            result["result"] = avg_value if avg_value is not None else None

        except Exception as e:
            logger.warning(f"TableColumnRowWithAvgExtractor 提取失败: {e}")

        return result
