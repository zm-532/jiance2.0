"""提取器单元测试：覆盖 6 个提取器 + 聚合函数。

运行方式：
    cd backend
    set PYTHONPATH=.
    .venv\Scripts\python.exe -m pytest tests/test_extractors.py -v
"""
import pytest
from app.services.extractors.aggregation import aggregate
from app.services.extractors.table_row_column import TableRowColumnExtractor
from app.services.extractors.table_column_row import TableColumnRowExtractor
from app.services.extractors.table_avg import TableColumnRowWithAvgExtractor
from app.services.extractors.table_id_rows import TableIdRowsExtractor
from app.services.extractors.table_pressure import TablePressureRowExtractor
from app.services.extractors.single_value import SingleValueExtractor


# ============================================================
# 聚合函数测试
# ============================================================

class TestAggregate:
    def test_average(self):
        assert aggregate([1.0, 2.0, 3.0], "average") == 2.0

    def test_average_with_negatives(self):
        assert aggregate([-45.1, -44.8, -44.8], "average") == -44.9

    def test_median_odd(self):
        assert aggregate([1.0, 3.0, 2.0], "median") == 2.0

    def test_median_even(self):
        assert aggregate([1.0, 2.0, 3.0, 4.0], "median") == 2.5

    def test_max(self):
        assert aggregate([1.0, 5.0, 3.0], "max") == 5.0

    def test_abs_max(self):
        assert aggregate([15.2, -16.1, 14.9], "abs_max") == 16.1

    def test_single(self):
        assert aggregate([42.0], "single") == 42.0

    def test_direct(self):
        assert aggregate([42.0, 99.0], "direct") == 42.0

    def test_empty_list(self):
        assert aggregate([], "average") is None

    def test_with_none_values(self):
        assert aggregate([1.0, None, 3.0], "average") == 2.0

    def test_all_none(self):
        assert aggregate([None, None], "average") is None

    def test_unknown_method(self):
        assert aggregate([1.0, 2.0], "unknown") is None


# ============================================================
# TableRowColumnExtractor (ZC-40 低温回缩仪)
# ============================================================

class TestTableRowColumnExtractor:
    def setup_method(self):
        self.extractor = TableRowColumnExtractor()
        self.config = {
            "extraction_rule": {
                "type": "table_row_column",
                "row_headers": ["1#", "2#", "3#"],
                "column_key": "TR10",
                "column_alternatives": ["TR10列"],
                "value_pattern": r"(-?\d+\.?\d*)",
            },
            "aggregation_method": "average",
        }
        self.tables = [
            {"rows": [
                ["编号", "TR10", "TR30", "TR50", "TR70"],
                ["1#", "-45.1", "-45.1", "-45.1", "-45.1"],
                ["2#", "-44.8", "-44.8", "-44.8", "-44.8"],
                ["3#", "-44.8", "-44.8", "-44.8", "-44.8"],
            ]}
        ]

    def test_extract_tr10(self):
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == [-45.1, -44.8, -44.8]
        assert result["result"] == -44.9

    def test_extract_tr30(self):
        self.config["extraction_rule"]["column_key"] = "TR30"
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == [-45.1, -44.8, -44.8]
        assert result["result"] == -44.9

    def test_empty_tables(self):
        result = self.extractor.extract([], "", self.config)
        assert result["values"] == []
        assert result["result"] is None

    def test_column_not_found(self):
        self.config["extraction_rule"]["column_key"] = "TR99"
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == []

    def test_with_unit_in_cell(self):
        self.tables[0]["rows"][1][1] = "-45.1℃"
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == [-45.1, -44.8, -44.8]


# ============================================================
# TableColumnRowExtractor (ZC-29/ZC-09/ZC-43)
# ============================================================

