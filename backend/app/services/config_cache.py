"""配置数据内存缓存。

启动时加载 test_item_configs 全表到内存，避免每次识别都查库。
配置为静态数据，变更后需重启服务或调用 reload_config_cache。
"""
import json
import logging
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.test_item_config import TestItemConfig

logger = logging.getLogger(__name__)

# 内存缓存：{(device_key, sample_name): [config_dict, ...]}
CONFIG_CACHE: dict[tuple[str, str], list[dict]] = {}

# 设备列表缓存：[(device_key, device_name), ...]
DEVICE_LIST_CACHE: list[tuple[str, str]] = []

# 样品列表缓存：{device_key: [(sample_name, material_spec), ...]}
SAMPLE_LIST_CACHE: dict[str, list[tuple[str, str | None]]] = {}

# 图片说明缓存：{(device_name, sample_name): description}
IMAGE_DESC_CACHE: dict[tuple[str, str], str] = {}

_loaded = False


async def load_config_cache(db: AsyncSession) -> None:
    """加载全部 test_item_configs 到内存缓存。应在应用启动时调用。"""
    global _loaded

    result = await db.execute(select(TestItemConfig))
    configs = result.scalars().all()

    CONFIG_CACHE.clear()
    DEVICE_LIST_CACHE.clear()
    SAMPLE_LIST_CACHE.clear()

    seen_devices = set()
    seen_samples: dict[str, set[str]] = {}

    for cfg in configs:
        key = (cfg.device_key, cfg.sample_name)
        cfg_dict = {
            "id": cfg.id,
            "device_name": cfg.device_name,
            "device_key": cfg.device_key,
            "sample_name": cfg.sample_name,
            "material_spec": cfg.material_spec,
            "judgment_standard": cfg.judgment_standard,
            "group_key": cfg.group_key,
            "group_item_count": cfg.group_item_count,
            "test_item": cfg.test_item,
            "sub_item": cfg.sub_item,
            "judgment_indicator": cfg.judgment_indicator,
            "test_standard": cfg.test_standard,
            "extraction_rule": cfg.extraction_rule,
            "aggregation_method": cfg.aggregation_method,
            "sample_count": cfg.sample_count,
            "needs_subtable": cfg.needs_subtable,
            "report_section": cfg.report_section,
        }
        CONFIG_CACHE.setdefault(key, []).append(cfg_dict)

        # 设备列表去重
        if cfg.device_key not in seen_devices:
            seen_devices.add(cfg.device_key)
            DEVICE_LIST_CACHE.append((cfg.device_key, cfg.device_name))

        # 样品列表按设备分组去重
        if cfg.device_key not in seen_samples:
            seen_samples[cfg.device_key] = set()
        if cfg.sample_name not in seen_samples[cfg.device_key]:
            seen_samples[cfg.device_key].add(cfg.sample_name)
            SAMPLE_LIST_CACHE.setdefault(cfg.device_key, []).append(
                (cfg.sample_name, cfg.material_spec)
            )

    _loaded = True
    _load_image_descriptions()
    logger.info(f"配置缓存已加载: {len(CONFIG_CACHE)} 组配置，{len(DEVICE_LIST_CACHE)} 类设备，{len(IMAGE_DESC_CACHE)} 条图片说明")


def _load_image_descriptions() -> None:
    """从 data/image_descriptions.json 加载图片说明到内存缓存。"""
    IMAGE_DESC_CACHE.clear()
    desc_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "image_descriptions.json")
    if not os.path.exists(desc_path):
        logger.warning(f"图片说明文件不存在: {desc_path}")
        return
    try:
        with open(desc_path, "r", encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            device_name = item.get("device_name", "")
            sample_name = item.get("sample_name", "")
            desc = item.get("image_description", "")
            if device_name and desc:
                IMAGE_DESC_CACHE[(device_name, sample_name)] = desc
        logger.info(f"图片说明已加载: {len(IMAGE_DESC_CACHE)} 条")
    except Exception as e:
        logger.warning(f"加载图片说明失败: {e}")


def get_configs(device_key: str, sample_name: str) -> list[dict]:
    """从缓存获取指定设备+样品的配置列表。"""
    return CONFIG_CACHE.get((device_key, sample_name), [])


def get_devices() -> list[tuple[str, str]]:
    """从缓存获取设备列表。"""
    return DEVICE_LIST_CACHE


def get_samples(device_key: str) -> list[tuple[str, str | None]]:
    """从缓存获取指定设备的样品列表。"""
    return SAMPLE_LIST_CACHE.get(device_key, [])


def is_loaded() -> bool:
    return _loaded


def get_image_description(device_name: str, sample_name: str) -> str | None:
    """从缓存获取指定设备+样品的图片说明（K列文字）。

    优先精确匹配 device_name+sample_name，未命中则尝试只按 device_name 匹配。
    """
    desc = IMAGE_DESC_CACHE.get((device_name, sample_name))
    if desc:
        return desc
    # fallback: 只按 device_name 匹配（样品名可能略有差异）
    for (dn, sn), d in IMAGE_DESC_CACHE.items():
        if dn == device_name:
            return d
    return None
