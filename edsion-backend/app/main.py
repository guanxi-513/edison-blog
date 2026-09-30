from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS, CORS_ORIGIN_REGEX
from app.database import init_db
from app.api import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="edsion Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 一行挂载所有 API 路由
app.include_router(api_router)

# 挂载上传文件目录
uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# 挂载 Vue 管理后台
admin_dist = Path(__file__).resolve().parent.parent / "admin" / "dist"
if admin_dist.exists():
    app.mount("/admin", StaticFiles(directory=str(admin_dist), html=True), name="admin")

# 挂载手机端发布页（手机浏览器访问 http://<本机IP>:8000/m ）
mobile_dir = Path(__file__).resolve().parent.parent / "mobile"
if mobile_dir.exists():
    app.mount("/m", StaticFiles(directory=str(mobile_dir), html=True), name="mobile")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/routes")
def get_routes():
    return {"code": 0, "message": "success", "data": []}
