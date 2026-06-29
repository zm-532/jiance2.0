"""ZC-49 声学实验室设备提取器：单值直取 + 可选频率子表。

识别 Rw 行或 NRC 行的单值，部分检测项需提取 1/3 倍频程频率数据子表。
表格示例（单值）：
    | 项目 | 值   |
    | Rw   | 32   |
    | NRC  | 0.55 |

表格示例（频率子表）：
    | 1/3倍频程中心频率 | 吸声系数 |
    | 100               | 0.05     |
    | 125               | 0.08     |
    | ...               | ...      |
"""
import logging
from app.services.extractors.base import BaseExtractor

logger = logging.getLogger(__name__)


class SingleValueExtractor(BaseExtractor):
    """单值直取 + 可选频率子表提取器（ZC-49 声学实验室设备）。"""

    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        result = {"values": [], "result": None, "frequency_data": None}

        try:
            rule = config.get("extraction_rule", {}) if isinstance(config.get("extraction_rule"), dict) else config
            value_key = rule.get("value_key", "")
            value_alternatives = rule.get("value_alternatives", [])
            needs_frequency_subtable = rule.get("needs_frequency_subtable", False)
            frequency_columns = rule.get("frequency_columns", [])
            value_pattern = rule.get("value_pattern", r"(-?\d+\.?\d*)")

            if not tables:
                # 表格为空时不直接返回，继续尝试从原始文本提取
                logger.warning("SingleValueExtractor: 无表格数据，尝试从原始文本提取")

            # 阶段1：提取单值
            single_value = None
            for table in tables:
                rows = table.get("rows", [])
                if not rows:
                    continue

                # 查找包含 value_key 的行，取第二列值
                row_idx = self._find_row_index(rows, [value_key], value_alternatives)
                if row_idx != -1 and row_idx < len(rows):
                    row = rows[row_idx]
                    if len(row) >= 2:
                        single_value = self._parse_value(row[1], value_pattern)
                        if single_value is not None:
                            break

            # 如果表格中未找到，尝试从原始文本中正则提取
            if single_value is None and raw_text:
                import re
                pattern = rf"{value_key}[^\d-]*(-?\d+\.?\d*)"
                match = re.search(pattern, raw_text)
                if match:
                    try:
                        single_value = float(match.group(1))
                    except ValueError:
                        pass

            # 额外回退：使用 _extract_value_from_text 方法从原始文本提取
            if single_value is None and raw_text:
                single_value = self._extract_value_from_text(
                    raw_text, [value_key], value_alternatives,
                    value_pattern.replace(r"(", "").replace(r")", "") if value_pattern else r"-?\d+\.?\d*",
                )

            result["values"] = [single_value] if single_value is not None else []
            result["result"] = single_value

            # 阶段2：提取频率子表（如需要）
            if needs_frequency_subtable and frequency_columns:
                frequency_data = self._extract_frequency_table(tables, frequency_columns)
                result["frequency_data"] = frequency_data

        except Exception as e:
            logger.warning(f"SingleValueExtractor 提取失败: {e}")

        return result

    def _extract_frequency_table(self, tables: list[dict], frequency_columns: list[str]) -> list[dict] | None:
        """提取 1/3 倍频程频率数据子表。

        Returns:
            [{"frequency": "100", "coefficient": 0.05}, ...] 或 None
        """
        freq_col_name = frequency_columns[0] if len(frequency_columns) > 0 else "频率"
        coeff_col_name = frequency_columns[1] if len(frequency_columns) > 1 else "吸声系数"

        for table in tables:
            rows = table.get("rows", [])
            if not rows:
                continue

            header_row = rows[0]
            freq_col_idx = self._find_column_index(header_row, [freq_col_name, "频率", "f(Hz)"])
            coeff_col_idx = self._find_column_index(header_row, [coeff_col_name, "吸声系数", "α"])

            if freq_col_idx == -1 or coeff_col_idx == -1:
                continue

            frequency_data = []
            for row in rows[1:]:  # 跳过表头
                if freq_col_idx >= len(row) or coeff_col_idx >= len(row):
                    continue
                freq_text = str(row[freq_col_idx]).strip()
                # 频率列必须是数字
                freq_val = self._parse_value(freq_text, r"(\d+\.?\d*)")
                if freq_val is None:
                    continue
                coeff_val = self._parse_value(row[coeff_col_idx])
                if coeff_val is not None:
                    frequency_data.append({
                        "frequency": str(int(freq_val)) if freq_val == int(freq_val) else str(freq_val),
                        "coefficient": coeff_val,
                    })

            if frequency_data:
                return frequency_data

        return None
