"""聚合函数：将多试样原始值聚合为最终结果值。"""
from statistics import median


def aggregate(values: list[float], method: str) -> float | None:
    """按指定方式聚合原始值列表。

    Args:
        values: 原始值列表
        method: 聚合方式
            - average: 平均值
            - median: 中值
            - max: 最大值
            - abs_max: 绝对值最大值
            - single / direct: 直取第一个值

    Returns:
        聚合结果，空列表返回 None
    """
    if not values:
        return None

    # 过滤 None
    clean = [v for v in values if v is not None]
    if not clean:
        return None

    if method == "average":
        return round(sum(clean) / len(clean), 2)
    elif method == "median":
        return round(median(clean), 2)
    elif method == "max":
        return round(max(clean), 2)
    elif method == "abs_max":
        return round(max(abs(v) for v in clean), 2)
    elif method in ("single", "direct"):
        return round(clean[0], 2)
    return None
