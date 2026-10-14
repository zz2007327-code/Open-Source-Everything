#!/usr/bin/env node
/**
 * cdp_probe.js — general-purpose browser evidence probe
 *
 * Drives a headless Chromium over CDP using Node's built-in WebSocket.
 * No playwright / puppeteer dependency.
 *
 * Usage:
 *   node cdp_probe.js <URL>
 *
 * Environment variables:
 *   CHROME_PATH=<path>   Chromium / Chrome executable (required)
 *   OUT=<path>           screenshot output path (default probe.png)
 *   SIZE=WxH             viewport size (default 1280x900)
 *   WAIT=<ms>            base wait after page load (default 3000)
 *   WAIT2=<ms>           wait after interaction (default 3000)
 *   READY=<js expr>      poll this expression until truthy; for waiting on fonts/data
 *   READY_TIMEOUT=<ms>   READY poll ceiling (default 25000)
 *   FOCUS=<selector>     focus an element (pair with TYPE)
 *   TYPE=<text>          insert text into the focused element (simulates IME input)
 *   CLICK=<selector>     click an element and dispatch bubbling input/change events
 *   EVAL=<js expr>       evaluate and print; continue with EVAL2 / EVAL3 …
 *   CLIP=x,y,w,h         screenshot clip region
 *   SCALE=<n>            scale factor for CLIP (default 2)
 *   FULL=1               full-page screenshot (including beyond viewport)
 *   PORT=<n>             debug port (default 9333)
 *   JSON=<path>          write the structured result to this JSON file
 *   DUMP=<path>          write the **runtime** document.documentElement.outerHTML to disk
 *                        (use this instead of curl — static fetches often return a stale build, see below)
 *   SOFTWEBGL=1          append software-rendering flags to try to give the headless env WebGL
 *   NOAUDIT=1            skip the environment capability audit
 *
 * Examples:
 *   CHROME_PATH=/path/chrome OUT=shot.png FULL=1 WAIT=6000 \
 *     DUMP=work/live.html node cdp_probe.js "https://example.com/app"
 *
 *   CHROME_PATH=/path/chrome OUT=after.png CLICK="#toggle" WAIT2=4000 \
 *     EVAL="document.querySelector('canvas').width" \
 *     node cdp_probe.js "https://example.com/app"
 *
 * Design notes (all of them are pitfalls we already hit — read before changing):
 *   1. The page is launched on about:blank and we attach before Page.navigate — only
 *      then can Page.addScriptToEvaluateOnNewDocument inject **before any page script**,
 *      which is what lets us capture errors thrown **during script initialization**.
 *      (Injecting with Runtime.evaluate after load cannot catch those.)
 *   2. Besides the JS-side window.__probeErrs we also collect Runtime.exceptionThrown /
 *      Runtime.consoleAPICalled / Log.entryAdded in parallel — three layers of fallback
 *      so we never end up with "errs is empty but the page is clearly broken".
 *   3. Built-in environment capability audit: WebGL availability, whether rAF is being
 *      throttled, inline-script byte count, external script list. The first two decide
 *      "can we verify at all"; the last two are for **fighting stale builds** (compare
 *      byte counts against the statically fetched files).
 *   4. Headless Chromium must be run with --no-sandbox --disable-setuid-sandbox,
 *      otherwise it reports "Sandbox cannot access executable ... access denied (0x5)".
 *      This script already includes them.
 *   5. **SOFTWEBGL=1 works in practice**: by default getContext('webgl2'|'webgl') returns
 *      false (caused by --disable-gpu); adding --enable-unsafe-swiftshader
 *      --use-angle=swiftshader yields "WebGL 2.0 (OpenGL ES 3.0 Chromium)", and only then
 *      can WebGL-dependent pages actually be verified.
 *   6. rAF is throttled on **file:// local pages** (remote pages are fine). Local replicas
 *      must keep a setInterval fallback or the animation "freezes"; this script warns when
 *      the frame count looks abnormal.
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

// Convenience: allow KEY=VALUE to be written as a command-line argument
// (equivalent to setting the environment variable). Avoids the common misuse of
// `cmd VAR=x`, where the shell treats it as an argument rather than an env var.
for (const a of process.argv.slice(3)) {
  const m = a.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const CHROME = process.env.CHROME_PATH;
if (!CHROME) {
  console.error("CHROME_PATH is missing: point it at the Chromium / Chrome executable");
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
 * Bootstrap script injected at the very front of **every new document**.
 * It must run before any page script, otherwise initialization-time errors are missed.
 * Note: it is injected via CDP and is not part of the DOM, so it does not pollute the
 * outerHTML produced by DUMP.
 */
