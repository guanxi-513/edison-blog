"""手机端发布页冒烟测试：登录态 token → 上传图片 → 发说说 → 列表 → 切换状态 → 删除

不依赖密码：直接调用应用自身的 create_token 生成管理员令牌。
用法：./venv/Scripts/python.exe test_mobile_flow.py
"""
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.utils.auth import create_token  # noqa: E402

BASE = "http://127.0.0.1:8000"
TOKEN = create_token({"sub": "admin", "admin": True})
HEAD = {"Authorization": f"Bearer {TOKEN}"}


def req(method, path, data=None, headers=None, raw=None, ctype=None):
    url = BASE + path
    h = dict(HEAD)
    if headers:
        h.update(headers)
    body = None
    if raw is not None:
        body = raw
        if ctype:
            h["Content-Type"] = ctype
    elif data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            text = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(text) if text and text[0] in "[{" else text)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def multipart(field, filename, content, ctype="image/png"):
    boundary = "----edisonTestBoundary"
    body = b"".join([
        f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n".encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    return body, f"multipart/form-data; boundary={boundary}"


def main():
    fails = []

    # 0. 手机页可访问
    r = urllib.request.Request(BASE + "/m/", method="GET")
    with urllib.request.urlopen(r, timeout=15) as resp:
        html = resp.read().decode("utf-8", "replace")
    ok = resp.status == 200 and "Edison 发布" in html
    print(f"{'✓' if ok else '✗'} 手机页面 /m/ : {resp.status} {'含标题' if 'Edison 发布' in html else '缺标题'}")
    if not ok:
        fails.append("/m/ 页面")

    # 1. 生成一张小测试图
    try:
        from PIL import Image
        import io
        buf = io.BytesIO()
        Image.new("RGB", (240, 160), (91, 110, 225)).save(buf, "PNG")
        img_bytes = buf.getvalue()
    except ImportError:
        img_bytes = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000a49444154789c6360000002000100ffff03000006000557bfabd400"
            "00000049454e44ae426082"
        )

    # 2. 上传图片
    body, ctype = multipart("file", "test-shot.png", img_bytes)
    code, res = req("POST", "/api/upload/image", raw=body, ctype=ctype)
    url = res.get("url") if isinstance(res, dict) else None
    ok = code == 200 and bool(url)
    print(f"{'✓' if ok else '✗'} 图片上传: {code} {url}")
    if not ok:
        fails.append("上传图片")
    else:
        # 确认上传的文件可通过 /uploads 访问
        try:
            r = urllib.request.Request(BASE + url, method="GET")
            with urllib.request.urlopen(r, timeout=15) as resp:
                print(f"{'✓' if resp.status == 200 else '✗'} 图片可访问: {resp.status} {url}")
        except Exception as e:  # noqa: BLE001
            fails.append(f"图片访问 {e}")

    # 3. 发布说说
    payload = {"content": "[冒烟测试] 来自手机端的自动测试，稍后自动删除", "images": [url] if url else [],
               "mood": "测试", "status": "published"}
    code, res = req("POST", "/api/chatters", data=payload)
    cid = res.get("id") if isinstance(res, dict) else None
    ok = code == 200 and bool(cid)
    print(f"{'✓' if ok else '✗'} 发布说说: {code} id={cid} status={res.get('status') if isinstance(res, dict) else res}")
    if not ok:
        fails.append("发布说说")

    # 4. 管理列表
    code, res = req("GET", "/api/chatters/admin?page=1&size=20")
    found = isinstance(res, list) and any(x.get("id") == cid for x in res)
    print(f"{'✓' if code == 200 and found else '✗'} 管理列表: {code} 共{len(res) if isinstance(res, list) else '?'}条，含新建={found}")
    if not (code == 200 and found):
        fails.append("管理列表")

    # 5. 切换为草稿
    code, res = req("PUT", f"/api/chatters/{cid}", data={"status": "draft"})
    ok = code == 200 and isinstance(res, dict) and res.get("status") == "draft"
    print(f"{'✓' if ok else '✗'} 转为草稿: {code} status={res.get('status') if isinstance(res, dict) else res}")
    if not ok:
        fails.append("状态切换")

    # 6. 删除
    code, res = req("DELETE", f"/api/chatters/{cid}")
    print(f"{'✓' if code == 200 else '✗'} 删除说说: {code}")
    if code != 200:
        fails.append("删除说说")

    # 清理测试图片文件（脚本位于 edsion-backend/ 下，uploads/ 与它同级）
    if url:
        f = Path(__file__).resolve().parent / url.lstrip("/")
        if f.exists():
            f.unlink()
            print(f"✓ 已清理测试图片 {f.name}")

    print("\n" + ("全部通过 ✓" if not fails else f"失败项: {', '.join(fails)}"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
