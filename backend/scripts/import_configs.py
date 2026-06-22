"""将 data/test_item_configs.json 导入到数据库 test_item_configs 表。

用法：
    cd backend
    set PYTHONPATH=.
    uv run python scripts/import_configs.py
"""
import asyncio
import json
import sys
from pathlib import Path

# 确保可以导入 app 包
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, delete
from app.db.base import async_session
from app.models.test_item_config import TestItemConfig


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "test_item_configs.json"


async def import_configs():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        configs = json.load(f)

    print(f"待导入配置数: {len(configs)}")

    async with async_session() as db:
        # 清空旧数据（幂等导入）
        async with db.begin():
            await db.execute(delete(TestItemConfig))

        # 批量插入
        async with db.begin():
            for cfg in configs:
                db.add(TestItemConfig(**cfg))

    print(f"成功导入 {len(configs)} 条配置")

    # 验证
    async with async_session() as db:
        result = await db.execute(select(TestItemConfig))
        rows = result.scalars().all()
        devices = sorted({r.device_key for r in rows})
        groups = sorted({r.group_key for r in rows})
        print(f"验证: 共 {len(rows)} 条配置，{len(devices)} 类设备，{len(groups)} 个配置组")
        print(f"设备列表: {devices}")


if __name__ == "__main__":
    asyncio.run(import_configs())