class TestTableColumnRowExtractor:
    def setup_method(self):
        self.extractor = TableColumnRowExtractor()
        self.config = {
            "extraction_rule": {
                "type": "table_column_row",
                "column_headers": ["试样1", "试样2", "试样3", "试样4", "试样5"],
                "row_key": "抗拉强度",
                "row_alternatives": ["抗拉强度MPa"],
                "value_pattern": r"(-?\d+\.?\d*)",
            },
            "aggregation_method": "average",
        }
        self.tables = [
            {"rows": [
                ["项目", "试样1", "试样2", "试样3", "试样4", "试样5"],
                ["抗拉强度", "410", "415", "408", "412", "420"],
                ["断后伸长率", "30", "31", "29", "30", "32"],
            ]}
        ]

    def test_extract_tensile_strength(self):
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == [410.0, 415.0, 408.0, 412.0, 420.0]
        assert result["result"] == 413.0

    def test_extract_elongation(self):
        self.config["extraction_rule"]["row_key"] = "断后伸长率"
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == [30.0, 31.0, 29.0, 30.0, 32.0]
        assert result["result"] == 30.4

    def test_median_aggregation(self):
        self.config["aggregation_method"] = "median"
        self.config["extraction_rule"]["row_key"] = "断后伸长率"
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["result"] == 30.0

    def test_row_not_found(self):
        self.config["extraction_rule"]["row_key"] = "不存在"
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == []

    def test_empty_tables(self):
        result = self.extractor.extract([], "", self.config)
        assert result["values"] == []


# ============================================================
# TableColumnRowWithAvgExtractor (ZC-16 光电直读光谱仪)
# ============================================================

class TestTableColumnRowWithAvgExtractor:
    def setup_method(self):
        self.extractor = TableColumnRowWithAvgExtractor()
        self.config = {
            "extraction_rule": {
                "type": "table_avg",
                "column_headers": ["试样1", "试样2", "试样3", "试样4", "试样5"],
                "avg_column": "AVG",
                "row_key": "Si",
                "value_pattern": r"(-?\d+\.?\d*)",
            },
        }
        self.tables = [
            {"rows": [
                ["元素", "试样1", "试样2", "试样3", "试样4", "试样5", "AVG"],
                ["Si", "0.42", "0.40", "0.41", "0.39", "0.42", "0.41"],
                ["Fe", "0.55", "0.52", "0.53", "0.54", "0.51", "0.53"],
            ]}
        ]

    def test_extract_si_with_avg(self):
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == [0.42, 0.40, 0.41, 0.39, 0.42]
        assert result["result"] == 0.41  # AVG 列优先

    def test_extract_fe(self):
        self.config["extraction_rule"]["row_key"] = "Fe"
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["result"] == 0.53

    def test_no_avg_column(self):
        self.tables[0]["rows"][0] = ["元素", "试样1", "试样2", "试样3", "试样4", "试样5"]
        result = self.extractor.extract(self.tables, "", self.config)
        assert result["values"] == [0.42, 0.40, 0.41, 0.39, 0.42]
        assert result["result"] is None  # 无 AVG 列

    def test_empty_tables(self):
        result = self.extractor.extract([], "", self.config)
        assert result["values"] == []


# ============================================================
# TableIdRowsExtractor (ZC-56 扭矩系数测定仪)
# ============================================================