const BOOTSTRAP = `(function () {
  if (window.__cdpProbe) return;
  var P = { errs: [], raf: 0, t0: Date.now(), consoleErrors: [] };
  window.__cdpProbe = P;
  window.__probeErrs = P.errs;                      // legacy alias
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

/** Environment capability audit: can we verify (WebGL / rAF) + what the captured build looks like (bytes) */
const AUDIT = `(function () {
  var out = { webgl: false, webglVersion: null, webglError: null };
  try {
    var cv = document.createElement('canvas');
    var gl = cv.getContext('webgl2') || cv.getContext('webgl') || cv.getContext('experimental-webgl');
    out.webgl = !!gl;
    if (gl && gl.getParameter) out.webglVersion = String(gl.getParameter(gl.VERSION));
  } catch (e) { out.webglError = String(e && e.message || e); }
  // Does this page look like it "needs WebGL"? — decides whether to warn when there is
  // no WebGL, so 2D pages are not false-flagged.
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
    // Headless cannot get WebGL by default; these two flags route WebGL through
    // SwiftShader software rendering.
    args.push("--enable-unsafe-swiftshader", "--use-angle=swiftshader");
  }
  // Launch on about:blank first: this guarantees we attach before navigating, so the
  // injection can beat the page scripts.
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
    if (!target) throw new Error("no debuggable page target found");
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
      // ---- Event stream: CDP-level fallback, catches errors the JS-side hooks may miss ----
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
      if (r.exceptionDetails) throw new Error("EVAL threw: " + (r.exceptionDetails.text || ""));
      return r.result.value;
    };

    await send("Page.enable");
    await send("Runtime.enable");
    try {
      await send("Log.enable");
    } catch {}

    // Critical ordering: inject first (applies to subsequent documents), then navigate.
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
      // Module-heavy pages often sit at "interactive" for a long time (the module graph
      // never settles); give them a 12s grace period and move on rather than burning the
      // whole NAV_TIMEOUT waiting for a page that will never reach "complete".
      if (rs === "interactive" && Date.now() - tn > 12000) break;
    }
    report.steps.push({ step: "navigated", elapsedMs: Date.now() - tn, readyState: navState });
    console.log("navigated (+" + (Date.now() - tn) + "ms, readyState=" + navState + ")");

    await sleep(WAIT);

    // ---- Environment capability audit ----
    if (process.env.NOAUDIT !== "1") {
      try {
        const audit = JSON.parse(await evaluate(AUDIT));
        report.env = audit;
        console.log("env:", JSON.stringify(audit));
        if (!audit.webgl && audit.webglHint) {
          console.warn(
            "WARNING: no WebGL in this environment while the page appears to depend on it " +
              "(matches webgl/three/babylon and similar signatures): rendered output **cannot be verified**. " +
              "Retry with SOFTWEBGL=1; if it still fails, record it honestly as an evidence gap — " +
              "do not describe the visuals from imagination."
          );
        }
        if (audit.canvases > 0 && audit.elapsedMs > 6000 && audit.rafFrames < 5) {
          console.warn(
            `WARNING: rAF is not running: only ${audit.rafFrames} frames in ${(audit.elapsedMs / 1000).toFixed(1)}s ` +
              "(and the page has a canvas). Two possibilities: (1) headless throttling (common for local " +
              "file:// replicas); (2) the page failed during initialization and never queued a frame at all. " +
              "Check bootErrs / exceptions before drawing any conclusion."
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

    // Collect EVAL / EVAL2 / EVAL3 …
    // Note: `Number("EVAL".replace("EVAL","") || 0)` → Number(0) === 0, so EVAL and EVAL0
    // share the same sort key. Their relative evaluation order is therefore undefined, but
    // they are semantically equivalent (both just "evaluate and print"), so no fix is needed.
    // If you genuinely need ordering, put the dependency inside a single EVAL,
    // e.g. EVAL="(()=>{a(); return b()})()".
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

    // ---- Runtime DOM dump (to fight "curl fetched a stale build") ----
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

    // Screenshot
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
