"""提取器抽象基类。

所有设备提取器继承 BaseExtractor，实现 extract 方法。
extract 输入为 parse_html_tables 的输出（tables）+ OCR 原始文本 + 配置规则，
输出为 {values, result, frequency_data}。
"""
from abc import ABC, abstractmethod
from typing import Any


class BaseExtractor(ABC):
    """提取器基类，定义统一接口。"""

    @abstractmethod
    def extract(self, tables: list[dict], raw_text: str, config: dict) -> dict:
        """从 OCR 表格数据中按配置规则提取检测值。

        Args:
            tables: parse_html_tables 输出，格式 [{rows: [[cell, ...], ...]}, ...]
            raw_text: OCR 原始文本
            config: test_item_configs 行的 extraction_rule JSON

        Returns:
            {
                "values": list[float],          # 原始值列表（多试样）
                "result": float | None,         # 聚合后的结果值
                "frequency_data": list[dict] | None  # 频率子表数据（仅声学设备）
            }
        """
        ...

    # ---- 共享工具方法 ----

    @staticmethod
    def _find_row_index(rows: list[list[str]], keys: list[str], alternatives: list[str] | None = None) -> int:
        """在表格行首列中查找匹配的行索引。

        Args:
            rows: 表格行列表
            keys: 主匹配关键字列表（任一匹配即命中）
            alternatives: 备选关键字列表
        Returns:
            行索引，未找到返回 -1
        """
        candidates = list(keys) + (alternatives or [])
        for ri, row in enumerate(rows):
            if not row:
                continue
            first_cell = str(row[0]).strip()
            for key in candidates:
                if key and key in first_cell:
                    return ri
        return -1

    @staticmethod
    def _find_column_index(header_row: list[str], keys: list[str], alternatives: list[str] | None = None) -> int:
        """在表头行中查找匹配的列索引。

        Args:
            header_row: 表头行
            keys: 主匹配关键字列表
            alternatives: 备选关键字列表
        Returns:
            列索引，未找到返回 -1
        """
        candidates = list(keys) + (alternatives or [])
        for ci, cell in enumerate(header_row):
            cell_str = str(cell).strip()
            for key in candidates:
                if key and key in cell_str:
                    return ci
        return -1

    @staticmethod
    def _parse_value(cell_text: str, pattern: str = r"(-?\d+\.?\d*)") -> float | None:
        """从单元格文本中提取数值。

        Args:
            cell_text: 单元格文本
            pattern: 正则模式，默认匹配整数/小数（含负数）
        Returns:
            提取的数值，无法提取返回 None
        """
        import re
        if not cell_text:
            return None
        match = re.search(pattern, str(cell_text))
        if match:
            try:
                return float(match.group(1))
            except (ValueError, IndexError):
                return None
        return None

    @staticmethod
    def _extract_value_from_text(
        raw_text: str,
        keys: list[str],
        alternatives: list[str] | None = None,
        value_pattern: str = r"-?\d+\.?\d*",
    ) -> float | None:
        """从 OCR 原始文本中按关键字提取数值（无表格时的回退方案）。

        支持多种文本格式：
            key: 92.26      key：92.26     key=92.26
            T: 92.26 %      系统热容量=10441.0

        Args:
            raw_text: OCR 原始文本
            keys: 主关键字列表（任一匹配即命中）
            alternatives: 备选关键字列表（如英文缩写 T、H）
            value_pattern: 数值正则模式（不含括号）
        Returns:
            提取的数值，未找到返回 None
        """
        import re
        if not raw_text:
            return None
        candidates = list(keys) + (alternatives or [])
        for key in candidates:
            if not key:
                continue
            # 匹配 key 后面跟任意非数字字符再跟数值
            pattern = rf"{re.escape(key)}[^\d\-]*?({value_pattern})"
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except (ValueError, IndexError):
                    continue
        return None