class TestTableIdRowsExtractor:
    def setup_method(self):
        self.extractor = TableIdRowsExtractor()
        self.config = {
            "extraction_rule": {
                "type": "table_id_rows",
                "id_rows": ["1", "2", "3", "4", "5", "6", "7", "8"],
                "result_row_key": "/X",
                "result_row_alternatives": ["б", "CV"],
                "value_pattern": r"(-?\d+\.?\d*)",
            },
        }
        self.tables = [
            {"rows": [
                ["ID", "轴力", "扭矩系数"],
                ["1", "125", "0.120"],
                ["2", "126", "0.121"],
                ["3", "124", "0.119"],
                ["4", "125", "0.122"],
                ["5", "127", "0.120"],
                ["6", "123", "0.118"],
                ["7", "125", "0.121"],
                ["8", "126", "0.120"],
                ["/X", "125.1", "0.120"],
                ["б", "2.3", "0.003"],
                ["CV", "1.8%", "2.5%"],
            ]}
        ]

    def test_extract_axis_force(self):
        result = self.extractor.extract(self.tables, "", self.config)
        assert len(result["values"]) == 8
        assert result["values"][0] == 125.0
        assert result["result"] == 125.1  # /X 行的值

    def test_result_row_not_found(self):
        self.config["extraction_rule"]["result_row_key"] = "不存在"
        self.config["extraction_rule"]["result_row_alternatives"] = []  # 清除备选
        result = self.extractor.extract(self.tables, "", self.config)
        assert len(result["values"]) == 8
        assert result["result"] is None

    def test_empty_tables(self):
        result = self.extractor.extract([], "", self.config)
        assert result["values"] == []


# ============================================================
# TablePressureRowExtractor (ZC-36 抗风压检测试验机)
# ============================================================

class TestTablePressureRowExtractor:
    def setup_method(self):
        self.extractor = TablePressureRowExtractor()
        self.config = {
            "extraction_rule": {
                "type": "table_pressure",
                "pressure_key": "5000Pa",
                "positive_label": "正压变形",
                "negative_label": "负压变形",
                "column_key": "B（mm）",
                "sample_points": ["1#", "2#", "3#"],
            },
            "aggregation_method": "abs_max",
        }
        self.tables = [
            {"rows": [
                ["测点", "压力", "正压变形B(mm)", "负压变形B(mm)"],
                ["1#", "5000Pa", "15.2", "-14.8"],
                ["2#", "5000Pa", "16.1", "-15.5"],
                ["3#", "5000Pa", "14.9", "-14.2"],
                ["1#", "-5000Pa", "15.0", "-14.5"],
                ["2#", "-5000Pa", "15.8", "-15.2"],
                ["3#", "-5000Pa", "14.7", "-14.0"],
            ]}
        ]

    def test_extract_abs_max(self):
        result = self.extractor.extract(self.tables, "", self.config)
        # 收集 1#/2#/3# 的正压和负压值
        assert len(result["values"]) >= 3
        assert result["result"] is not None
        # 绝对值最大值应为 16.1
        assert result["result"] == 16.1

    def test_different_pressure(self):
        self.config["extraction_rule"]["pressure_key"] = "3000Pa"
        self.tables[0]["rows"][1][1] = "3000Pa"  # 修改第一行的压力值
        result = self.extractor.extract(self.tables, "", self.config)
        assert len(result["values"]) > 0

    def test_empty_tables(self):
        result = self.extractor.extract([], "", self.config)
        assert result["values"] == []


# ============================================================
# SingleValueExtractor (ZC-49 声学实验室设备)
# ============================================================

