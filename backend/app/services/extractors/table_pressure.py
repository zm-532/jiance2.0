"""ZC-36 抗风压检测试验机提取器：压力行→正负压取值 + 绝对值最大值。

识别指定压力行的正压/负压变形 B(mm)，取绝对值最大值。
表格示例：
    | 压力   | 测点 | 正压变形B(mm) | 负压变形B(mm) |
    | 5000Pa | 1#   | 15.2          | 14.8          |
    | 5000Pa | 2#   | 16.1          | 15.5          |
    | 5000Pa | 3#   | 14.9          | 14.2          |
"""
import logging
from app.services.extractors.base import BaseExtractor
from app.services.extractors.aggregation import aggregate

logger = logging.getLogger(__name__)


class TablePressureRowExtractor(BaseExtractor):
    """压力行→正负压取值提取器（ZC-36 抗风压检测试验机）。"""

    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        result = {"values": [], "result": None, "frequency_data": None}

        try:
            rule = config.get("extraction_rule", {}) if isinstance(config.get("extraction_rule"), dict) else config
            pressure_key = rule.get("pressure_key", "5000Pa")
            positive_label = rule.get("positive_label", "正压变形")
            negative_label = rule.get("negative_label", "负压变形")
            column_key = rule.get("column_key", "B（mm）")
            sample_points = rule.get("sample_points", ["1#", "2#", "3#"])
            aggregation_method = config.get("aggregation_method", "abs_max")

            if not tables:
                logger.warning("TablePressureRowExtractor: 无表格数据")
                return result

            values = []
            for table in tables:
                rows = table.get("rows", [])
                if not rows:
                    continue

                header_row = rows[0]
                # 查找正压/负压变形列
                pos_col_idx = self._find_column_index(header_row, [positive_label, column_key])
                neg_col_idx = self._find_column_index(header_row, [negative_label])

                # 查找压力行（可能多行，按测点区分）
                for sp in sample_points:
                    # 找到该测点且压力匹配的行
                    for row in rows:
                        if not row or len(row) < 2:
                            continue
                        row_text = " ".join(str(c) for c in row)
                        if pressure_key in row_text and sp in str(row[0]):
                            # 取正压变形值
                            if pos_col_idx != -1 and pos_col_idx < len(row):
                                val = self._parse_value(row[pos_col_idx])
                                if val is not None:
                                    values.append(val)
                            # 取负压变形值
                            if neg_col_idx != -1 and neg_col_idx < len(row):
                                val = self._parse_value(row[neg_col_idx])
                                if val is not None:
                                    values.append(val)
                            break

                if values:
                    break

            result["values"] = values
            result["result"] = aggregate(values, aggregation_method)

        except Exception as e:
            logger.warning(f"TablePressureRowExtractor 提取失败: {e}")

        return result
