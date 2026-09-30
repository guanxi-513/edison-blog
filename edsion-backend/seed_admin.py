"""创建本地管理员账号（幂等：已存在则跳过）

密码**不写死在代码里**，按优先级取：
  1) 环境变量 ADMIN_PASSWORD（也可写在 .env 里，含特殊符号请加引号：ADMIN_PASSWORD='==+'）
  2) 都没有 → 随机生成一个强密码并打印出来，自己记下

用法：
  venv/Scripts/python.exe seed_admin.py

已有账号要改密码，用 set_password.py（本脚本不会覆盖已存在的账号）。
"""

import os
import secrets
import sys

sys.path.insert(0, ".")

from sqlmodel import Session, select

from app.database import engine, init_db
from app.models import User
from app.utils.auth import hash_password

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")

init_db()

with Session(engine) as session:
    existing = session.exec(select(User).where(User.username == ADMIN_USERNAME)).first()
    if existing:
        print(f"管理员「{ADMIN_USERNAME}」已存在，跳过（要改密码请用 set_password.py）")
        sys.exit(0)

    env_pwd = os.getenv("ADMIN_PASSWORD")
    password = env_pwd or secrets.token_urlsafe(12)

    user = User(
        username=ADMIN_USERNAME,
        hashed_password=hash_password(password),
        nickname="博主",
        is_admin=True,
    )
    session.add(user)
    session.commit()

    if env_pwd:
        print(f"管理员创建成功 → 用户名: {ADMIN_USERNAME}（密码取自 ADMIN_PASSWORD）")
    else:
        print(f"管理员创建成功 → 用户名: {ADMIN_USERNAME}")
        print(f"  随机密码: {password}")
        print("  ⚠️ 请立即记下，登录后到后台修改")
