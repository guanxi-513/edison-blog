/* 手机端 DOM 事件绑定 & 环境判断的离线验证（无需浏览器）
 *
 * 背景：mobile/app.js 是纯原生 JS，没有构建与测试框架。
 * 踩过的坑：
 *   1) 给新按钮复用了通用类名（.chip），被 bind() 里 `querySelectorAll(".chip")` 的
 *      循环覆盖了 onclick —— 表现为「按钮点了没反应」，且不报任何错。
 *   2) Capacitor 壳内页面地址是 http(s)://localhost（无端口），网页版是 localhost:8000。
 *      两者判断错了，App 里就会把请求打到 WebView 本机，报 Failed to fetch。
 *
 * 本脚本用极简 DOM 桩把 app.js 真实跑起来（两种环境各跑一遍），
 * 触发 DOMContentLoaded 后检查事件绑定与内部状态。
 *
 * 用法：node test_mobile_dom.js   （退出码 0 = 全通过）
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP_JS = path.join(__dirname, "mobile", "app.js");
const SRC = fs.readFileSync(APP_JS, "utf8");

class El {
  constructor(id) {
    this.id = id || "";
    this._cls = new Set();
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.src = "";
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.onclick = null;
    this.disabled = false;
    this._listeners = {};
    this.classList = {
      add: (...c) => c.forEach((x) => this._cls.add(x)),
      remove: (...c) => c.forEach((x) => this._cls.delete(x)),
      contains: (c) => this._cls.has(c),
      toggle: (c, f) => {
        const on = f === undefined ? !this._cls.has(c) : !!f;
        if (on) this._cls.add(c); else this._cls.delete(c);
        return on;
      },
    };
  }
  get className() { return [...this._cls].join(" "); }
  set className(v) { this._cls = new Set(String(v).split(" ").filter(Boolean)); }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  appendChild(c) { this.children.push(c); return c; }
  focus() {}
  querySelectorAll() { return []; }
}

/** 在指定 location 环境下把 app.js 跑起来，返回测试所需的上下文 */
function boot(loc) {
  const els = new Map();
  const byId = (id) => {
    if (!els.has(id)) els.set(id, new El(id));
    return els.get(id);
  };

  const docListeners = {};
  const document = {
    getElementById: byId,
    querySelectorAll: () => [],
    addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
    createElement: () => new El(),
  };

  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };

  const sandbox = {
    document, localStorage, console, setTimeout, clearTimeout, location: loc,
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    FormData: class { append() {} },
    fetch: () => Promise.reject(new Error("本脚本不发起网络请求")),
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  (docListeners.DOMContentLoaded || []).forEach((fn) => fn());

  return { sandbox, byId, api: sandbox.window.__edison };
}

const assert = (name, cond) => {
  console.log(`${cond ? "✓" : "✗"} ${name}`);
  if (!cond) process.exitCode = 1;
};

/* ============ 场景 1：手机浏览器直接访问后端（同源网页版） ============ */
console.log("— 网页版（http://192.168.10.12:8000/m/）—");
const web = boot({
  protocol: "http:", hostname: "192.168.10.12", port: "8000",
  origin: "http://192.168.10.12:8000",
});

assert("网页版不被误判为 App 壳", web.api.isNativeApp === false);
assert("网页版 base 留空（走同源）", web.api.base === "");

const newBtn = web.byId("newAlbumBtn");
const box = web.byId("newAlbumBox");
assert("「＋ 新建相册」已绑定 onclick", typeof newBtn.onclick === "function");
newBtn.onclick();
assert("点击后新建相册输入区展开（未被列表筛选逻辑劫持）", !box.classList.contains("hidden"));
assert("「创建」已绑定 onclick", typeof web.byId("createAlbumBtn").onclick === "function");
assert("「取消」已绑定 onclick", typeof web.byId("cancelAlbumBtn").onclick === "function");
assert("未选相册时「选择照片」为禁用态", web.byId("photoPickLabel").classList.contains("disabled") === true);

web.byId("cancelAlbumBtn").onclick();
assert("点击「取消」后输入区收起", box.classList.contains("hidden"));

assert("「登录」已绑定 onclick", typeof web.byId("loginBtn").onclick === "function");
assert("「发布」已绑定 onclick", typeof web.byId("publishBtn").onclick === "function");
assert("「存草稿」已绑定 onclick", typeof web.byId("draftBtn").onclick === "function");
assert("「设置」已绑定 onclick", typeof web.byId("settingsBtn").onclick === "function");
assert("「测试连接」已绑定 onclick", typeof web.byId("testConnBtn").onclick === "function");
assert("「保存地址」已绑定 onclick", typeof web.byId("saveBaseBtn").onclick === "function");

/* ============ 场景 2：Capacitor 壳内（androidScheme=http → http://localhost，无端口） ============ */
console.log("\n— App 壳内（http://localhost/）—");
const app = boot({ protocol: "http:", hostname: "localhost", port: "", origin: "http://localhost" });

assert("App 壳内被正确识别", app.api.isNativeApp === true);
assert("App 壳内自动预填局域网后端地址", app.api.base === app.api.nativeDefaultBase);
assert("预填地址是完整 URL（含 http://）", /^https?:\/\//.test(app.api.base));

// 若改为 https scheme，判断仍应成立（避免以后调 scheme 又踩坑）
const appHttps = boot({ protocol: "https:", hostname: "localhost", port: "", origin: "https://localhost" });
assert("androidScheme 改回 https 时同样能识别", appHttps.api.isNativeApp === true);

/* ============ 场景 3：地址归一化 ============ */
console.log("\n— 地址归一化 —");
assert("裸 IP:端口 自动补 http://", web.api.normalizeBase("192.168.10.12:8000") === "http://192.168.10.12:8000");
assert("结尾斜杠被去掉", web.api.normalizeBase("http://a.com/") === "http://a.com");
assert("已是 https 时不改写", web.api.normalizeBase("https://a.com") === "https://a.com");
assert("空值保持空", web.api.normalizeBase("   ") === "");

console.log(process.exitCode ? "\n存在失败项 ✗" : "\n全部通过 ✓");
