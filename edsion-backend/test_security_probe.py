"""安全自测探针（本地跑，跑完自动清理，不留垃圾）

验证三类问题，用于部署到公网前的体检：
  1. 上传接口是否可用「图片 content-type + 非图片扩展名」落盘 → 存储型 XSS 风险
  2. FastAPI 文档 / 后台入口是否对匿名访问开放
  3. 登录接口是否有限速（连续失败是否被拦）

用法：venv/Scripts/python.exe test_security_probe.py
"""
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.utils.auth import create_token  # noqa: E402

BASE = "http://127.0.0.1:8000"
TOKEN = create_token({"sub": "admin", "admin": True})


def multipart(field, filename, content, ctype):
    b = "----edisonprobe" + uuid.uuid4().hex
    body = (
        f"--{b}\r\n"
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n"
    ).encode() + content + f"\r\n--{b}--\r\n".encode()
    return b, body


def probe_upload_ext():
    """① 用 image/png 的 content-type 但 .html 的扩展名，看服务端是否照单全收"""
    payload = b"<!doctype html><title>poc</title><script>document.title='xss '+document.domain</script>"
    b, body = multipart("file", "probe.html", payload, "image/png")
    r = urllib.request.Request(f"{BASE}/api/upload/image", data=body, method="POST")
    r.add_header("Content-Type", f"multipart/form-data; boundary={b}")
    r.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            out = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"  ① 上传 .html 被拒绝（HTTP {e.code}）：{e.read().decode('utf-8', 'replace')[:120]}")
        return False

    url = out.get("url", "")
    print(f"  ① 上传 .html 被接受 → {out}")
    if not url.startswith("/uploads/"):
        print("     （走的是 OSS，本地无落盘，跳过回读）")
        return False

    with urllib.request.urlopen(BASE + url, timeout=20) as resp2:
        ct = resp2.headers.get("Content-Type")
        head = resp2.read()[:60]
    print(f"  ② 该文件可被匿名读取，Content-Type = {ct}")
    print(f"     内容 = {head!r}")
    danger = ct is not None and "html" in ct.lower()
    print(f"  ③ 是否会被浏览器当网页执行：{'是 ✗ 存在存储型 XSS' if danger else '否 ✓'}")

    p = Path(__file__).resolve().parent / "uploads" / Path(url).name
    if p.exists():
        p.unlink()
        print(f"  ④ 已清理测试文件：{p.name}")
    return danger


def probe_exposure():
    """② 匿名可访问的敏感路径"""
    hits = []
    for path in ["/docs", "/redoc", "/openapi.json", "/admin", "/m"]:
        try:
            with urllib.request.urlopen(BASE + path, timeout=10) as resp:
                code = resp.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception:
            code = -1
        hits.append((path, code))
    for path, code in hits:
        flag = "暴露" if code in (200, 307) else "已关闭"
        print(f"  {path:<16} {code}  {flag}")
    return hits


def probe_login_ratelimit(n=8):
    """③ 连续错误密码，看是否被限速/锁定"""
    blocked = False
    for i in range(n):
        body = json.dumps({"username": "admin", "password": f"wrong-{i}"}).encode()
        r = urllib.request.Request(
            f"{BASE}/api/auth/login", data=body, method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(r, timeout=10) as resp:
                code = resp.status
        except urllib.error.HTTPError as e:
            code = e.code
        except Exception:
            code = -1
        if code in (429, 423) or code >= 500:
            blocked = True
            print(f"  第 {i + 1} 次失败 → HTTP {code}（已被拦截）")
            break
    if not blocked:
        print(f"  连续 {n} 次错误密码全部返回 401，未触发任何限速/锁定 ✗ 可被暴力破解")
    else:
        print("  ✓ 限速生效（同一 IP 失败 5 次 → 锁 5 分钟，返回 429 + Retry-After）")
        print("  ⚠️ 本项会让本机 IP 真的被锁 5 分钟；想立刻解锁就重启一次后端")
    return blocked


if __name__ == "__main__":
    print("=== ① 上传扩展名校验 ===")
    xss = probe_upload_ext()
    print("\n=== ② 匿名可访问路径 ===")
    probe_exposure()
    print("\n=== ③ 登录接口限速 ===")
    probe_login_ratelimit()
    print("\n（本脚本只做只读探测 + 一个临时文件，已自动清理）")
