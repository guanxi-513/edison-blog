# Live2D 看板娘模型上传指导（交接给豆包）

> 适用项目：Edison 个人博客（Next.js 16 前端 + Nginx 反代 + 宝塔面板）
> 目标：把本地 `Edison/public/live2d/model/` 整个目录补传到服务器，让网站右下角的看板娘显示出来。

> ✅ **2026-09-30 更新：本步骤已在服务器上完成，不用再做了。**
> 实测 `110.42.51.221` 的 `/www/wwwroot/blog/Edison/public/live2d/model/` 下已有 **24 个模型目录**，
> `GET http://110.42.51.221:8081/live2d/model_list.json` 返回 **200**，模型文件可正常访问。
> 本文档**留档备用**（换服务器 / 重装环境时再走一遍即可）。
> 唯一还值得做的是 **第 7 节**：给 Nginx 加 `/live2d/` 直出 + 30 天缓存（否则 216MB 模型每次刷新重下）。

---

## 0. 一句话结论

**看板娘的代码早就部署好了，缺的只是模型文件。**

模型目录 216MB，因为太大被 `.gitignore` 排除在仓库之外，所以豆包从 GitHub 拉代码部署时，`model/` 根本没有下到服务器 → 看板娘脚本能加载，但拉模型文件全部 404 → 网页右下角一片空白。

**本次任务就一件事：把一个目录原样搬到服务器上，不用改任何代码、不用重新构建。**

---

## 1. 背景对照（先确认"缺的是什么"）

| `Edison/public/live2d/` 下的内容 | 是否在 git 仓库里 | 服务器现状 | 本次要不要处理 |
|---|---|---|---|
| `jsdelivr/`（autoload.js、waifu-tips.js） | ✅ 已跟踪 | 已有 | ❌ 不用管 |
| `css/left.css`、`css/right.css` | ✅ 已跟踪 | 已有 | ❌ 不用管 |
| `img/01.png`、`img/02.png` | ✅ 已跟踪 | 已有 | ❌ 不用管 |
| `live2d.min.js`、`asteroids.js` | ✅ 已跟踪 | 已有 | ❌ 不用管 |
| `model_list.json`、`waifu-tips.json` | ✅ 已跟踪 | 已有 | ❌ 不用管 |
| **`model/`（24 个模型目录 / 1166 个文件 / 216MB）** | ❌ **被 .gitignore 排除** | **不存在** | ✅ **本次只传这个** |

排除规则在仓库根目录 `.gitignore` 第 85 行：

```
Edison/public/live2d/model/
```

> 这是有意为之，**不要**为了传模型而把它加回 git（216MB 进 git 会让仓库爆炸）。以后换服务器同样手工传一次即可。

---

## 2. 目标路径（先让豆包确认"项目根目录"在哪）

服务器上最终要形成：

```
<项目根目录>/Edison/public/live2d/model/95type ... AK12 ... za   ← 24 个模型目录
```

因为我们不知道豆包实际把项目放哪了，**动手前先定位**：

```bash
# ① PM2 / Node 项目管理器里看进程的工作目录
pm2 list          # 宝塔 Node 项目管理器通常也用 pm2
pm2 info <name> | grep -i "exec cwd\|script path"

# ② 常见位置直接看
ls -ld /www/wwwroot/*/Edison /www/wwwroot/*/  2>/dev/null

# ③ 从 Nginx 配置反查站点根
nginx -T 2>/dev/null | grep -n "proxy_pass http://127.0.0.1:3000" -B 8
```

下文统一用 **`/www/wwwroot/blog/Edison`** 举例，**请全部替换成你查到的实际路径**。

---

## 3. 第一步：本地打包（在 Windows 上做）

### ⚠️ 必须用 tar.gz，不要用 Windows 右键"压缩成 zip"

`model/kp31/kp31_/destroy/替换配置/model.json` 里有一个**中文目录名**。用 Windows 资源管理器打包 zip 会用 GBK 编码记录文件名，解压到 Linux 会变成乱码目录（虽然不影响看板娘运行，但属于隐患）。`tar` 按原始字节记录，不会有这个问题。

在 **Git Bash 或 PowerShell**（Windows 10+ 自带 `tar`）执行：

```bash
cd /d/appppp/Edison/Edison/public/live2d      # PowerShell 用 cd D:\appppp\Edison\Edison\public\live2d
tar -czf live2d-model.tar.gz model
```

