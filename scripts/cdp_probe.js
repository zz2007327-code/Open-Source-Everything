#!/usr/bin/env node
/**
 * cdp_probe.js — 通用浏览器取证探针
 *
 * 用 Node 内建 WebSocket 直连无头 Chromium 的 CDP。
 * 不依赖 playwright / puppeteer 包。
 *
 * 用法:
 *   node cdp_probe.js <URL>
 *
 * 环境变量:
 *   CHROME_PATH=<path>   Chromium / Chrome 可执行文件（必填）
 *   OUT=<path>           截图输出路径（默认 probe.png）
 *   SIZE=WxH             视口尺寸（默认 1280x900）
 *   WAIT=<ms>            页面 load 之后的基础等待（默认 3000）
 *   WAIT2=<ms>           交互后等待（默认 3000）
 *   READY=<js expr>      轮询此表达式直到真值；用于等字体/数据就绪
 *   READY_TIMEOUT=<ms>   READY 轮询上限（默认 25000）
 *   FOCUS=<selector>     聚焦元素（配合 TYPE 使用）
 *   TYPE=<text>          向聚焦元素插入文本（模拟输入法）
 *   CLICK=<selector>     点击元素，并派发 input/change 冒泡事件
 *   EVAL=<js expr>       求值并打印；可继续写 EVAL2 / EVAL3 …
 *   CLIP=x,y,w,h         截图裁剪区域
 *   SCALE=<n>            CLIP 的缩放倍数（默认 2）
 *   FULL=1               整页截图（含视口外）
 *   PORT=<n>             调试端口（默认 9333）
 *   JSON=<path>          把结构化结果写入该 JSON 文件
 *   DUMP=<path>          把**运行态** document.documentElement.outerHTML 落盘
 *                        （用它代替 curl —— 静态抓取常拿到旧构建，见下）
 *   SOFTWEBGL=1          追加软件渲染开关，尝试让无头环境具备 WebGL 能力
 *   NOAUDIT=1            跳过环境能力自检
 *
 * 示例:
 *   CHROME_PATH=/path/chrome OUT=shot.png FULL=1 WAIT=6000 \
 *     DUMP=work/live.html node cdp_probe.js "https://example.com/app"
 *
 *   CHROME_PATH=/path/chrome OUT=after.png CLICK="#toggle" WAIT2=4000 \
 *     EVAL="document.querySelector('canvas').width" \
 *     node cdp_probe.js "https://example.com/app"
 *
 * 设计要点（都是踩过的坑，改动前请先读）:
 *   1. 页面用 about:blank 启动，attach 之后再 Page.navigate —— 这样
 *      Page.addScriptToEvaluateOnNewDocument 才能**在页面任何脚本之前**注入，
 *      从而捕获**脚本初始化阶段**的抛错。（加载后再 Runtime.evaluate 注入是抓不到的。）
 *   2. 除了 JS 侧 window.__probeErrs，还并行收 Runtime.exceptionThrown /
 *      Runtime.consoleAPICalled / Log.entryAdded —— 三层兜底，避免「errs 为空但页面明显崩了」。
 *   3. 内建环境能力自检：WebGL 可用性、rAF 是否被节流、内联脚本字节数、外部脚本清单。
 *      前两项决定「能不能验」，后两项用于**对抗旧构建**（跟静态抓到的文件比字节数）。
 *   4. 无头 Chromium 必须带 --no-sandbox --disable-setuid-sandbox，
 *      否则报 "Sandbox cannot access executable ... 拒绝访问 (0x5)"。本脚本已内置。
 *   5. **SOFTWEBGL=1 实测有效**：缺省下 getContext('webgl2'|'webgl') 返回 false
 *      （--disable-gpu 所致），加 --enable-unsafe-swiftshader --use-angle=swiftshader
 *      后拿到 "WebGL 2.0 (OpenGL ES 3.0 Chromium)"，依赖 WebGL 的页面才验得动。
 *   6. rAF 在 **file:// 本地页面**上会被节流（远程页面正常）。本地复刻件须备
 *      setInterval 兜底，否则动画「假死」；本脚本会在帧数异常时提示。
 */

const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const URL_ = process.argv[2];
if (!URL_ || URL_ === "-h" || URL_ === "--help") {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(URL_ ? 0 : 1);
}

