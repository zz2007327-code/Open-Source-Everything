#!/usr/bin/env node
/**
 * extract_inline.js — 从 HTML 抽出内联脚本、美化可读、并统计关键字频次
 *
 * 用途：把「它到底用没用 X」从猜测变成事实。先跑统计，再决定读哪一段代码。
 *
 * 用法:
 *   node extract_inline.js <input.html> [选项]
 *
 * 选项:
 *   --out <dir>      输出目录（默认 rea-work）
 *   --beautify       对最大的内联脚本生成 .pretty.js（需 npx js-beautify）
 *   --all            --beautify 时美化全部内联脚本
 *   --api            打印关键字频次表（默认开启）
 *   --no-api         关闭频次表
 *   --keys "a,b,c"   追加自定义关键字
 *   --top <n>        频次表最多显示 n 行（默认 60）
 *
 * 产出:
 *   <dir>/inline-1.js         最大的内联脚本（按体积降序命名）
 *   <dir>/inline-1.pretty.js  --beautify 时生成
 *   stdout                    各块体积、外部脚本列表、关键字频次表、重要项未使用清单
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const argv = process.argv.slice(2);
if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
  console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(argv.length ? 0 : 1);
}

const input = argv[0];
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};
const has = (name) => argv.includes(name);

const OUTDIR = opt("--out", "rea-work");
const DO_BEAUTIFY = has("--beautify");
const BEAUTIFY_ALL = has("--all");
const SHOW_API = !has("--no-api");
const TOP = Number(opt("--top", 60));
const CUSTOM_KEYS = (opt("--keys", "") || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!fs.existsSync(input)) {
  console.error(`找不到输入文件: ${input}`);
  process.exit(1);
}
const html = fs.readFileSync(input, "utf8");

// ---------- 1. 切分 script 标签 ----------
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const inline = [];
const external = [];
let m;
while ((m = re.exec(html))) {
  const attrs = m[1] || "";
  const body = m[2] || "";
  const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (srcMatch) {
    external.push(srcMatch[2] || srcMatch[3] || srcMatch[4] || "");
  } else if (body.trim().length) {
    const type = (attrs.match(/\btype\s*=\s*("([^"]*)"|'([^']*)')/i) || [])[2] || "text/javascript";
    inline.push({ body, type, attrs: attrs.trim() });
  }
}

console.log("=".repeat(64));
console.log(`输入: ${input}  (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`内联脚本: ${inline.length} 块   外部脚本: ${external.length} 个`);
console.log("=".repeat(64));

if (!inline.length) {
  console.log("\n没有内联脚本。若目标是打包产物，改为逐个读取外部 .js 文件分析。");
  if (external.length) {
    console.log("\n外部脚本列表:");
    external.forEach((s, i) => console.log(`  [${i + 1}] ${s}`));
  }
  process.exit(0);
}

fs.mkdirSync(OUTDIR, { recursive: true });

inline.sort((a, b) => b.body.length - a.body.length);

console.log("\n内联脚本体积（降序）:");
inline.forEach((s, i) => {
  console.log(`  inline-${i + 1}.js  ${(s.body.length / 1024).toFixed(1)} KB   type=${s.type}`);
});

if (external.length) {
  console.log("\n外部脚本:");
  external.forEach((s) => console.log(`  ${s}`));
}

// ---------- 2. 落盘 ----------
const written = [];
inline.forEach((s, i) => {
  const p = path.join(OUTDIR, `inline-${i + 1}.js`);
  fs.writeFileSync(p, s.body);
  written.push(p);
});
const totalKB = (written.reduce((a, p) => a + fs.statSync(p).size, 0) / 1024).toFixed(1);
console.log(`\n已写出 ${written.length} 个文件到 ${OUTDIR}/  合计 ${totalKB} KB`);

// ---------- 3. 美化（可选） ----------
if (DO_BEAUTIFY) {
  const targets = BEAUTIFY_ALL ? written : [written[0]];
  console.log("\n美化中（npx js-beautify，首次需联网）…");
  let failed = 0;
  for (const p of targets) {
    const out = p.replace(/\.js$/, ".pretty.js");
    // Windows 上 .cmd 不能直接 spawn；统一交给 shell 处理。
    // 参数各自加引号并转义，避免路径中的 shell 元字符造成注入。
    const q = (s) => '"' + String(s).replace(/(["\\])/g, "\\$1") + '"';
    const cmd = ["npx", "-y", "js-beautify@1.15.4", "-f", q(p), "-o", q(out)].join(" ");
    const r = spawnSync(cmd, { shell: true, stdio: "ignore", timeout: 180000 });
    if (r.status === 0 && fs.existsSync(out)) {
      console.log(`  ${out}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
    } else {
      failed++;
      console.log(`  跳过 ${path.basename(p)}（本环境无法派生 npx）`);
    }
  }
  if (failed) {
    // 环境不允许脚本内派生进程时，给出可直接在 shell 执行的确切命令。
    console.log("\n  可手动执行以下命令完成美化：");
    for (const p of targets) {
      const out = p.replace(/\.js$/, ".pretty.js");
      console.log(`    npx -y js-beautify@1.15.4 -f "${p}" -o "${out}"`);
    }
    console.log("  （美化只影响可读性，不影响后续人工阅读原文）");
  }
}

// ---------- 4. 关键字频次 ----------
if (SHOW_API) {
  const src = inline.map((s) => s.body).join("\n");

  const GROUPS = {
    "Canvas 绘制": [
      [String.raw`\.filter\s*=`, "filter 赋值（滤镜）"],
      ["getImageData", "getImageData"],
      ["putImageData", "putImageData"],
      ["createImageData", "createImageData"],
      [String.raw`createPattern`, "createPattern"],
      ["createLinearGradient", "线性渐变"],
      ["createRadialGradient", "径向渐变"],
      ["createConicGradient", "锥形渐变"],
      ["globalCompositeOperation", "合成模式"],
      ["globalAlpha", "全局透明"],
      [String.raw`\.clip\s*\(`, "clip 裁剪"],
      ["setLineDash", "虚线"],
      ["drawImage", "drawImage"],
      ["bezierCurveTo", "三次贝塞尔"],
      ["quadraticCurveTo", "二次贝塞尔"],
      ["arcTo", "arcTo"],
      [String.raw`\.ellipse\s*\(`, "ellipse"],
      ["shadowBlur", "阴影"],
    ],
    "字体": [
      ["FontFace", "FontFace 构造"],
      [String.raw`document\.fonts`, "document.fonts"],
      ["loadFontFace", "loadFontFace（小程序）"],
      ["unicode-range", "unicode-range 分片"],
      ["woff2", "woff2"],
      [String.raw`\.ttf`, "ttf"],
    ],
    "存储与网络": [
      ["localStorage", "localStorage"],
      ["sessionStorage", "sessionStorage"],
      ["indexedDB", "indexedDB"],
      ["fetch\\s*\\(", "fetch"],
      ["XMLHttpRequest", "XHR"],
      ["WebSocket", "WebSocket"],
      ["new Worker", "Web Worker"],
    ],
    "音频与媒体": [
      ["AudioContext", "Web Audio"],
      ["MediaRecorder", "MediaRecorder"],
      ["getUserMedia", "getUserMedia"],
      ["captureStream", "captureStream"],
    ],
    "导出与编码": [
      ["toDataURL", "toDataURL"],
      ["toBlob", "toBlob"],
      ["convertToBlob", "convertToBlob"],
      ["gifenc|GIFEncoder", "GIF 编码库"],
      [String.raw`\bGIF\b`, "GIF 字面量"],
    ],
    "图形与运行时": [
      ["Path2D", "Path2D"],
      ["DOMMatrix", "DOMMatrix"],
      ["setTransform", "setTransform"],
      ["OffscreenCanvas", "OffscreenCanvas"],
      ["WebGL", "WebGL"],
      ["requestAnimationFrame", "rAF"],
    ],
    "包特征": [
      ["__webpack_require__", "webpack"],
      ["sourceMappingURL", "sourcemap 引用"],
      [String.raw`\bimport\s*\(`, "动态 import"],
      [String.raw`\brequire\s*\(`, "require"],
    ],
  };

  const count = (pat) => {
    try {
      return (src.match(new RegExp(pat, "g")) || []).length;
    } catch {
      return 0;
    }
  };

  const byGroup = new Map();
  const zeros = [];
  const push = (group, label, n) => {
    if (!n) {
      zeros.push({ group, label });
      return;
    }
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push({ label, n });
  };
  for (const [group, items] of Object.entries(GROUPS)) {
    for (const [pat, label] of items) push(group, label, count(pat));
  }
  for (const k of CUSTOM_KEYS) {
    push("自定义", k, count(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  // 组间按组内总数降序；组内按次数降序。保证同一组连续出现。
  const groups = [...byGroup.entries()]
    .map(([name, items]) => ({
      name,
      items: items.sort((a, b) => b.n - a.n),
      total: items.reduce((a, x) => a + x.n, 0),
    }))
    .sort((a, b) => b.total - a.total);

  console.log("\n" + "=".repeat(64));
  console.log("关键字频次（出现次数 > 0）");
  console.log("=".repeat(64));
  let shown = 0;
  outer: for (const g of groups) {
    console.log(`\n[${g.name}]  (命中 ${g.total})`);
    for (const it of g.items) {
      if (shown++ >= TOP) break outer;
      console.log(`  ${String(it.n).padStart(5)}  ${it.label}`);
    }
  }

  const notable = zeros.filter((z) =>
    /filter 赋值|createPattern|getImageData|globalCompositeOperation|WebGL|AudioContext|Path2D|DOMMatrix|OffscreenCanvas/.test(
      z.label
    )
  );
  if (notable.length) {
    console.log("\n" + "-".repeat(64));
    console.log("重要项「未使用」（可据此排除整条实现路线）");
    console.log("-".repeat(64));
    notable.forEach((z) => console.log(`  NOT USED  ${z.label}`));
  }
}

console.log("\n完成。下一步：顺主导链路读最大的那块，重点看配置表与核心变换。");