产物：**`live2d-model.tar.gz`，约 172MB**（原目录 216MB）。

> 我已经替你打好了这个包，放在 **`D:\appppp\live2d-model.tar.gz`**（172MB，在 git 仓库外面，不会污染版本库），可以直接跳过这一步拿它上传。

---

## 4. 第二步：上传到服务器（三选一，推荐 A）

### 方案 A：scp（推荐，一条命令）

在本地（Windows 终端）执行：

```bash
scp D:\appppp\live2d-model.tar.gz root@<服务器IP>:/tmp/
```

传完到服务器上继续第 5 步。172MB 视带宽，通常 1–5 分钟。

### 方案 B：rsync（断点续传，网络不稳用这个）

直接同步目录内容，断了重跑会接着传，不会从头开始：

```bash
rsync -avP --partial \
  D:/appppp/Edison/Edison/public/live2d/model/ \
  root@<服务器IP>:/www/wwwroot/blog/Edison/public/live2d/model/
```

⚠️ 注意源路径结尾的 **`/`** 必须写：`model/` 表示"把 model 里面的内容"同步过去。
缺点是 1166 个小文件逐个传，比传单个 tar 慢一些。传完可直接跳到第 6 步验证。

### 方案 C：宝塔文件管理器上传（不推荐，仅在没有 SSH 时用）

1. 宝塔【面板设置】→ 把 **上传文件大小限制** 调到 **≥ 300MB**（默认常见是 50MB，不改会直接上传失败），保存后重启面板。
2. 【文件】→ 地址栏手动输入 `/tmp` 进目录 → 上传 `live2d-model.tar.gz`。
3. 回到第 5 步解压。

> 不要试图用文件管理器逐个传 1166 个小文件，会非常慢且容易中断。

---

## 5. 第三步：服务器上解压落位

```bash
cd /www/wwwroot/blog/Edison/public/live2d     # ← 换成实际路径

# ① 先确认当前确实没有（或为空）model 目录
ls -la

# ② 解压（会在当前目录生成 model/）
tar -xzf /tmp/live2d-model.tar.gz

# ③ 修正属主与权限（宝塔站点用户一般是 www，先确认）
ps -ef | grep -E "next|node" | grep -v grep        # 看进程属主是谁
chown -R www:www /www/wwwroot/blog/Edison/public/live2d/model
find /www/wwwroot/blog/Edison/public/live2d/model -type d -exec chmod 755 {} \;
find /www/wwwroot/blog/Edison/public/live2d/model -type f -exec chmod 644 {} \;

# ④ 清掉临时包（可选）
rm -f /tmp/live2d-model.tar.gz
```

### 关于"要不要重新构建/重启"

**不需要 `npm run build`，也不需要重启 Next.js。**

Next.js 的 `public/` 目录是**运行时**从磁盘读取的，不是打包进构建产物的。文件放进去，刷新页面即可生效（本地 `npm run dev` 同理）。

> 唯一要小心的是：以后如果再执行 `git clean -fdx`（会删掉未跟踪文件），`model/` 会被清掉，需要重传一次。日常 `git pull` 不受影响，因为 `model/` 已被 gitignore，pull 不会动它。

---

## 6. 第四步：验证（4 项全绿才算完成）

```bash
# ① 文件数量对不对
ls /www/wwwroot/blog/Edison/public/live2d/model | wc -l                    # 期望 24
find /www/wwwroot/blog/Edison/public/live2d/model -type f | wc -l          # 期望 1166

# ② 直连 Next.js（绕过 Nginx）能不能取到默认模型 —— 这一步最能说明问题
curl -sI http://127.0.0.1:3000/live2d/model/za/zastavam21_2104/normal/index.json | head -1
# 期望：HTTP/1.1 200 OK      （404 = 路径不对 / 解压位置不对）

# ③ 走域名（经 Nginx）
curl -sI https://<你的域名>/live2d/model/za/zastavam21_2104/normal/index.json | head -1
# 期望：HTTP/2 200

# ④ 再抽一个小配置文件
curl -sI https://<你的域名>/live2d/model_list.json | head -1               # 期望 200
```

**浏览器验证**：打开网站 → `Ctrl + F5` 强刷 → 右下角出现看板娘 → F12 打开 Network，筛 `/live2d`，所有请求应为 200，无 404。

> 说明：看板娘只在屏幕宽度 ≥ 768px 时加载（`autoload.js` 里的判断），所以**手机上是看不到的，这是正常的**，不用当 bug 修。
> 首次加载会拉几 MB 模型文件，慢一点是正常的（按需加载，之后走缓存）。

