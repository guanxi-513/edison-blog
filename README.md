<div align="center">

# Edison

**个人博客 · 全栈自建**

Next.js 前端 + FastAPI 后端 + Vue 管理后台，另附手机端发布 App。

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

## 项目结构

```
.
├── Edison/                  # 前端（Next.js 16 App Router）
│   ├── app/                 # 页面路由（文章 / 说说 / 相册 / 归档 / 关于 …）
│   ├── components/          # UI 组件（含天气卡、Live2D 看板娘）
│   └── siteConfig.ts        # 站点全局配置（站名、头像、社交链接、歌单）
│
├── edsion-backend/          # 后端（FastAPI + SQLModel + SQLite）
│   ├── app/api/             # RESTful 接口
│   ├── admin/dist/          # 管理后台构建产物（已内置，部署时无需重新构建）
│   ├── mobile/              # 手机端 H5 发布页（挂载在 /m）
│   ├── seed_admin.py        # 创建管理员账号
│   └── set_password.py      # 修改密码
│
├── edison-app/              # Android 壳（Capacitor，把 mobile/ 打成 APK）
├── 宝塔部署指南.md           # 上线部署步骤（宝塔面板）
└── DEPLOY_NOTES.md          # 部署踩坑记录
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 16 · React 19 · Tailwind CSS 4 · Framer Motion · TypeScript |
| 后端 | FastAPI · SQLModel · SQLite · JWT · 阿里云 OSS（可选，留空则存本地） |
| 管理后台 | Vue 3 · Element Plus · vue-pure-admin |
| 手机端 | 原生 H5（零依赖）+ Capacitor 8 打包 Android |

## 本地运行

**后端**（端口 8000）

```bash
cd edsion-backend
python -m venv venv
venv\Scripts\activate                 # Windows（Mac/Linux: source venv/bin/activate）
pip install -r requirements.txt
copy .env.example .env                # 填入 DATABASE_URL、SECRET_KEY 等
venv\Scripts\python.exe seed_admin.py # 创建管理员（密码取自 ADMIN_PASSWORD，未设则随机生成）
venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**前端**（端口 3000）

```bash
cd Edison
npm install
npm run dev
```

访问：博客 `http://localhost:3000` ｜ 管理后台 `http://localhost:8000/admin` ｜ 手机端 `http://localhost:8000/m`

## 部署

见 [宝塔部署指南.md](宝塔部署指南.md)。要点：

- **只需部署后端到服务器**，前端可在服务器上 `next build` 后运行，管理后台用仓库内已构建好的 `admin/dist`
- 上线前务必完成指南第七章的安全清单（改密码、限速、Nginx 反代需设 `TRUST_PROXY=true`）

## 手机端 App

`edison-app/` 是 Capacitor 壳工程，把 `edsion-backend/mobile/` 的 H5 打包成 Android APK：

```bash
cd edison-app
npx cap sync android
cd android && gradlew assembleDebug
```

产物：`edison-app/android/app/build/outputs/apk/debug/app-debug.apk`

## License

MIT。基于上游项目 [Xinghongia/Kirameku](https://github.com/Xinghongia/Kirameku) 改造，原版权声明保留于 [LICENSE](LICENSE)。
