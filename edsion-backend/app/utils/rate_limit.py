"""登录限速（纯内存、零依赖）

适用场景：单进程 uvicorn（`--host 0.0.0.0 --port 8000`，没带 `--workers`）。
内存字典在多进程下各算各的，若以后改成多 worker，需要换成 Redis 之类共享存储。

策略 = 滑动窗口 + 触发后锁定：
  · 同一 IP 在 WINDOW 秒内失败达到 MAX 次  → 锁定 LOCK 秒
  · 锁定期间该 IP 的一切登录请求直接 429，不再去验密码（省掉 bcrypt 的 CPU，也算挡了一道）
  · 登录成功即清空该 IP 的失败记录

为什么按 IP 而不是按用户名：按用户名锁，攻击者换个用户名就能继续；
按 IP 锁能同时挡住「撞库」和「同一账号爆破」两种打法。
"""

import threading
import time
from collections import deque


class LoginRateLimiter:
    def __init__(self, max_fails: int, window_seconds: int, lock_seconds: int):
        self.max_fails = max_fails
        self.window = window_seconds
        self.lock = lock_seconds
        self._fails: dict[str, deque] = {}
        self._mu = threading.Lock()

    def _prune(self, key: str, now: float):
        """丢掉窗口外的失败记录；返回剩余的 deque（空则返回 None 并回收 key）"""
        dq = self._fails.get(key)
        if not dq:
            return None
        while dq and now - dq[0] > self.window:
            dq.popleft()
        if not dq:
            self._fails.pop(key, None)
            return None
        return dq

    def retry_after(self, key: str) -> int:
        """返回该 key 还需等待的秒数；0 表示可以尝试登录"""
        now = time.time()
        with self._mu:
            dq = self._prune(key, now)
            if not dq or len(dq) < self.max_fails:
                return 0
            wait = self.lock - (now - dq[-1])
            return int(wait) + 1 if wait > 0 else 0

    def record_fail(self, key: str) -> int:
        """记一次失败，返回剩余可尝试次数（0 表示刚刚触发锁定）"""
        now = time.time()
        with self._mu:
            dq = self._fails.setdefault(key, deque())
            dq.append(now)
            dq = self._prune(key, now) or deque([now])
            return max(0, self.max_fails - len(dq))

    def reset(self, key: str):
        """登录成功后清空该 key 的失败记录"""
        with self._mu:
            self._fails.pop(key, None)

    def clear_all(self):
        """清空全部记录（主要给测试用）"""
        with self._mu:
            self._fails.clear()


def format_wait(seconds: int) -> str:
    """把秒数说成人话：90 → 1 分 30 秒"""
    seconds = max(1, int(seconds))
    if seconds < 60:
        return f"{seconds} 秒"
    m, s = divmod(seconds, 60)
    return f"{m} 分 {s} 秒" if s else f"{m} 分钟"