---

## 7. 强烈建议：让 Nginx 直出 `/live2d/` 并加长缓存

**现状问题**：当前 Nginx 把所有请求都转给 Next.js，而且 `location /` 里被特意加了 `no-store`（为了解决重新部署后返回旧 HTML 的问题）。结果是 —— **216MB 的模型文件每个访客每次刷新都要重新下载一遍**，白白烧流量、拖慢首屏。

**解决办法**：给 `/live2d/` 单独开一个由 Nginx 直接读磁盘的 location，绕开 Next.js 和 no-store。

在【网站】→ 站点【设置】→【配置文件】的 `server { }` 里，**放在 `location / { ... }` 之前**，加入：

```nginx
    # Live2D 看板娘静态资源：Nginx 直接读磁盘 + 30 天缓存
    location ^~ /live2d/ {
        alias /www/wwwroot/blog/Edison/public/live2d/;   # ← 换成实际路径
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        access_log off;
    }
```

要点：
- `location` 和 `alias` 结尾的 **`/` 都必须写**，否则路径拼接会出错。
- `alias` 指向 `public/live2d/`（注意要指到 `live2d` 这一层，不是项目根）。
- 保存后 Nginx 会自动 reload（宝塔行为），无需手动重启。
- 加了这段之后，第 6 步的 ③④ 仍然应该是 200，且响应头里会多出 `Cache-Control: public, max-age=2592000`。

> 这段不是必须的，但不加的话流量和加载速度会有明显代价，建议一起做掉。

---

## 8. 故障排查表

| 现象 | 原因 | 解决 |
|---|---|---|
| 右下角空白；Network 里 `model/xxx/index.json` 返回 **404** | `model/` 没传，或解压位置错、多套了一层 | `ls public/live2d/model` 应当**直接**看到 `95type`、`AK12`、`za` 等目录；如果看到的是 `model`，说明解压多套了一层，把内层内容上移 |
| 看板娘出现但加载卡住 / 图片拉不出来 | 文件权限不对，Nginx 返回 **403** | 重跑 `chown -R www:www` + `chmod 755/644` |
| 只能选部分模型，部分点了空白 | 上传或解压中断，文件不全 | `find ... -type f | wc -l` 必须等于 **1166**，少了就重传 |
| 出现乱码目录名（如 `??????`） | 用了 Windows 右键 zip 打包 | 用 `tar -czf` 重新打包（见第 3 步）后重传 |
| 服务器上路径 `/www/wwwroot/blog/...` 不存在 | 豆包部署时用了别的目录 | 先按第 2 步定位真实项目根目录 |
| 强刷还是不出现 | 浏览器/CDN 缓存 | `Ctrl+Shift+R`、无痕窗口；确认 Network 里 `/live2d/*` 是 200 |
| 手机上一直看不到 | 设计如此 | `autoload.js` 限制 `screen.width >= 768` 才加载，不是故障 |

---

## 9. 交付清单（豆包做完请回报这 5 项）

1. 服务器上**项目根目录**的实际路径：`________________`
2. `ls <根>/Edison/public/live2d/model | wc -l` = ？（期望 **24**）
3. `find <根>/Edison/public/live2d/model -type f | wc -l` = ？（期望 **1166**）
4. `curl -sI http://127.0.0.1:3000/live2d/model/za/zastavam21_2104/normal/index.json` 的状态码 = ？（期望 **200**）
5. 是否已加 Nginx `/live2d/` 直出 location？域名访问后右下角看板娘**是否出现**？

---

## 附：本任务涉及的关键事实速查

| 项 | 值 |
|---|---|
| 要传的目录 | `Edison/public/live2d/model/` |
| 目录体积 | 216MB（tar.gz 压缩后 **172MB**） |
| 文件数 | 1166 |
| 顶层模型目录数 | 24 |
| 可选模型组（`model_list.json`） | 21 组 / 124 条贴图条目 |
| 默认模型（`modelId=20`） | `za/zastavam21_2104/normal` |
| 看板娘入口 | `components/widgets/Live2D.tsx` → `/live2d/jsdelivr/random/autoload.js` |
| 是否需要重新构建 | **不需要**（`public/` 运行时读取） |
| 是否需要改代码 | **不需要** |
| 是否要加进 git | **不要**（保持 .gitignore 第 85 行排除） |
