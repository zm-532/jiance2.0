"""数据缓存与统计计算服务。

启动时从 JSON 加载实验记录、设备台账、节假日数据到内存，
提供统计计算函数（供应商统计、材料统计、时效性统计、检测量统计等）。

逻辑移植自 frontend/scripts/stats-helpers.cjs。
"""
import json
import logging
import re
from datetime import date, datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

# ---- 内存缓存 ----
_cache: dict = {}

# ---- 检测项分类规则 ----
_CATEGORY_PATTERNS = [
    (r"硬度|拉伸|撕裂|冲击|弯曲|压缩|伸长|强度|力值|载荷|断裂", "力学性能"),
    (r"老化|臭氧|盐雾|氙灯|紫外|耐候|汞灯", "耐候性能"),
    (r"透光|雾度|光泽|颜色|色差|黄色", "光学性能"),
    (r"吸声|隔声|声学", "声学性能"),
    (r"燃烧|热值|不燃|可燃|防火", "防火性能"),
    (r"密度|厚度|尺寸|重量|质量|憎水|含水", "物理性能"),
    (r"化学|成分|光谱", "化学分析"),
]


def _load_json(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        logger.warning(f"数据文件不存在: {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


async def load_data_cache():
    """启动时加载所有 JSON 数据到内存缓存。"""
    global _cache

    if _cache:
        return

    logger.info("正在加载实验数据缓存...")

    raw = _load_json("experiment_data.json")
    if not raw:
        logger.error("无法加载 experiment_data.json")
        return

    _cache["records"] = raw.get("records", [])
    _cache["reg_records"] = raw.get("regRecords", [])
    _cache["app_records"] = raw.get("appRecords", [])
    _cache["supplier_stats_raw"] = raw.get("supplierStats", [])
    _cache["material_stats_raw"] = raw.get("materialStats", [])
    _cache["timeliness_data_raw"] = raw.get("timelinessData", [])
    _cache["monthly_volume"] = raw.get("monthlyVolume", [])
    _cache["monthly_reg_volume"] = raw.get("monthlyRegVolume", [])
    _cache["test_item_distribution"] = raw.get("testItemDistribution", [])
    _cache["status_stats"] = raw.get("statusStats", {})
    _cache["test_type_stats"] = raw.get("testTypeStats", {})
    _cache["person_stats"] = raw.get("personStats", {})
    _cache["approval_stats"] = raw.get("approvalStats", {})
    _cache["pipeline"] = raw.get("pipeline", {})
    _cache["all_records_count"] = raw.get("allRecordsCount", 0)
    _cache["all_reg_records_count"] = raw.get("allRegRecordsCount", 0)
    _cache["in_progress_count"] = raw.get("inProgressCount", 0)
    _cache["pending_count"] = raw.get("pendingCount", 0)
    _cache["all_app_records_count"] = raw.get("allAppRecordsCount", 0)
    _cache["photo_count"] = raw.get("photoCount", 0)
    _cache["sample_categories"] = raw.get("sampleCategories", [])
    _cache["manufacturers"] = raw.get("manufacturers", [])
    _cache["supplier_info"] = raw.get("supplierInfo", [])
    _cache["supplier_info_count"] = raw.get("supplierInfoCount", 0)
    _cache["capability_items"] = raw.get("capabilityItems", [])
    _cache["sample_requirements"] = raw.get("sampleRequirements", [])
    _cache["strip_specs"] = raw.get("stripSpecs", [])
    _cache["ocr_rules"] = raw.get("ocrRules", [])

    # 设备数据
    devices_raw = _load_json("devices.json")
    if devices_raw:
        _cache["devices"] = [_process_device(d) for d in devices_raw]
    else:
        _cache["devices"] = []

    # 节假日数据
    _cache["holidays"] = _load_json("holidays.json")

    logger.info(
        f"数据缓存加载完成: {len(_cache.get('records', []))} 条实验记录, "
        f"{len(_cache.get('devices', []))} 台设备, "
        f"{len(_cache.get('supplier_stats_raw', []))} 条供应商统计"
    )


def _process_device(d: dict) -> dict:
    """处理设备数据，添加校准状态。"""
    result = dict(d)

    status = d.get("status", "")
    next_cal = d.get("nextCalibrationDate")

    if status == "未到":
        result["calibrationStatus"] = "未到货"
    elif not next_cal:
        result["calibrationStatus"] = "无校准数据"
    else:
        try:
            next_date = datetime.strptime(next_cal, "%Y-%m-%d").date()
            today = date.today()
            if next_date < today:
                result["calibrationStatus"] = "已过期"
            elif (next_date - today).days <= 30:
                result["calibrationStatus"] = "即将到期"
            else:
                result["calibrationStatus"] = "正常"
        except (ValueError, TypeError):
            result["calibrationStatus"] = "无校准数据"

    return result


def is_loaded() -> bool:
    return bool(_cache)


# ---- 基础数据访问函数 ----

def get_records() -> list[dict]:
    return _cache.get("records", [])


def get_reg_records() -> list[dict]:
    return _cache.get("reg_records", [])


def get_devices() -> list[dict]:
    return _cache.get("devices", [])


def get_manufacturers() -> list[str]:
    return _cache.get("manufacturers", [])


def get_sample_categories(manufacturer: str | None = None) -> list[str]:
    """获取样品类别列表。传入 manufacturer 时返回正反链接筛选结果。"""
    if manufacturer:
        records = get_records()
        cats = sorted({
            r.get("sampleName", "")
            for r in records
            if r.get("manufacturer") == manufacturer and r.get("sampleName")
        })
        return cats
    return _cache.get("sample_categories", [])


def get_supplier_info() -> list[dict]:
    return _cache.get("supplier_info", [])


def get_capability_items() -> list[dict]:
    return _cache.get("capability_items", [])


def get_ocr_rules() -> list[dict]:
    """获取OCR识别规则数据（用于设备闲置预警映射）。"""
    return _cache.get("ocr_rules", [])


def get_pipeline() -> dict:
    return _cache.get("pipeline", {})


def get_photo_count() -> int:
    return _cache.get("photo_count", 0)


# ---- 统计计算函数 ----

def _batch_key(record: dict) -> str:
    """从委托编号生成批次标识，逻辑同 stats-helpers.cjs 的 batchKey。"""
    entrust_no = str(record.get("entrustNo", "")).strip()
    if entrust_no:
        without_instance = entrust_no.split("[")[0].strip()
        match = re.match(r"^[A-Za-z]+\d+", without_instance)
        return match.group(0) if match else without_instance
    return "||".join([
        record.get("manufacturer", ""),
        record.get("sampleName", ""),
        record.get("specModel", ""),
        record.get("receiveDate", ""),
    ])


def _is_completed(status: str) -> bool:
    return status in ("已完成", "检测完成")


def _is_pending(status: str) -> bool:
    return status in ("检测中", "待检测", "待登记")


def build_supplier_stats() -> list[dict]:
    """构建供应商统计数据。

    逻辑移植自 stats-helpers.cjs 的 buildSupplierStats。
    合并 regRecords 和 experimentRecords 的批次信息。
    """
    reg_records = get_reg_records()
    records = get_records()

    batches: dict[str, dict] = {}

    # 从登记记录构建批次
    for r in reg_records:
        manufacturer = r.get("manufacturer", "")
        sample_name = r.get("sampleName", "")
        if not manufacturer or not sample_name:
            continue
        key = "||".join([manufacturer, sample_name, _batch_key(r)])
        if key not in batches:
            batches[key] = {
                "manufacturer": manufacturer,
                "sampleName": sample_name,
                "has_completed": False,
                "has_pending": False,
                "has_unqualified": False,
            }
        batch = batches[key]
        status = r.get("testStatus", "")
        if _is_completed(status):
            batch["has_completed"] = True
        if _is_pending(status):
            batch["has_pending"] = True

    # 从实验记录补充批次信息
    for r in records:
        manufacturer = r.get("manufacturer", "")
        sample_name = r.get("sampleName", "")
        if not manufacturer or not sample_name:
            continue
        key = "||".join([manufacturer, sample_name, _batch_key(r)])
        if key not in batches:
            batches[key] = {
                "manufacturer": manufacturer,
                "sampleName": sample_name,
                "has_completed": bool(r.get("testDate")),
                "has_pending": False,
                "has_unqualified": False,
            }
        batch = batches[key]
        judgment = str(r.get("judgment", ""))
        if "不合格" in judgment:
            batch["has_unqualified"] = True
            batch["has_completed"] = True
        elif judgment:
            batch["has_completed"] = True

    # 按 manufacturer + sampleName 聚合
    supplier_map: dict[str, dict] = {}
    for batch in batches.values():
        key = f"{batch['manufacturer']}||{batch['sampleName']}"
        if key not in supplier_map:
            supplier_map[key] = {
                "manufacturer": batch["manufacturer"],
                "sampleName": batch["sampleName"],
                "totalBatches": 0,
                "inspectedBatches": 0,
                "qualifiedBatches": 0,
                "unqualifiedBatches": 0,
                "pendingBatches": 0,
                "qualifyRate": None,
            }
        stat = supplier_map[key]
        stat["totalBatches"] += 1

        if batch["has_unqualified"]:
            stat["inspectedBatches"] += 1
            stat["unqualifiedBatches"] += 1
        elif batch["has_completed"]:
            stat["inspectedBatches"] += 1
            stat["qualifiedBatches"] += 1
        else:
            stat["pendingBatches"] += 1

    # 计算合格率
    result = []
    for stat in supplier_map.values():
        rate = (
            round(stat["qualifiedBatches"] / stat["inspectedBatches"] * 100, 1)
            if stat["inspectedBatches"] > 0
            else None
        )
        stat["qualifyRate"] = rate
        result.append(stat)

    result.sort(key=lambda x: x["totalBatches"], reverse=True)
    return result


def build_material_stats(supplier_stats: list[dict] | None = None) -> list[dict]:
    """构建材料统计数据。逻辑移植自 stats-helpers.cjs 的 buildMaterialStats。"""
    if supplier_stats is None:
        supplier_stats = build_supplier_stats()

    material_map: dict[str, dict] = {}
    for stat in supplier_stats:
        sample_name = stat.get("sampleName", "")
        if not sample_name:
            continue
        if sample_name not in material_map:
            material_map[sample_name] = {
                "material": sample_name,
                "supplierCount": 0,
                "totalBatches": 0,
                "inspectedBatches": 0,
                "qualifiedBatches": 0,
                "avgQualifyRate": None,
            }
        material = material_map[sample_name]
        material["supplierCount"] += 1
        material["totalBatches"] += stat["totalBatches"]
        material["inspectedBatches"] += stat.get("inspectedBatches", 0)
        material["qualifiedBatches"] += stat["qualifiedBatches"]

    result = []
    for material in material_map.values():
        rate = (
            round(material["qualifiedBatches"] / material["inspectedBatches"] * 100, 1)
            if material["inspectedBatches"] > 0
            else None
        )
        material["avgQualifyRate"] = rate
        result.append(material)

    result.sort(key=lambda x: x["totalBatches"], reverse=True)
    return result


def categorize_test_item(test_item: str) -> str:
    """检测项归类。逻辑移植自 stats-helpers.cjs 的 categorizeTestItem。"""
    item = str(test_item or "")
    for pattern, category in _CATEGORY_PATTERNS:
        if re.search(pattern, item):
            return category
    return "其他"


def _requires_aging_deduction(test_item: str) -> bool:
    """判断检测项是否需要扣除老化时间。"""
    return bool(re.search(r"老化|盐雾|氙灯|紫外|耐候|汞灯|加热失重", str(test_item or "")))


def _parse_date(value) -> date | None:
    """解析日期字符串，返回 date 对象。"""
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    match = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", text)
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _day_key(d: date) -> str:
    return f"{d.year}-{d.month:02d}-{d.day:02d}"


def _get_holiday_year(calendar: dict, year: int) -> dict | None:
    if not calendar or "years" not in calendar:
        return None
    return calendar["years"].get(str(year)) or calendar["years"].get(year)


def _has_holiday_year(calendar: dict, year: int) -> bool:
    if not calendar:
        return False
    year_data = _get_holiday_year(calendar, year)
    return bool(
        year_data
        and ((year_data.get("offDays") or []) or (year_data.get("workDays") or []))
    )


def is_workday(d: date, calendar: dict | None = None) -> bool:
    """判断是否为工作日（考虑法定节假日和调休）。"""
    if not d:
        return False
    key = _day_key(d)

    if calendar:
        year_data = _get_holiday_year(calendar, d.year)
        off_days = set(year_data.get("offDays", []) if year_data else [])
        work_days = set(year_data.get("workDays", []) if year_data else [])

        if key in work_days:
            return True
        if key in off_days:
            return False

    # 周末判断
    return d.weekday() < 5  # 0=周一, 4=周五


def business_days_between(receive_date, test_date, calendar: dict | None = None) -> float | None:
    """计算两个日期之间的工作日数。当天收样当天完成计为0.5天。"""
    start = _parse_date(receive_date)
    end = _parse_date(test_date)
    if not start or not end or end < start:
        return None
    if start == end:
        return 0.5

    count = 0
    cursor = start + timedelta(days=1)
    while cursor <= end:
        if is_workday(cursor, calendar):
            count += 1
        cursor += timedelta(days=1)
    return float(count)


def _years_in_range(start: date, end: date) -> set[int]:
    return set(range(start.year, end.year + 1))


def build_timeliness_data() -> list[dict]:
    """构建检测时效性数据。

    逻辑移植自 stats-helpers.cjs 的 buildTimelinessData。
    """
    records = get_records()
    calendar = _cache.get("holidays")

    groups: dict[str, dict] = {}

    for record in records:
        test_item = record.get("testItem", "")
        if not test_item:
            continue

        sample_name = record.get("sampleName", "未知材料")
        key = f"{sample_name}||{test_item}"

        if key not in groups:
            groups[key] = {
                "category": sample_name,
                "testItem": test_item,
                "days": [],
                "missing_reasons": set(),
                "sample_count": 0,
            }

        group = groups[key]
        group["sample_count"] += 1

        receive_date = record.get("receiveDate")
        test_date = record.get("testDate")

        if not receive_date or not test_date:
            group["missing_reasons"].add("缺收样或检测日期")
            continue

        start = _parse_date(receive_date)
        end = _parse_date(test_date)

        if _requires_aging_deduction(test_item):
            group["missing_reasons"].add("缺老化时间规则")
            continue

        if start and end:
            years_needed = _years_in_range(start, end)
            has_all_holidays = all(_has_holiday_year(calendar, y) for y in years_needed)
            if not has_all_holidays:
                group["missing_reasons"].add("缺法定节假日数据")
                continue

        days = business_days_between(receive_date, test_date, calendar)
        if days is None:
            group["missing_reasons"].add("日期格式异常")
            continue

        group["days"].append(days)

    result = []
    for group in groups.values():
        days_list = group["days"]
        avg_days = (
            round(sum(days_list) / len(days_list), 1)
            if days_list
            else None
        )
        result.append({
            "category": group["category"],
            "testItem": group["testItem"],
            "testCategory": categorize_test_item(group["testItem"]),
            "avgDays": avg_days,
            "sampleCount": group["sample_count"],
            "validSampleCount": len(days_list),
            "missingReason": "、".join(group["missing_reasons"]) if group["missing_reasons"] else "",
        })

    result.sort(key=lambda x: x["sampleCount"], reverse=True)
    return result


def build_monthly_volume() -> list[dict]:
    """获取月度检测量数据。"""
    return _cache.get("monthly_volume", [])


def get_test_item_distribution() -> list[dict]:
    """获取检测项分类分布。"""
    return _cache.get("test_item_distribution", [])


def build_dashboard_data() -> dict:
    """构建总览工作台所需的聚合数据。"""
    devices = get_devices()
    main_devices = [d for d in devices if d.get("status") != "未到"]

    calib_normal = sum(1 for d in main_devices if d.get("calibrationStatus") == "正常")
    calib_soon = sum(1 for d in main_devices if d.get("calibrationStatus") == "即将到期")
    calib_expired = sum(1 for d in main_devices if d.get("calibrationStatus") == "已过期")

    return {
        "totalDevices": len(main_devices),
        "calibNormal": calib_normal,
        "calibSoon": calib_soon,
        "calibExpired": calib_expired,
        "activeDevices": sum(1 for d in main_devices if d.get("status") == "正常"),
        "idleDevices": sum(1 for d in main_devices if d.get("status") == "闲置"),
        "notArrivedDevices": sum(1 for d in devices if d.get("status") == "未到"),
        "devicesWithTests": sum(1 for d in main_devices if d.get("totalTests", 0) > 0),
        "noCalibData": sum(1 for d in main_devices if d.get("calibrationStatus") == "无校准数据"),
        "uniqueLocations": len({d.get("location") for d in main_devices if d.get("location")}),
        "materialStats": build_material_stats(),
        "testItemDistribution": get_test_item_distribution(),
        "monthlyVolume": build_monthly_volume(),
        "pipeline": get_pipeline(),
        "photoCount": get_photo_count(),
        "allRecordsCount": _cache.get("all_records_count", 0),
        "allRegRecordsCount": _cache.get("all_reg_records_count", 0),
        "inProgressCount": _cache.get("in_progress_count", 0),
        "pendingCount": _cache.get("pending_count", 0),
        "supplierInfoCount": _cache.get("supplier_info_count", 0),
    }


def get_volume_by_dimension(
    dimension: str = "month",
    start_month: str | None = None,
    end_month: str | None = None,
) -> list[dict]:
    """按时间维度聚合检测量。

    Args:
        dimension: month/quarter/year/week/custom
        start_month: 自定义起始月份（YYYY-MM）
        end_month: 自定义结束月份（YYYY-MM）
    """
    monthly = build_monthly_volume()

    if dimension in ("month", "custom"):
        data = monthly
        if dimension == "custom":
            data = [
                d for d in data
                if (not start_month or d["month"] >= start_month)
                and (not end_month or d["month"] <= end_month)
            ]
        return [
            {
                "label": d["month"],
                "total": d["total"],
                "qualified": d["qualified"],
                "unqualified": d["unqualified"],
            }
            for d in data
        ]

    if dimension == "quarter":
        quarters: dict[str, dict] = {}
        for d in monthly:
            parts = d["month"].split("-")
            year = parts[0]
            month = int(parts[1])
            q = (month - 1) // 3 + 1
            key = f"{year}Q{q}"
            if key not in quarters:
                quarters[key] = {"total": 0, "qualified": 0, "unqualified": 0}
            quarters[key]["total"] += d["total"]
            quarters[key]["qualified"] += d["qualified"]
            quarters[key]["unqualified"] += d["unqualified"]
        return [{"label": k, **v} for k, v in sorted(quarters.items())]

    if dimension == "year":
        years: dict[str, dict] = {}
        for d in monthly:
            year = d["month"].split("-")[0]
            if year not in years:
                years[year] = {"total": 0, "qualified": 0, "unqualified": 0}
            years[year]["total"] += d["total"]
            years[year]["qualified"] += d["qualified"]
            years[year]["unqualified"] += d["unqualified"]
        return [{"label": k, **v} for k, v in sorted(years.items())]

    if dimension == "week":
        weeks: dict[str, dict] = {}
        for d in monthly:
            parts = d["month"].split("-")
            year = int(parts[0])
            month = int(parts[1])
            # 近似周计算
            d_date = date(year, month, 1)
            one_jan = date(year, 1, 1)
            week = ((d_date - one_jan).days + one_jan.weekday() + 1) // 7 + 1
            key = f"{year}W{week:02d}"
            if key not in weeks:
                weeks[key] = {"total": 0, "qualified": 0, "unqualified": 0}
            weeks[key]["total"] += d["total"]
            weeks[key]["qualified"] += d["qualified"]
            weeks[key]["unqualified"] += d["unqualified"]
        return [{"label": k, **v} for k, v in sorted(weeks.items())]

    return []


def get_volume_by_supplier(
    manufacturers: list[str],
    dimension: str = "month",
) -> dict:
    """按供应商和时间维度对比检测量。"""
    records = get_records()
    filtered = [r for r in records if r.get("manufacturer") in manufacturers]

    period_set = set()
    grouped: dict[str, dict[str, dict]] = {}

    for r in filtered:
        test_date = r.get("testDate", "")
        if not test_date:
            continue

        parts = test_date.split("-")
        if len(parts) < 2:
            continue

        year = parts[0]
        month = parts[1]

        if dimension == "year":
            period = year
        elif dimension == "quarter":
            m = int(month)
            period = f"{year}Q{(m - 1) // 3 + 1}"
        elif dimension == "week":
            try:
                d_date = date(int(year), int(month), 1)
                one_jan = date(int(year), 1, 1)
                week = ((d_date - one_jan).days + one_jan.weekday() + 1) // 7 + 1
                period = f"{year}W{week:02d}"
            except ValueError:
                continue
        else:
            period = f"{year}-{month}"

        period_set.add(period)
        manufacturer = r.get("manufacturer", "")

        if period not in grouped:
            grouped[period] = {}
        if manufacturer not in grouped[period]:
            grouped[period][manufacturer] = {"total": 0, "qualified": 0, "unqualified": 0}

        grouped[period][manufacturer]["total"] += 1
        judgment = r.get("judgment", "")
        if judgment == "合格":
            grouped[period][manufacturer]["qualified"] += 1
        elif judgment == "不合格":
            grouped[period][manufacturer]["unqualified"] += 1

    periods = sorted(period_set)
    return {"periods": periods, "grouped": grouped, "suppliers": manufacturers}
