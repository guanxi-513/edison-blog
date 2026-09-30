"""设置 / 修改账号密码（幂等：账号存在就更新，不存在就报错）

密码只以 bcrypt 加盐 hash 存进数据库，**明文不写入任何文件**。

用法：
  venv/Scripts/python.exe set_password.py                       # 交互式输入（推荐，不回显）
  venv/Scripts/python.exe set_password.py --user admin          # 指定账号，交互式输入
  venv/Scripts/python.exe set_password.py --user admin 新密码   # 命令行直接传（会留在 shell 历史里，慎用）

注意：含 `=` `!` `$` `*` 等符号的密码请用单引号包住，例如
  venv/Scripts/python.exe set_password.py --user admin '==+'
"""

import argparse
import getpass
import os
import sys

sys.path.insert(0, ".")

from sqlmodel import Session, select

from app.database import engine, init_db
from app.models import User
from app.utils.auth import hash_password


def main() -> int:
    ap = argparse.ArgumentParser(description="设置 / 修改账号密码")
    ap.add_argument("password", nargs="?", help="新密码；省略则交互式输入（更安全）")
    ap.add_argument("--user", default=os.getenv("ADMIN_USERNAME", "admin"), help="用户名，默认 admin")
    args = ap.parse_args()

    pwd = args.password
    if pwd is None:
        p1 = getpass.getpass("请输入新密码: ")
        p2 = getpass.getpass("再输一次确认: ")
        if p1 != p2:
            print("✗ 两次输入不一致")
            return 1
        pwd = p1

    if not pwd:
        print("✗ 密码不能为空")
        return 1

    # bcrypt 上限 72 字节，超了会直接抛异常，这里提前给出人话
    if len(pwd.encode("utf-8")) > 72:
        print("✗ 密码过长（bcrypt 上限 72 字节）")
        return 1

    init_db()
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == args.user)).first()
        if not user:
            print(f"✗ 用户「{args.user}」不存在")
            print("  如需新建管理员，先执行：venv/Scripts/python.exe seed_admin.py")
            return 1
        user.hashed_password = hash_password(pwd)
        session.add(user)
        session.commit()

    print(f"✓ 已更新「{args.user}」的密码（{len(pwd)} 个字符，bcrypt 加盐存储）")
    print("  改密码不需要重启后端 —— 密码是实时查数据库的")
    return 0


if __name__ == "__main__":
    sys.exit(main())
