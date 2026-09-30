from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session, select

from app.deps import get_session
from app.models import User
from app.schemas import LoginRequest
from app.config import (
    ACCESS_TOKEN_EXPIRE_HOURS,
    LOGIN_MAX_FAILS,
    LOGIN_WINDOW_SECONDS,
    LOGIN_LOCK_SECONDS,
    TRUST_PROXY,
)
from app.deps import get_current_user
from app.utils.auth import verify_password, create_token, hash_password
from app.utils.rate_limit import LoginRateLimiter, format_wait

router = APIRouter(prefix="/api/auth", tags=["认证"])

# 登录限速器（进程内单例）
login_limiter = LoginRateLimiter(
    max_fails=LOGIN_MAX_FAILS,
    window_seconds=LOGIN_WINDOW_SECONDS,
    lock_seconds=LOGIN_LOCK_SECONDS,
)


def _client_ip(request: Request) -> str:
    """取客户端 IP。

    默认用 TCP 连接的远端地址（不可伪造）。只有显式开启 TRUST_PROXY 时，
    才采信反向代理写入的 X-Forwarded-For —— 否则前端可以随便伪造这个头来绕过限速。
    """
    if TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
        real = request.headers.get("x-real-ip")
        if real:
            return real.strip()
    return request.client.host if request.client else "unknown"


@router.post("/login")
def login(req: LoginRequest, request: Request, session: Session = Depends(get_session)):
    ip = _client_ip(request)

    # 先看这个 IP 是不是还在锁定中 —— 在锁定期内直接拒绝，连密码都不验
    wait = login_limiter.retry_after(ip)
    if wait > 0:
        raise HTTPException(
            status_code=429,
            detail=f"登录尝试过于频繁，请 {format_wait(wait)}后重试",
            headers={"Retry-After": str(wait)},
        )

    user = session.exec(select(User).where(User.username == req.username)).first()
    if not user or not verify_password(req.password, user.hashed_password):
        left = login_limiter.record_fail(ip)
        if left > 0:
            detail = f"用户名或密码错误（还可尝试 {left} 次）"
        else:
            detail = f"用户名或密码错误，已锁定 {format_wait(LOGIN_LOCK_SECONDS)}"
        raise HTTPException(status_code=401, detail=detail)

    # 登录成功，清掉这个 IP 的失败记录
    login_limiter.reset(ip)

    token = create_token({"sub": user.username, "admin": user.is_admin})
    expires = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    return {
        "code": 0,
        "message": "success",
        "data": {
            "accessToken": token,
            "refreshToken": "",
            "expires": expires.isoformat(),
            "avatar": user.avatar or "",
            "username": user.username,
            "nickname": user.nickname or user.username,
            "roles": ["admin"] if user.is_admin else [],
            "permissions": ["*:*:*"] if user.is_admin else [],
        },
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user), session: Session = Depends(get_session)):
    username = user.get("sub")
    db_user = session.exec(select(User).where(User.username == username)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return {
        "code": 0,
        "message": "success",
        "data": {
            "avatar": db_user.avatar or "",
            "username": db_user.username,
            "nickname": db_user.nickname or db_user.username,
            "email": db_user.email or "",
            "description": db_user.bio or "",
            "phone": "",
            "roles": ["admin"] if db_user.is_admin else [],
            "permissions": ["*:*:*"] if db_user.is_admin else [],
        },
    }


@router.put("/me")
def update_me(
    data: dict,
    user: dict = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    username = user.get("sub")
    db_user = session.exec(select(User).where(User.username == username)).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if "nickname" in data:
        db_user.nickname = data["nickname"]
    if "email" in data:
        db_user.email = data["email"]
    if "bio" in data or "description" in data:
        db_user.bio = data.get("bio") or data.get("description") or ""
    if "avatar" in data:
        db_user.avatar = data["avatar"]
    db_user.updated_at = datetime.now()
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return {"code": 0, "message": "更新成功"}
