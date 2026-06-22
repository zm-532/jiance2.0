"""ZC-56 扭矩系数测定仪提取器：ID行→特殊行取值。

识别 ID 1~8 行的轴力/扭矩系数，取 /X 行或 б 行或 CV 行作为最终值。
表格示例：
    | ID | 轴力  | 扭矩系数 |
    | 1  | 125  | 0.120    |
    | ...| ...  | ...      |
    | /X | 124  | 0.121    |  <- 平均行
    | б  | 2.3  | 0.003    |  <- 标准偏差行
    | CV | 1.8% | 2.5%     |  <- 变异系数行
"""
import logging
from app.services.extractors.base import BaseExtractor

logger = logging.getLogger(__name__)


class TableIdRowsExtractor(BaseExtractor):
    """ID行→特殊行取值提取器（ZC-56 扭矩系数测定仪）。"""

    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        result = {"values": [], "result": None, "frequency_data": None}

        try:
            rule = config.get("extraction_rule", {}) if isinstance(config.get("extraction_rule"), dict) else config
            id_rows = rule.get("id_rows", ["1", "2", "3", "4", "5", "6", "7", "8"])
            result_row_key = rule.get("result_row_key", "/X")
            result_row_alternatives = rule.get("result_row_alternatives", [])
            value_pattern = rule.get("value_pattern", r"(-?\d+\.?\d*)")

            if not tables:
                logger.warning("TableIdRowsExtractor: 无表格数据")
                return result

            values = []
            result_value = None
            for table in tables:
                rows = table.get("rows", [])
                if not rows:
                    continue

                # 收集 ID 行的值（取第二列，即数值列）
                for id_key in id_rows:
                    row_idx = self._find_row_index(rows, [id_key])
                    if row_idx == -1 or row_idx >= len(rows):
                        continue
                    row = rows[row_idx]
                    if len(row) >= 2:
                        val = self._parse_value(row[1], value_pattern)
                        if val is not None:
                            values.append(val)

                # 查找结果行（/X、б、CV 等），取第二列
                result_row_idx = self._find_row_index(
                    rows, [result_row_key], result_row_alternatives
                )
                if result_row_idx != -1 and result_row_idx < len(rows):
                    result_row = rows[result_row_idx]
                    if len(result_row) >= 2:
                        result_value = self._parse_value(result_row[1], value_pattern)

                if values or result_value is not None:
                    break

            result["values"] = values
            result["result"] = result_value

        except Exception as e:
            logger.warning(f"TableIdRowsExtractor 提取失败: {e}")

        return result
