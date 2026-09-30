"""统一的时间源。

所有需要落库或返回给前端的时间，一律使用这里提供的 **带时区的 UTC**。

背景（重要，别改回去）：
    早期代码用 `datetime.now()`，它返回的是「朴素时间」（naive，不带 tzinfo），
    其真实含义完全取决于**宿主机所在时区**。线上服务器是 UTC、本地开发机是
    GMT+8，同一个函数产出直接差 8 小时；而 SQLAlchemy 的 SQLite 方言在读取时
    又会给朴素时间**强行补上 UTC 时区标签**，最终前端按访客本地时区渲染，
    就会出现「本地发的内容线上看晚 8 小时」的问题。

    统一走 `utcnow()` 后，写入、读取、序列化（带 Z）语义全程一致，
    不管部署到哪台机器、哪个时区都不会再漂移。
"""
from datetime import datetime, timezone


def utcnow() -> datetime:
    """返回当前时间，timezone-aware，固定为 UTC。"""
    return datetime.now(timezone.utc)
