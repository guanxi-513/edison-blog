/**
 * Edison 手机发布端（纯原生 JS，零依赖）
 * 与后端同源时 base 留空；Capacitor 打包后可在设置里填服务器地址
 */
(function () {
  "use strict";

  const K_TOKEN = "edison_token";
  const K_BASE = "edison_base";
  const K_USER = "edison_user";

  const $ = (id) => document.getElementById(id);

  // Capacitor 打包成 App 后，页面来自手机本机（https://localhost），同源不可用，必须显式指定后端地址；
  // 网页版（同源访问 /m/）保持留空。首次打开会自动预填下面的地址，之后可在「设置」里随时改。
  // 局域网调试时可填电脑的局域网 IP；后端上公网后改成你的域名或公网地址
  const NATIVE_DEFAULT_BASE = "http://192.168.10.12:8000";
  // 是否运行在 Capacitor 壳内：页面来自 http(s)://localhost 且不带端口
  // （网页版经后端访问是 localhost:8000，带端口 → 判为否，走同源）
  const IS_NATIVE_APP =
    (location.protocol === "http:" || location.protocol === "https:") &&
    location.hostname === "localhost" &&
    !location.port;

  let base = localStorage.getItem(K_BASE) || (IS_NATIVE_APP ? NATIVE_DEFAULT_BASE : "");
  let token = localStorage.getItem(K_TOKEN) || "";
  let pendingImages = []; // {file, url(objectURL), dataUrl}
  let listStatus = "";
  let listPage = 1;
  let listHasMore = false;
  let albums = [];
  let currentAlbumId = null;
  let uploadingPhotos = false;

  /* ---------------- 基础工具 ---------------- */

  // 只输「IP:端口」漏掉协议时补齐 http://，否则会被当成相对路径，请求打到 WebView 本机去了
  function normalizeBase(v) {
    let s = String(v == null ? "" : v).trim().replace(/\/+$/, "");
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "http://" + s;
    return s;
  }

  function api(path, opts = {}) {
    const { method = "GET", body, form, auth = true } = opts;
    const headers = {};
    if (auth && token) headers["Authorization"] = "Bearer " + token;
    let payload;
    if (form) {
      payload = form; // FormData，交给浏览器设置 Content-Type
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    return fetch(base + path, { method, headers, body: payload })
      .catch((err) => {
        // 网络层就没通：地址写错 / 后端没启动 / 不在同一网络 / WebView 拦截了明文请求
        const target = base || location.origin;
        throw new Error("连不上服务器 " + target + "（" + ((err && err.message) || "网络错误") + "）");
      })
      .then(async (res) => {
        if (res.status === 401) {
          logout(false);
          throw new Error("登录已过期，请重新登录");
        }
        const text = await res.text();
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch (e) { /* 非 JSON */ }
        if (!res.ok) {
          const detail = (json && (json.detail || json.message)) || `请求失败(${res.status})`;
          throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        }
        return json;
      });
  }

  function imgUrl(url) {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    return base + url;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2200);
  }

  function setMsg(id, text, type) {
    const el = $(id);
    el.textContent = text || "";
    el.className = "msg" + (type ? " " + type : "");
  }

  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /* ---------------- 连接自检 ---------------- */

  // 设置面板里的「测试连接」：只打 /api/health，
  // 用来一眼区分「地址填错/连不上」和「账号密码问题」
  async function testConnection() {
    const out = $("testResult");
    const target = normalizeBase($("setBase").value) || base;
    if (!target) {
      out.textContent = "请先填写服务器地址";
      out.className = "hint err";
      return;
    }
    out.textContent = "测试中…";
    out.className = "hint";
    const t0 = Date.now();
    try {
      const res = await fetch(target + "/api/health");
      if (!res.ok) throw new Error("HTTP " + res.status);
      out.textContent = "✓ 连接成功：" + target + "（" + (Date.now() - t0) + "ms）";
      out.className = "hint ok";
    } catch (e) {
      out.textContent = "✗ 连不上 " + target + "：" + ((e && e.message) || "网络错误");
      out.className = "hint err";
    }
  }

  /* ---------------- 登录 / 登出 ---------------- */

  function showLogin() {
    $("appView").classList.remove("active");
    $("loginView").classList.add("active");
    $("loginBase").value = base;
  }

  function showApp() {
    $("loginView").classList.remove("active");
    $("appView").classList.add("active");
    $("setUser").textContent = localStorage.getItem(K_USER) || "-";
    $("setBase").value = base;
  }

  function logout(notify) {
    token = "";
    localStorage.removeItem(K_TOKEN);
    pendingImages.forEach((p) => URL.revokeObjectURL(p.url));
    pendingImages = [];
    renderThumbs();
    albums = [];
    currentAlbumId = null;
    uploadingPhotos = false;
    $("albumChips").innerHTML = "";
    $("photoGrid").innerHTML = "";
    $("photoMsg").textContent = "";
    $("newAlbumBox").classList.add("hidden");
    updatePhotoPickState();
    showLogin();
    if (notify !== false) setMsg("loginMsg", "已退出登录");
  }

  async function doLogin() {
    const username = $("loginUser").value.trim();
    const password = $("loginPass").value;
    const baseInput = normalizeBase($("loginBase").value);
    if (!username && !password) return setMsg("loginMsg", "请填写用户名和密码（灰色字只是提示，需要手动输入）", "err");
    if (!username) return setMsg("loginMsg", "请填写用户名", "err");
    if (!password) return setMsg("loginMsg", "请填写密码", "err");

    base = baseInput;
    localStorage.setItem(K_BASE, base);

    const btn = $("loginBtn");
    btn.disabled = true;
    setMsg("loginMsg", "登录中…");
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { username, password },
      });
      const data = (res && res.data) || {};
      token = data.accessToken || "";
      if (!token) throw new Error("登录返回异常，未获取到凭证");
      localStorage.setItem(K_TOKEN, token);
      localStorage.setItem(K_USER, data.nickname || data.username || username);
      setMsg("loginMsg", "");
      $("loginPass").value = "";
      showApp();
      toast("登录成功");
      loadList(true);
    } catch (e) {
      setMsg("loginMsg", e.message || "登录失败", "err");
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------------- 图片选择 / 压缩 ---------------- */

  const MAX_EDGE = 1600;
  const QUALITY = 0.85;

  function compress(file) {
    return new Promise((resolve) => {
      if (!/^image\//.test(file.type)) return resolve(file);
      const img = new Image();
      const objUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        let { width, height } = img;
        const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const name = (file.name || "image").replace(/\.[^.]+$/, "") + ".jpg";
            resolve(new File([blob], name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          QUALITY
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
      img.src = objUrl;
    });
  }

  function renderThumbs() {
    const box = $("thumbs");
    box.innerHTML = "";
    pendingImages.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "thumb";
      const img = document.createElement("img");
      img.src = p.url;
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "×";
      del.onclick = () => {
        URL.revokeObjectURL(pendingImages[i].url);
        pendingImages.splice(i, 1);
        renderThumbs();
      };
      div.appendChild(img);
      div.appendChild(del);
      box.appendChild(div);
    });
  }

  async function onFilesPicked(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    toast(`处理 ${list.length} 张图片…`);
    for (const f of list) {
      const compressed = await compress(f);
      pendingImages.push({
        file: compressed,
        url: URL.createObjectURL(compressed),
      });
    }
    renderThumbs();
  }

  async function uploadAll() {
    const urls = [];
    for (let i = 0; i < pendingImages.length; i++) {
      setMsg("publishMsg", `上传图片 ${i + 1}/${pendingImages.length}…`);
      const form = new FormData();
      form.append("file", pendingImages[i].file);
      const res = await api("/api/upload/image", { method: "POST", form });
      if (res && res.url) urls.push(res.url);
    }
    return urls;
  }

  /* ---------------- 发布 ---------------- */

  async function publish(status) {
    const content = $("content").value.trim();
    if (!content) return setMsg("publishMsg", "还没有写内容", "err");

    const pubBtn = $("publishBtn");
    const draftBtn = $("draftBtn");
    pubBtn.disabled = draftBtn.disabled = true;
    try {
      const images = await uploadAll();
      setMsg("publishMsg", "发布中…");
      await api("/api/chatters", {
        method: "POST",
        body: {
          content,
          images,
          mood: $("mood").value.trim(),
          status: status === "published" ? "published" : "draft",
        },
      });
      $("content").value = "";
      $("mood").value = "";
      pendingImages.forEach((p) => URL.revokeObjectURL(p.url));
      pendingImages = [];
      renderThumbs();
      setMsg("publishMsg", status === "published" ? "已发布 ✓" : "已存为草稿 ✓", "ok");
      toast(status === "published" ? "发布成功" : "已存草稿");
      loadList(true);
    } catch (e) {
      setMsg("publishMsg", e.message || "操作失败", "err");
    } finally {
      pubBtn.disabled = draftBtn.disabled = false;
    }
  }

  /* ---------------- 列表 ---------------- */

  async function loadList(reset) {
    const box = $("listBox");
    if (reset) {
      listPage = 1;
      box.innerHTML = "";
      box.innerHTML = '<p class="empty">加载中…</p>';
    }
    try {
      const params = new URLSearchParams({ page: String(listPage), size: "20" });
      if (listStatus) params.set("status", listStatus);
      const items = await api("/api/chatters/admin?" + params.toString());
      if (reset) box.innerHTML = "";
      const arr = Array.isArray(items) ? items : [];
      listHasMore = arr.length >= 20;
      if (reset && arr.length === 0) {
        box.innerHTML = '<p class="empty">还没有内容，去发布一条吧</p>';
        $("loadMoreBtn").classList.add("hidden");
        return;
      }
      arr.forEach((it) => box.appendChild(renderItem(it)));
      $("loadMoreBtn").classList.toggle("hidden", !listHasMore);
    } catch (e) {
      if (reset) box.innerHTML = `<p class="empty">${e.message || "加载失败"}</p>`;
      toast(e.message || "加载失败");
    }
  }

  function renderItem(it) {
    const wrap = document.createElement("div");
    wrap.className = "item";

    const head = document.createElement("div");
    head.className = "item-head";
    const badge = document.createElement("span");
    badge.className = "badge " + (it.status === "published" ? "published" : "draft");
    badge.textContent = it.status === "published" ? "已发布" : "草稿";
    const time = document.createElement("span");
    time.className = "item-time";
    time.textContent = fmtTime(it.created_at);
    head.appendChild(badge);
    head.appendChild(time);

    const text = document.createElement("div");
    text.className = "item-text";
    text.textContent = it.content || "";

    wrap.appendChild(head);
    wrap.appendChild(text);

    const imgs = it.images || [];
    if (imgs.length) {
      const grid = document.createElement("div");
      grid.className = "item-imgs";
      imgs.slice(0, 9).forEach((u) => {
        const im = document.createElement("img");
        im.src = imgUrl(u);
        im.loading = "lazy";
        im.onclick = () => openPreview(imgUrl(u));
        grid.appendChild(im);
      });
      wrap.appendChild(grid);
    }

    const foot = document.createElement("div");
    foot.className = "item-foot";
    if (it.status !== "published") {
      const pub = document.createElement("button");
      pub.className = "mini-btn";
      pub.textContent = "发布";
      pub.onclick = () => updateStatus(it.id, "published");
      foot.appendChild(pub);
    } else {
      const un = document.createElement("button");
      un.className = "mini-btn";
      un.textContent = "转草稿";
      un.onclick = () => updateStatus(it.id, "draft");
      foot.appendChild(un);
    }
    const del = document.createElement("button");
    del.className = "mini-btn danger";
    del.textContent = "删除";
    del.onclick = () => removeItem(it.id);
    foot.appendChild(del);
    wrap.appendChild(foot);

    return wrap;
  }

  async function updateStatus(id, status) {
    try {
      await api("/api/chatters/" + id, { method: "PUT", body: { status } });
      toast(status === "published" ? "已发布" : "已转草稿");
      loadList(true);
    } catch (e) {
      toast(e.message || "操作失败");
    }
  }

  async function removeItem(id) {
    if (!confirm("确定删除这条内容？删除后不可恢复")) return;
    try {
      await api("/api/chatters/" + id, { method: "DELETE" });
      toast("已删除");
      loadList(true);
    } catch (e) {
      toast(e.message || "删除失败");
    }
  }

  function openPreview(url) {
    $("previewImg").src = url;
    $("previewMask").classList.remove("hidden");
  }

  /* ---------------- 相册 / 照片 ---------------- */

  function currentAlbum() {
    return albums.find((a) => a.id === currentAlbumId) || null;
  }

  function updatePhotoPickState() {
    const ok = !!currentAlbumId && !uploadingPhotos;
    $("photoPickLabel").classList.toggle("disabled", !ok);
    $("photoInput").disabled = !ok;
  }

  function showPhotoEmpty(text) {
    const el = $("photoEmpty");
    if (text) {
      el.textContent = text;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }

  function renderAlbumChips() {
    const box = $("albumChips");
    box.innerHTML = "";
    if (!albums.length) {
      const span = document.createElement("span");
      span.className = "muted";
      span.style.fontSize = "13px";
      span.textContent = "暂无相册";
      box.appendChild(span);
      return;
    }
    albums.forEach((a) => {
      const b = document.createElement("button");
      b.className = "album-chip" + (a.id === currentAlbumId ? " active" : "");
      b.textContent = `${a.title}（${a.photo_count}）`;
      b.onclick = () => {
        if (a.id === currentAlbumId) return;
        currentAlbumId = a.id;
        renderAlbumChips();
        loadPhotos();
      };
      box.appendChild(b);
    });
  }

  async function loadAlbums(keepSelection) {
    try {
      const arr = await api("/api/albums");
      albums = Array.isArray(arr) ? arr : [];
    } catch (e) {
      albums = [];
      setMsg("photoMsg", e.message || "相册加载失败", "err");
    }
    if (!keepSelection || !currentAlbum()) {
      currentAlbumId = albums.length ? albums[0].id : null;
    }
    renderAlbumChips();
    updatePhotoPickState();
    if (currentAlbumId) {
      await loadPhotos();
    } else {
      $("photoGrid").innerHTML = "";
      showPhotoEmpty("还没有相册，点上方「＋ 新建」创建一个");
    }
  }

  async function loadPhotos() {
    const grid = $("photoGrid");
    if (!currentAlbumId) {
      grid.innerHTML = "";
      return;
    }
    grid.innerHTML = '<p class="empty">加载中…</p>';
    try {
      const arr = await api(`/api/albums/${currentAlbumId}/photos`);
      const list = (Array.isArray(arr) ? arr : []).slice().reverse();
      grid.innerHTML = "";
      showPhotoEmpty(list.length ? "" : "这个相册还没有照片，点「＋ 选择照片」上传");
      list.forEach((p) => grid.appendChild(renderPhoto(p)));
    } catch (e) {
      grid.innerHTML = "";
      showPhotoEmpty(e.message || "照片加载失败");
    }
  }

  function renderPhoto(p) {
    const cell = document.createElement("div");
    cell.className = "photo-cell";

    const img = document.createElement("img");
    img.src = imgUrl(p.url);
    img.loading = "lazy";
    img.onclick = () => openPreview(imgUrl(p.url));
    cell.appendChild(img);

    if (p.caption) {
      const cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = p.caption;
      cell.appendChild(cap);
    }

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "×";
    del.onclick = (e) => {
      e.stopPropagation();
      removePhoto(p.id);
    };
    cell.appendChild(del);

    return cell;
  }

  async function removePhoto(id) {
    if (!confirm("删除这张照片？删除后不可恢复")) return;
    try {
      await api("/api/albums/photos/" + id, { method: "DELETE" });
      toast("已删除");
      await loadAlbums(true);
    } catch (e) {
      toast(e.message || "删除失败");
    }
  }

  function openNewAlbumBox() {
    $("newAlbumBox").classList.remove("hidden");
    $("newAlbumTitle").value = "";
    $("newAlbumTitle").focus();
  }

  async function createAlbum() {
    const title = $("newAlbumTitle").value.trim();
    if (!title) return setMsg("photoMsg", "请填写相册名称", "err");
    const btn = $("createAlbumBtn");
    btn.disabled = true;
    try {
      const album = await api("/api/albums", { method: "POST", body: { title } });
      $("newAlbumBox").classList.add("hidden");
      setMsg("photoMsg", "");
      toast("相册已创建");
      if (album && album.id) currentAlbumId = album.id;
      await loadAlbums(true);
    } catch (e) {
      setMsg("photoMsg", e.message || "创建失败", "err");
    } finally {
      btn.disabled = false;
    }
  }

  async function onPhotoPicked(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    if (!currentAlbumId) return setMsg("photoMsg", "请先选择或创建一个相册", "err");
    if (uploadingPhotos) return;

    uploadingPhotos = true;
    updatePhotoPickState();
    let ok = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        setMsg("photoMsg", `上传中 ${i + 1}/${list.length}…`);
        const compressed = await compress(list[i]);
        const form = new FormData();
        form.append("file", compressed);
        const up = await api("/api/upload/image", { method: "POST", form });
        await api("/api/albums/photos", {
          method: "POST",
          body: {
            album_id: currentAlbumId,
            url: up.url,
            caption: "",
            orientation: up.orientation || "landscape",
          },
        });
        ok++;
      }
      setMsg("photoMsg", `已上传 ${ok} 张 ✓`, "ok");
      toast(`已上传 ${ok} 张`);
    } catch (e) {
      const tail = ok ? `已上传 ${ok} 张，` : "";
      setMsg("photoMsg", `${tail}失败：${e.message || "上传失败"}`, "err");
    } finally {
      uploadingPhotos = false;
      updatePhotoPickState();
      await loadAlbums(true);
    }
  }

  /* ---------------- 事件绑定 ---------------- */

  function bind() {
    $("loginBtn").onclick = doLogin;
    $("loginPass").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
    $("loginUser").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

    $("fileInput").addEventListener("change", (e) => {
      onFilesPicked(e.target.files);
      e.target.value = "";
    });
    $("photoInput").addEventListener("change", (e) => {
      onPhotoPicked(e.target.files);
      e.target.value = "";
    });
    $("newAlbumBtn").onclick = openNewAlbumBox;
    $("cancelAlbumBtn").onclick = () => $("newAlbumBox").classList.add("hidden");
    $("createAlbumBtn").onclick = createAlbum;
    $("newAlbumTitle").addEventListener("keydown", (e) => {
      if (e.key === "Enter") createAlbum();
    });
    $("publishBtn").onclick = () => publish("published");
    $("draftBtn").onclick = () => publish("draft");

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        $(tab.dataset.tab).classList.add("active");
        if (tab.dataset.tab === "tabList") loadList(true);
        if (tab.dataset.tab === "tabPhoto") loadAlbums(true);
      };
    });

    document.querySelectorAll(".list-filter .chip").forEach((chip) => {
      chip.onclick = () => {
        document.querySelectorAll(".list-filter .chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        listStatus = chip.dataset.status || "";
        loadList(true);
      };
    });

    $("loadMoreBtn").onclick = () => {
      if (!listHasMore) return;
      listPage += 1;
      loadList(false);
    };

    $("settingsBtn").onclick = () => $("settingsSheet").classList.remove("hidden");
    $("closeSheetBtn").onclick = () => $("settingsSheet").classList.add("hidden");
    $("settingsSheet").addEventListener("click", (e) => {
      if (e.target.id === "settingsSheet") $("settingsSheet").classList.add("hidden");
    });
    $("testConnBtn").onclick = testConnection;
    $("saveBaseBtn").onclick = () => {
      base = normalizeBase($("setBase").value);
      localStorage.setItem(K_BASE, base);
      toast("地址已保存");
      $("settingsSheet").classList.add("hidden");
      loadList(true);
    };
    $("logoutBtn").onclick = () => {
      $("settingsSheet").classList.add("hidden");
      logout();
    };

    $("previewMask").onclick = () => {
      $("previewMask").classList.add("hidden");
      $("previewImg").src = "";
    };

    // 防止 iOS 双击缩放
    document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
  }

  function init() {
    bind();
    updatePhotoPickState(); // 未选中相册前禁用上传入口
    if (token) {
      showApp();
      loadList(true);
    } else {
      showLogin();
    }
  }

  // 离线测试钩子：test_mobile_dom.js 用它断言「是否在 App 壳内」「默认地址」等内部状态，
  // 运行时无副作用（不暴露任何凭证）
  window.__edison = {
    get base() { return base; },
    isNativeApp: IS_NATIVE_APP,
    nativeDefaultBase: NATIVE_DEFAULT_BASE,
    normalizeBase,
  };

  document.addEventListener("DOMContentLoaded", init);
})();