// 便利：允许把 KEY=VALUE 写成命令行参数（等价于环境变量）。
// 避免 `cmd VAR=x` 在 shell 中被当作参数而非环境变量的常见误用。
for (const a of process.argv.slice(3)) {
  const m = a.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const CHROME = process.env.CHROME_PATH;
if (!CHROME) {
  console.error("缺少 CHROME_PATH：请指向 Chromium / Chrome 可执行文件");
  process.exit(1);
}

const PORT = Number(process.env.PORT || 9333);
const OUT = process.env.OUT || "probe.png";
const [VW, VH] = (process.env.SIZE || "1280x900").split("x").map(Number);
const WAIT = Number(process.env.WAIT || 3000);
const WAIT2 = Number(process.env.WAIT2 || 3000);
const READY = process.env.READY || "";
const READY_TIMEOUT = Number(process.env.READY_TIMEOUT || 25000);
const DUMP = process.env.DUMP || "";
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT || 45000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function httpGet(url) {
  return new Promise((res, rej) => {
    http
      .get(url, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => res(d));
      })
      .on("error", rej);
  });
}

function originOf(u) {
  try {
    const x = new URL(u);
    return `${x.protocol}//${x.host}`;
  } catch {
    return u.slice(0, 40);
  }
}

/**
 * 注入到**每个新文档最前面**的引导脚本。
 * 必须在任何页面脚本之前执行，否则捕获不到初始化期抛错。
 * 注意：它是靠 CDP 注入的，不属于 DOM，因此不会污染 DUMP 出来的 outerHTML。
 */
const BOOTSTRAP = `(function () {
  if (window.__cdpProbe) return;
  var P = { errs: [], raf: 0, t0: Date.now(), consoleErrors: [] };
  window.__cdpProbe = P;
  window.__probeErrs = P.errs;                      // 兼容旧写法
  window.addEventListener('error', function (e) {
    P.errs.push(String((e && (e.message || e.error)) || e));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    P.errs.push('unhandled: ' + String(e && e.reason));
  });
  try {
    var ce = console.error;
    console.error = function () {
      try {
        P.consoleErrors.push(Array.prototype.map.call(arguments, function (a) {
          return (a && a.message) ? a.message : String(a);
        }).join(' '));
      } catch (_) {}
      return ce.apply(console, arguments);
    };
  } catch (_) {}
  try {
    var raf = window.requestAnimationFrame;
    if (raf) window.requestAnimationFrame = function (cb) {
      P.raf++;
      return raf.call(window, cb);
    };
  } catch (_) {}
})();`;