class TestSingleValueExtractor:
    def setup_method(self):
        self.extractor = SingleValueExtractor()

    def test_extract_rw_single_value(self):
        config = {
            "extraction_rule": {
                "type": "single_value",
                "value_key": "Rw",
                "value_alternatives": ["RW"],
                "value_pattern": r"(-?\d+\.?\d*)",
                "needs_frequency_subtable": False,
            },
        }
        tables = [
            {"rows": [
                ["项目", "值"],
                ["Rw", "32"],
                ["NRC", "0.55"],
            ]}
        ]
        result = self.extractor.extract(tables, "", config)
        assert result["values"] == [32.0]
        assert result["result"] == 32.0
        assert result["frequency_data"] is None

    def test_extract_nrc_value(self):
        config = {
            "extraction_rule": {
                "type": "single_value",
                "value_key": "NRC",
                "value_alternatives": [],
                "needs_frequency_subtable": False,
            },
        }
        tables = [
            {"rows": [
                ["项目", "值"],
                ["Rw", "32"],
                ["NRC", "0.55"],
            ]}
        ]
        result = self.extractor.extract(tables, "", config)
        assert result["result"] == 0.55

    def test_extract_with_frequency_subtable(self):
        config = {
            "extraction_rule": {
                "type": "single_value",
                "value_key": "NRC",
                "needs_frequency_subtable": True,
                "frequency_columns": ["1/3倍频程中心频率", "吸声系数"],
            },
        }
        tables = [
            {"rows": [
                ["项目", "值"],
                ["Rw", "32"],
                ["NRC", "0.55"],
            ]},
            {"rows": [
                ["1/3倍频程中心频率", "吸声系数"],
                ["100", "0.05"],
                ["125", "0.08"],
                ["160", "0.12"],
                ["5000", "0.85"],
            ]}
        ]
        result = self.extractor.extract(tables, "", config)
        assert result["result"] == 0.55
        assert result["frequency_data"] is not None
        assert len(result["frequency_data"]) == 4
        assert result["frequency_data"][0] == {"frequency": "100", "coefficient": 0.05}
        assert result["frequency_data"][3] == {"frequency": "5000", "coefficient": 0.85}

    def test_value_not_in_table_but_in_text(self):
        config = {
            "extraction_rule": {
                "type": "single_value",
                "value_key": "Rw",
                "needs_frequency_subtable": False,
            },
        }
        tables = []
        raw_text = "检测报告 Rw 32dB 依据标准"
        result = self.extractor.extract(tables, raw_text, config)
        assert result["values"] == [32.0]
        assert result["result"] == 32.0

    def test_empty_tables_and_text(self):
        config = {
            "extraction_rule": {
                "type": "single_value",
                "value_key": "Rw",
                "needs_frequency_subtable": False,
            },
        }
        result = self.extractor.extract([], "", config)
        assert result["values"] == []
        assert result["result"] is None


# ============================================================
# BaseExtractor 工具方法测试
# ============================================================

class TestBaseExtractorUtils:
    def test_find_row_index_exact(self):
        from app.services.extractors.base import BaseExtractor
        rows = [["1#", "val"], ["2#", "val2"], ["/X", "avg"]]
        idx = BaseExtractor._find_row_index(rows, ["/X"])
        assert idx == 2

    def test_find_row_index_partial(self):
        from app.services.extractors.base import BaseExtractor
        rows = [["抗拉强度MPa", "410"], ["断后伸长率", "30"]]
        idx = BaseExtractor._find_row_index(rows, ["抗拉强度"], ["抗拉强度MPa"])
        assert idx == 0

    def test_find_row_index_not_found(self):
        from app.services.extractors.base import BaseExtractor
        rows = [["1#", "val"]]
        idx = BaseExtractor._find_row_index(rows, ["不存在"])
        assert idx == -1

    def test_find_column_index(self):
        from app.services.extractors.base import BaseExtractor
        header = ["编号", "TR10", "TR30"]
        idx = BaseExtractor._find_column_index(header, ["TR10"])
        assert idx == 1

    def test_find_column_index_not_found(self):
        from app.services.extractors.base import BaseExtractor
        header = ["编号", "TR10"]
        idx = BaseExtractor._find_column_index(header, ["TR99"])
        assert idx == -1

    def test_parse_value_positive(self):
        from app.services.extractors.base import BaseExtractor
        assert BaseExtractor._parse_value("45.2") == 45.2

    def test_parse_value_negative(self):
        from app.services.extractors.base import BaseExtractor
        assert BaseExtractor._parse_value("-45.1℃") == -45.1

    def test_parse_value_empty(self):
        from app.services.extractors.base import BaseExtractor
        assert BaseExtractor._parse_value("") is None

    def test_parse_value_no_number(self):
        from app.services.extractors.base import BaseExtractor
        assert BaseExtractor._parse_value("无数据") is None
