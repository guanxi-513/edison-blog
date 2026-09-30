# -*- coding: utf-8 -*-
"""直接向 SQLite 插入一篇已发布文章（绕过登录，用于本地初始化内容）"""
from datetime import datetime
from sqlmodel import Session, select

from app.database import engine
from app.models.post import Post, Tag, PostTag

POST = {
    "title": "博客开张：大葱蘸酱の小站",
    "slug": "hello-world",
    "description": "小站正式开张。记录折腾、分享代码，一切从本地开始。",
    "content": (
        "# 博客开张\n\n"
        "折腾了一圈，博客总算跑起来了。\n\n"
        "这个站由 **Next.js 前端 + FastAPI 后端 + SQLite** 组成，"
        "前后端目前都跑在我自己的电脑上，数据也都是本地的——"
        "想写什么、想放什么，自己说了算。\n\n"
        "## 这里会写什么\n\n"
        "- **折腾记录**：踩过的坑、修过的 bug，比如让这个博客在本地跑起来就修了不少"
        "（Google 字体下载卡死、接口代理 404、头像白底转透明……）\n"
        "- **开发笔记**：音乐 App、微信小程序、各种小工具的思路和实现\n"
        "- **随想**：想到什么写什么\n\n"
        "## 关于我\n\n"
        "大葱蘸酱。代码是手段，不是目的；折腾本身即乐趣。\n\n"
        "> 站点还在慢慢搭，友链、相册、音乐都在陆续填内容。\n\n"
        "欢迎常来。"
    ),
    "cover": "",
    "status": "published",
    "is_pinned": True,
    "word_count": 320,
    "reading_time": 2,
    "tags": ["随笔", "开张"],
}

now = datetime.now()
with Session(engine) as session:
    # 幂等：slug 已存在则跳过
    existing = session.exec(select(Post).where(Post.slug == POST["slug"])).first()
    if existing:
        print(f"slug={POST['slug']} 已存在(id={existing.id})，跳过")
    else:
        post = Post(
            title=POST["title"], slug=POST["slug"],
            description=POST["description"], content=POST["content"],
            cover=POST["cover"], status=POST["status"],
            is_pinned=POST["is_pinned"],
            word_count=POST["word_count"], reading_time=POST["reading_time"],
            published_at=now, created_at=now, updated_at=now,
        )
        session.add(post)
        session.flush()  # 拿到 post.id
        for name in POST["tags"]:
            slug = {"随笔": "suibi", "开张": "kaizhang"}.get(name, name)
            tag = session.exec(select(Tag).where(Tag.name == name)).first()
            if not tag:
                tag = Tag(name=name, slug=slug)
                session.add(tag)
                session.flush()
            tag.post_count += 1
            session.add(PostTag(post_id=post.id, tag_id=tag.id))
        session.commit()
        print(f"发布成功: id={post.id} slug={post.slug} 标题={post.title}")