/** 环境能力自检：能不能验（WebGL / rAF）+ 抓到的构建长什么样（字节数）*/
const AUDIT = `(function () {
  var out = { webgl: false, webglVersion: null, webglError: null };
  try {
    var cv = document.createElement('canvas');
    var gl = cv.getContext('webgl2') || cv.getContext('webgl') || cv.getContext('experimental-webgl');
    out.webgl = !!gl;
    if (gl && gl.getParameter) out.webglVersion = String(gl.getParameter(gl.VERSION));
  } catch (e) { out.webglError = String(e && e.message || e); }
  // 这个页面看起来是不是「需要 WebGL」——决定无 WebGL 时要不要示警，避免 2D 页面误报
  try {
    var src = String(document.documentElement.outerHTML || '');
    out.webglHint = /webgl|three\.|threejs|babylon|pixi\.|regl|gl-matrix|webkit3d|vite-plugin-gl/i.test(src);
  } catch (e) { out.webglHint = null; }
  var P = window.__cdpProbe || {};
  out.rafFrames = P.raf || 0;
  out.elapsedMs = P.t0 ? (Date.now() - P.t0) : null;
  out.bootErrs = (window.__probeErrs || []).slice(0, 12);
  out.consoleErrors = (P.consoleErrors || []).slice(0, 12);
  out.canvases = document.querySelectorAll('canvas').length;
  out.externalScripts = Array.prototype.map.call(
    document.querySelectorAll('script[src]'), function (s) { return s.getAttribute('src'); });
  out.inlineScriptBytes = Array.prototype.reduce.call(
    document.querySelectorAll('script:not([src])'),
    function (a, s) { return a + ((s.textContent || '').length); }, 0);
  out.inlineScriptCount = document.querySelectorAll('script:not([src])').length;
  out.inlineStyleBytes = Array.prototype.reduce.call(
    document.querySelectorAll('style'),
    function (a, s) { return a + ((s.textContent || '').length); }, 0);
  out.iframes = Array.prototype.map.call(document.querySelectorAll('iframe'), function (f) {
    return { src: f.getAttribute('src'), dataSrc: f.getAttribute('data-src'), id: f.id };
  });
  out.readyState = document.readyState;
  return JSON.stringify(out);
})()`;

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "cdp-probe-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${VW},${VH}`,
  ];
  if (process.env.SOFTWEBGL === "1") {
    // 无头环境默认拿不到 WebGL；这两个开关让 WebGL 走 SwiftShader 软件渲染。
    args.push("--enable-unsafe-swiftshader", "--use-angle=swiftshader");
  }
  // 先用 about:blank 启动：保证 attach 后再导航，注入才能抢在页面脚本之前
  args.push("about:blank");

  const child = spawn(CHROME, args, { stdio: "ignore" });

  const report = {
    url: URL_,
    ok: false,
    steps: [],
    errors: [],
    exceptions: [],
    consoleErrors: [],
    env: null,
    result: {},
  };

  try {
    let target = null;
    const want = originOf(URL_);
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      try {
        const list = JSON.parse(await httpGet(`http://127.0.0.1:${PORT}/json/list`));
        const pages = list.filter((t) => t.type === "page" && t.webSocketDebuggerUrl);
        target =
          pages.find((t) => t.url === "about:blank") ||
          pages.find((t) => t.url.startsWith(want)) ||
          pages[0];
        if (target) break;
      } catch {}
    }
    if (!target) throw new Error("找不到可调试的页面目标");
    console.log("target:", target.url);
    report.steps.push({ step: "attach", url: target.url });

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
        return;
      }
      // ---- 事件流：CDP 级兜底，捕获 JS 侧钩子可能漏掉的错误 ----
      if (m.method === "Runtime.exceptionThrown") {
        const d = (m.params && m.params.exceptionDetails) || {};
        report.exceptions.push(
          String((d.exception && (d.exception.description || d.exception.value)) || d.text || "unknown")
        );
      } else if (m.method === "Runtime.consoleAPICalled") {
        if (m.params && m.params.type === "error") {
          report.consoleErrors.push(
            (m.params.args || [])
              .map((a) => (a.value !== undefined ? a.value : a.description || a.type))
              .join(" ")
          );
        }
      } else if (m.method === "Log.entryAdded") {
        const e = (m.params && m.params.entry) || {};
        if (e.level === "error") report.consoleErrors.push("log: " + e.text);
      }
    });
    await new Promise((r) => ws.addEventListener("open", r));

    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, (m) => (m.error ? rej(new Error(`${method} ${JSON.stringify(m.error)}`)) : res(m.result)));
        ws.send(JSON.stringify({ id: i, method, params }));
      });

    const evaluate = async (expr) => {
      const r = await send("Runtime.evaluate", {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) throw new Error("EVAL 抛错: " + (r.exceptionDetails.text || ""));
      return r.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    try {
      await send("Log.enable");
    } catch {}

    // 关键顺序：先注入（对后续文档生效），再导航
    const inj = await send("Page.addScriptToEvaluateOnNewDocument", { source: BOOTSTRAP });
    report.steps.push({ step: "bootstrap-injected", identifier: inj && inj.identifier });

    await send("Emulation.setDeviceMetricsOverride", {
      width: VW,
      height: VH,
      deviceScaleFactor: 1,
      mobile: false,
    });
    report.steps.push({ step: "domains-enabled", viewport: `${VW}x${VH}` });

    await send("Page.navigate", { url: URL_ });
    const tn = Date.now();
    let navState = null;
    while (Date.now() - tn < NAV_TIMEOUT) {
      await sleep(300);
      let rs = null;
      try {
        rs = await evaluate("document.readyState");
      } catch {}
      navState = rs;
      if (rs === "complete") break;
      // 重模块页面常长期停在 interactive（模块图未收敛）；给 12s 宽限就走，
      // 不要为等一个永远不会 complete 的页面空耗到 NAV_TIMEOUT。
      if (rs === "interactive" && Date.now() - tn > 12000) break;
    }
    report.steps.push({ step: "navigated", elapsedMs: Date.now() - tn, readyState: navState });
    console.log("navigated (+" + (Date.now() - tn) + "ms, readyState=" + navState + ")");

    await sleep(WAIT);

    // ---- 环境能力自检 ----
    if (process.env.NOAUDIT !== "1") {
      try {
        const audit = JSON.parse(await evaluate(AUDIT));
        report.env = audit;
        console.log("env:", JSON.stringify(audit));
        if (!audit.webgl && audit.webglHint) {
          console.warn(
            "⚠ 本环境无 WebGL，而页面疑似依赖它（命中 webgl/three/babylon 等特征）：渲染效果**无法验证**。" +
              "可加 SOFTWEBGL=1 重试；仍失败则如实记为取证缺口，不要凭空描述画面。"
          );
        }
        if (audit.canvases > 0 && audit.elapsedMs > 6000 && audit.rafFrames < 5) {
          console.warn(
            `⚠ rAF 未运行：${(audit.elapsedMs / 1000).toFixed(1)}s 内仅 ${audit.rafFrames} 帧（页面有 canvas）。` +
              "两种可能：① 无头环境节流（本地 file:// 复刻件常见）；② 页面初始化就失败了，根本没排帧。" +
              "先看 bootErrs / exceptions 再下判断。"
          );
        }
      } catch (e) {
        console.warn("env audit skipped:", e.message);
      }
    }

    if (READY) {
      const t0 = Date.now();
      let ok = false;
      while (Date.now() - t0 < READY_TIMEOUT) {
        try {
          if (await evaluate(READY)) {
            ok = true;
            break;
          }
        } catch {}
        await sleep(400);
      }
      report.steps.push({ step: "ready-wait", ready: ok, elapsedMs: Date.now() - t0 });
      console.log("ready:", ok, `(+${Date.now() - t0}ms)`);
    }

    if (process.env.FOCUS) {
      await evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(process.env.FOCUS)});
          if (!el) return 'missing'; el.focus(); return 'focused'; })()`
      ).then((v) => {
        report.steps.push({ step: "focus", selector: process.env.FOCUS, result: v });
        console.log("focus:", v);
      });
      await sleep(300);
    }

    if (process.env.TYPE) {
      await send("Input.insertText", { text: process.env.TYPE });
      report.steps.push({ step: "type", text: process.env.TYPE });
      await sleep(500);
    }

    if (process.env.CLICK) {
      const v = await evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(process.env.CLICK)});
          if (!el) return 'missing'; el.click();
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return 'clicked'; })()`
      );
      report.steps.push({ step: "click", selector: process.env.CLICK, result: v });
      console.log("click:", v);
      await sleep(WAIT2);
    }

    // 收集 EVAL / EVAL2 / EVAL3 …
    // 注：`Number("EVAL".replace("EVAL","") || 0)` → Number(0) === 0，因此 EVAL 与 EVAL0 同键值。
    // 二者求值顺序不确定，但语义等价（都只是「求值并打印」），无需修正。
    // 真正需要顺序保证的用法，请把依赖写在同一个 EVAL 里（如 EVAL="(()=>{a(); return b()})()"）。
    const evalKeys = Object.keys(process.env)
      .filter((k) => /^EVAL\d*$/.test(k))
      .sort((a, b) => Number(a.replace("EVAL", "") || 0) - Number(b.replace("EVAL", "") || 0));
    for (const k of evalKeys) {
      try {
        const v = await evaluate(process.env[k]);
        report.result[k] = v;
        console.log(`${k}:`, typeof v === "object" ? JSON.stringify(v) : v);
      } catch (e) {
        report.result[k] = { error: String(e.message) };
        console.log(`${k}: ERROR ${e.message}`);
      }
    }

    // ---- 运行态 DOM 落盘（对抗「curl 抓到的是旧构建」）----
    if (DUMP) {
      try {
        const html = await evaluate("document.documentElement.outerHTML");
        fs.writeFileSync(DUMP, html, "utf8");
        const bytes = Buffer.byteLength(html, "utf8");
        report.result.dump = { path: path.resolve(DUMP), bytes };
        report.steps.push({ step: "dump", path: path.resolve(DUMP), bytes });
        console.log("dumped", DUMP, bytes, "bytes");
      } catch (e) {
        console.warn("dump failed:", e.message);
      }
    }

    try {
      const errs = await evaluate("window.__probeErrs || []");
      report.errors = Array.isArray(errs) ? errs : [String(errs)];
    } catch {}
    if (report.errors.length) console.log("page errors (js hook):", JSON.stringify(report.errors));
    if (report.exceptions.length) console.log("page exceptions (cdp):", JSON.stringify(report.exceptions));
    if (report.consoleErrors.length) console.log("console errors:", JSON.stringify(report.consoleErrors));

    // 截图
    const shot = { format: "png" };
    if (process.env.CLIP) {
      const [x, y, w, h] = process.env.CLIP.split(",").map(Number);
      shot.clip = { x, y, width: w, height: h, scale: Number(process.env.SCALE || 2) };
    }
    if (process.env.FULL === "1") shot.captureBeyondViewport = true;

    const cap = await send("Page.captureScreenshot", shot);
    fs.writeFileSync(OUT, Buffer.from(cap.data, "base64"));
    const size = fs.statSync(OUT).size;
    report.result.screenshot = { path: path.resolve(OUT), bytes: size };
    report.steps.push({ step: "screenshot", path: path.resolve(OUT), bytes: size });
    console.log("saved", OUT, size, "bytes");

    const facts = await evaluate(
      `JSON.stringify({ dpr: devicePixelRatio, w: innerWidth, h: innerHeight, scrollH: document.body.scrollHeight })`
    );
    report.result.facts = JSON.parse(facts);
    console.log("facts:", facts);

    ws.close();
    report.ok = true;
  } catch (e) {
    report.errors.push(String(e.message || e));
    console.error("PROBE FAILED:", e.message);
  } finally {
    if (process.env.JSON) {
      fs.writeFileSync(process.env.JSON, JSON.stringify(report, null, 2));
    }
    child.kill();
    await sleep(400);
    process.exit(report.ok ? 0 : 1);
  }
})();
