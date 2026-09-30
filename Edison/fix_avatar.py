"""一次性处理博客头像：白底(伪透明) -> 真透明 + 裁剪内容 + 补正方形 + 缩放 512。

用法: python fix_avatar.py
处理后覆盖 public/images/avatar.png，博客前端无需任何改动。
"""

from PIL import Image, ImageDraw

SRC = r"D:/appppp/Kirameku/Kirameku/public/images/avatar.png"
WHITE_TOLERANCE = 30   # 泛洪容差：容忍白底上的轻微渐变/压缩噪点
ALPHA_THRESHOLD = 8    # 低于此 alpha 视为背景
TARGET = 512           # 输出尺寸

img = Image.open(SRC).convert("RGBA")

# 大图先缩到 1024 再处理（头像 512 足够，泛洪也快）
if max(img.size) > 1024:
    img.thumbnail((1024, 1024), Image.LANCZOS)
w, h = img.size

# 1) 从四角与四边中点泛洪：连续白色背景 -> 透明
#    只清掉与边缘连通的白色，人物内部的白色(高光/眼睛)不受影响
seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
         (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
for xy in seeds:
    ImageDraw.floodfill(img, xy, (0, 0, 0, 0), thresh=WHITE_TOLERANCE)

# 2) 按内容边界裁剪（四周留 2% 边距）
alpha = img.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
l, t, r, b = alpha.getbbox()
pad = int(max(r - l, b - t) * 0.02)
l, t = max(0, l - pad), max(0, t - pad)
r, b = min(w, r + pad), min(h, b + pad)
img = img.crop((l, t, r, b))
cw, ch = img.size

# 3) 补成正方形（透明填充），缩放到 512x512
side = max(cw, ch)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(img, ((side - cw) // 2, (side - ch) // 2))
canvas = canvas.resize((TARGET, TARGET), Image.LANCZOS)
canvas.save(SRC, optimize=True)
print(f"完成: 原图 {w}x{h} -> 裁剪 {cw}x{ch} -> 输出 {TARGET}x{TARGET} 真透明底")
