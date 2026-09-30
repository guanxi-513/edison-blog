"""手机端「照片」tab 冒烟测试：建相册 → 上传图 → 入相册 → 查照片 → 计数 → 删照片 → 删相册

不依赖密码：直接调用应用自身的 create_token 生成管理员令牌。
用法：./venv/Scripts/python.exe test_photo_flow.py
"""
import io
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.utils.auth import create_token  # noqa: E402

BASE = "http://127.0.0.1:8000"
TOKEN = create_token({"sub": "admin", "admin": True})
HEAD = {"Authorization": f"Bearer {TOKEN}"}


def req(method, path, data=None, raw=None, ctype=None):
    h = dict(HEAD)
    body = None
    if raw is not None:
        body = raw
        if ctype:
            h["Content-Type"] = ctype
    elif data is not None:
        body = json.dumps(data).encode()
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(BASE + path, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            text = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(text) if text and text[0] in "[{" else text)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def multipart(field, filename, content, ctype="image/png"):
    boundary = "----edisonPhotoBoundary"
    body = b"".join([
        f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
        f"Content-Type: {ctype}\r\n\r\n".encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    return body, f"multipart/form-data; boundary={boundary}"


def main():
    fails = []
    album_id = photo_id = url = None

    # 1. 建一个竖版测试图（顺便验证 orientation=portrait 判定）
    try:
        from PIL import Image
        buf = io.BytesIO()
        Image.new("RGB", (160, 240), (91, 110, 225)).save(buf, "PNG")
        img_bytes = buf.getvalue()
    except ImportError:
        img_bytes = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000a49444154789c6360000002000100ffff03000006000557bfabd400"
            "00000049454e44ae426082"
        )

    try:
        # 2. 新建相册
        code, res = req("POST", "/api/albums", data={"title": "[冒烟测试] 临时相册"})
        album_id = res.get("id") if isinstance(res, dict) else None
        ok = code == 200 and bool(album_id)
        print(f"{'✓' if ok else '✗'} 新建相册: {code} id={album_id}")
        if not ok:
            fails.append("新建相册")
            return finish(fails)

        # 3. 上传图片
        body, ctype = multipart("file", "portrait-shot.png", img_bytes)
        code, res = req("POST", "/api/upload/image", raw=body, ctype=ctype)
        url = res.get("url") if isinstance(res, dict) else None
        orientation = res.get("orientation") if isinstance(res, dict) else None
        ok = code == 200 and bool(url)
        print(f"{'✓' if ok else '✗'} 上传图片: {code} {url} orientation={orientation}")
        if not ok:
            fails.append("上传图片")
            return finish(fails)
        if orientation != "portrait":
            print(f"! 竖图方向判定为 {orientation}（期望 portrait）")

        # 4. 入相册
        code, res = req("POST", "/api/albums/photos", data={
            "album_id": album_id, "url": url, "caption": "", "orientation": orientation or "landscape",
        })
        photo_id = res.get("id") if isinstance(res, dict) else None
        ok = code == 200 and bool(photo_id)
        print(f"{'✓' if ok else '✗'} 照片入相册: {code} photo_id={photo_id}")
        if not ok:
            fails.append("照片入相册")
            return finish(fails)

        # 5. 查相册照片
        code, res = req("GET", f"/api/albums/{album_id}/photos")
        found = isinstance(res, list) and any(p.get("id") == photo_id for p in res)
        print(f"{'✓' if code == 200 and found else '✗'} 相册照片列表: {code} 共{len(res) if isinstance(res, list) else '?'}张，含新照片={found}")
        if not (code == 200 and found):
            fails.append("相册照片列表")

        # 6. photo_count 计数
        code, res = req("GET", "/api/albums")
        cnt = None
        if isinstance(res, list):
            for a in res:
                if a.get("id") == album_id:
                    cnt = a.get("photo_count")
        ok = cnt == 1
        print(f"{'✓' if ok else '✗'} 相册计数 photo_count: {cnt} (期望 1)")
        if not ok:
            fails.append("photo_count")

        # 7. 删照片
        code, _ = req("DELETE", f"/api/albums/photos/{photo_id}")
        print(f"{'✓' if code == 200 else '✗'} 删除照片: {code}")
        if code != 200:
            fails.append("删除照片")
        photo_id = None

        code, res = req("GET", "/api/albums")
        cnt = None
        if isinstance(res, list):
            for a in res:
                if a.get("id") == album_id:
                    cnt = a.get("photo_count")
        ok = cnt == 0
        print(f"{'✓' if ok else '✗'} 删后计数 photo_count: {cnt} (期望 0)")
        if not ok:
            fails.append("删后计数")

        # 8. 清理相册
        code, _ = req("DELETE", f"/api/albums/{album_id}")
        print(f"{'✓' if code == 200 else '✗'} 删除测试相册: {code}")
        if code != 200:
            fails.append("删除相册")
        album_id = None
    finally:
        if photo_id:
            req("DELETE", f"/api/albums/photos/{photo_id}")
        if album_id:
            req("DELETE", f"/api/albums/{album_id}")
        if url:
            f = Path(__file__).resolve().parent / url.lstrip("/")
            if f.exists():
                f.unlink()
                print(f"✓ 已清理测试图片 {f.name}")

    return finish(fails)


def finish(fails):
    print("\n" + ("全部通过 ✓" if not fails else f"失败项: {', '.join(fails)}"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
