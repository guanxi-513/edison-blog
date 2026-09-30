import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)

DATABASE_URL = os.environ["DATABASE_URL"]
SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

# CORS 允许的来源，两层：
#  1) 显式白名单（.env 的 CORS_ORIGINS 可覆盖，逗号分隔）—— 固定域名放这里
#  2) 正则兜底 —— 覆盖两类没法写死的场景：
#     · 手机 App：Capacitor 打包后页面源是 https://localhost（androidScheme=https）
#     · 局域网 IP 访问：手机浏览器直接开 http://192.168.x.x:8000/m/，DHCP 换 IP 也不用改配置
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,"
    "https://localhost,http://localhost,capacitor://localhost",
).split(",")

CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"^(https?|capacitor|ionic)://("
    r"localhost|127\.0\.0\.1"
    r"|192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(?::\d+)?$",
)

# 登录限速（防暴力破解）：同一 IP 在 LOGIN_WINDOW_SECONDS 秒内失败 LOGIN_MAX_FAILS 次 → 锁定 LOGIN_LOCK_SECONDS 秒
LOGIN_MAX_FAILS = int(os.getenv("LOGIN_MAX_FAILS", "5"))
LOGIN_WINDOW_SECONDS = int(os.getenv("LOGIN_WINDOW_SECONDS", "900"))
LOGIN_LOCK_SECONDS = int(os.getenv("LOGIN_LOCK_SECONDS", "300"))

# 是否信任反向代理的 X-Forwarded-For。
# 部署到宝塔/Nginx 反代后必须设为 true，否则所有请求的来源 IP 都会变成 127.0.0.1，
# 导致「限速会把所有人算成同一个 IP」。本机直连（未过代理）时保持 false，
# 否则攻击者可以伪造 X-Forwarded-For 绕过限速。
TRUST_PROXY = os.getenv("TRUST_PROXY", "false").strip().lower() in ("1", "true", "yes", "on")

# GitHub OAuth
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")

# 阿里云 OSS 配置（本地开发可不填，留空时上传自动降级保存到本地 uploads/ 目录）
OSS_ACCESS_KEY_ID = os.getenv("OSS_ACCESS_KEY_ID", "")
OSS_ACCESS_KEY_SECRET = os.getenv("OSS_ACCESS_KEY_SECRET", "")
OSS_BUCKET_NAME = os.getenv("OSS_BUCKET_NAME", "")
OSS_ENDPOINT = os.getenv("OSS_ENDPOINT", "")
OSS_CUSTOM_DOMAIN = os.getenv("OSS_CUSTOM_DOMAIN", "")
OSS_PREFIX = os.getenv("OSS_PREFIX", "")

# OSS 是否已完整配置
OSS_ENABLED = all([OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_NAME, OSS_ENDPOINT, OSS_CUSTOM_DOMAIN])
