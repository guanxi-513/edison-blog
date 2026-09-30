"""生成 Edison App 的图标与启动图（替换 Capacitor 默认蓝色图标）

源图：edsion-backend/mobile/logo.png（512×512 透明底）
用法：edsion-backend/venv/Scripts/python.exe edison-app/tools/gen_icons.py

生成内容：
  - mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png        方形图标（浅蓝底 + 头像）
  - 同目录 ic_launcher_round.png                                     圆形图标
  - 同目录 ic_launcher_foreground.png                                adaptive icon 前景（透明底，内容留安全边距）
  - drawable*/splash.png（11 张）                                     启动图（浅蓝底 + 居中头像），按原尺寸重建
底色由 ic_launcher_background.xml 的 #DCE7F7 保持一致。
"""
from pathlib import Path

from PIL import Image, ImageDraw

BG = (220, 231, 247, 255)  # #DCE7F7
SRC = Path(r"D:\appppp\Edison\edsion-backend\mobile\logo.png")
RES = Path(r"D:\appppp\Edison\edison-app\android\app\src\main\res")

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}


def fit(img: Image.Image, box: int, ratio: float) -> Image.Image:
    """等比缩放到 box*ratio 的方框内"""
    target = box * ratio
    w, h = img.size
    scale = min(target / w, target / h)
    return img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def compose(size: int, bg, ratio: float, circle: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg if bg else (0, 0, 0, 0))
    logo = fit(SRC_LOGO, size, ratio)
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    if circle:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(canvas, (0, 0), mask)
        return out
    return canvas


SRC_LOGO = Image.open(SRC).convert("RGBA")
made = []

# ---------- 应用图标 ----------
for dens, px in DENSITIES.items():
    d = RES / f"mipmap-{dens}"
    d.mkdir(parents=True, exist_ok=True)

    compose(px, BG, 0.78).save(d / "ic_launcher.png")
    compose(px, BG, 0.78, circle=True).save(d / "ic_launcher_round.png")
    made += [f"mipmap-{dens}/ic_launcher.png", f"mipmap-{dens}/ic_launcher_round.png"]

    # adaptive icon 前景：按现有文件尺寸生成，透明底 + 内容缩到安全区
    fg_path = d / "ic_launcher_foreground.png"
    fg_px = Image.open(fg_path).size[0] if fg_path.exists() else px * 2
    compose(fg_px, None, 0.62).save(fg_path)
    made.append(f"mipmap-{dens}/ic_launcher_foreground.png")

# ---------- 启动图（按各自原尺寸重建） ----------
for sp in sorted(RES.glob("drawable*/splash.png")):
    w, h = Image.open(sp).size
    canvas = Image.new("RGBA", (w, h), BG)
    logo = fit(SRC_LOGO, min(w, h), 0.5)
    canvas.alpha_composite(logo, ((w - logo.width) // 2, (h - logo.height) // 2))
    canvas.convert("RGB").save(sp)
    made.append(str(sp.relative_to(RES)).replace("\\", "/"))

print(f"共生成 {len(made)} 个文件：")
for m in made:
    print("  ", m)
