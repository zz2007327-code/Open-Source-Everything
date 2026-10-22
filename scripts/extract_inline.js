#!/usr/bin/env node
/**
 * extract_inline.js — Extract inline scripts from HTML, beautify them for readability, and count keyword frequencies
 *
 * Purpose: turn "does it actually use X" from a guess into a fact. Run the counts first, then decide which segment to read.
 *
 * Usage:
 *   node extract_inline.js <input.html> [options]
 *
 * Options:
 *   --out <dir>      Output directory (default: rea-work)
 *   --beautify       Generate .pretty.js for the largest inline script (requires npx js-beautify)
 *   --all            With --beautify, beautify every inline script
 *   --api            Print the keyword frequency table (on by default)
 *   --no-api         Disable the frequency table
 *   --keys "a,b,c"   Append custom keywords
 *   --top <n>        Show at most n rows in the frequency table (default: 60)
 *
 * Output:
 *   <dir>/inline-1.js         The largest inline script (named by descending size)
 *   <dir>/inline-1.pretty.js  Generated with --beautify
 *   stdout                    Per-block sizes, external script list, keyword frequency table, notable "not used" list
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

/** Print the header block only: strip the shebang, then the opening /** and the closing *. */
function printUsage() {
  const head = fs.readFileSync(__filename, "utf8").split("*/")[0];
  console.log(
    head
      .replace(/^#![^\n]*\n/, "")
      .replace(/^\/\*\*?[ \t]?/, "")
      .replace(/^\n+/, "")
  );
}

const argv = process.argv.slice(2);
if (!argv.length || argv[0] === "-h" || argv[0] === "--help") {
  printUsage();
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
// --top 0 means "show nothing", not "fall back to the default"
const LIMIT = Number.isFinite(TOP) && TOP >= 0 ? TOP : 60;
const CUSTOM_KEYS = (opt("--keys", "") || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!fs.existsSync(input)) {
  console.error(`Input file not found: ${input}`);
  process.exit(1);
}
const html = fs.readFileSync(input, "utf8");

// ---------- 1. Split script tags ----------
// Only executable JavaScript counts. Template blocks (<script type="text/x-handlebars-template">),
// JSON data islands (<script type="application/json">), importmaps and speculation rules are HTML
// content that happens to sit inside a <script> tag. Counting them would let markup text pollute the
// frequency table, and that table is the basis of the "does it use X" judgement in Phase 1.
const JS_TYPES = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
  "module",
]);

const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const inline = [];
const external = [];
const nonJs = [];
let m;
while ((m = re.exec(html))) {
  const attrs = m[1] || "";
  const body = m[2] || "";
  const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (srcMatch) {
    external.push(srcMatch[2] || srcMatch[3] || srcMatch[4] || "");
  } else if (body.trim().length) {
    const typeMatch = attrs.match(/\btype\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rawType = (typeMatch && (typeMatch[2] || typeMatch[3] || typeMatch[4])) || "";
    const type = rawType.trim().toLowerCase();
    if (JS_TYPES.has(type)) {
      inline.push({ body, type: type || "text/javascript", attrs: attrs.trim() });
    } else {
      nonJs.push({ body, type, attrs: attrs.trim() });
    }
  }
}

console.log("=".repeat(64));
console.log(`Input: ${input}  (${(html.length / 1024).toFixed(1)} KB)`);
console.log(
  `Inline scripts: ${inline.length} block(s)   External scripts: ${external.length}` +
    (nonJs.length ? `   Non-JS <script> skipped: ${nonJs.length}` : "")
);
console.log("=".repeat(64));

if (!inline.length) {
  console.log("\nNo executable inline scripts. If the target is a bundled build, read the external .js files individually instead.");
  if (external.length) {
    console.log("\nExternal script list:");
    external.forEach((s, i) => console.log(`  [${i + 1}] ${s}`));
  }
  if (nonJs.length) {
    console.log("\nNon-JS <script> blocks present (template / data island — not excluded from analysis, just not counted):");
    nonJs.forEach((s, i) =>
      console.log(`  [${i + 1}] type=${s.type}  ${(s.body.length / 1024).toFixed(1)} KB`)
    );
  }
  process.exit(0);
}

fs.mkdirSync(OUTDIR, { recursive: true });

inline.sort((a, b) => b.body.length - a.body.length);

console.log("\nInline script sizes (descending):");
inline.forEach((s, i) => {
  console.log(`  inline-${i + 1}.js  ${(s.body.length / 1024).toFixed(1)} KB   type=${s.type}`);
});

if (external.length) {
  console.log("\nExternal scripts:");
  external.forEach((s) => console.log(`  ${s}`));
}

// ---------- 2. Write to disk ----------
const written = [];
inline.forEach((s, i) => {
  const p = path.join(OUTDIR, `inline-${i + 1}.js`);
  fs.writeFileSync(p, s.body);
  written.push(p);
});
const totalKB = (written.reduce((a, p) => a + fs.statSync(p).size, 0) / 1024).toFixed(1);
console.log(`\nWrote ${written.length} file(s) to ${OUTDIR}/  (${totalKB} KB total)`);

// ---------- 3. Beautify (optional) ----------
if (DO_BEAUTIFY) {
  const targets = BEAUTIFY_ALL ? written : [written[0]];
  console.log("\nBeautifying (npx js-beautify; first run needs network)…");
  let failed = 0;
  for (const p of targets) {
    const out = p.replace(/\.js$/, ".pretty.js");
    // On Windows a .cmd cannot be spawned directly; route everything through the shell.
    // Quote each argument and escape it to avoid shell metacharacter injection from paths.
    const q = (s) => '"' + String(s).replace(/(["\\])/g, "\\$1") + '"';
    const cmd = ["npx", "-y", "js-beautify@1.15.4", "-f", q(p), "-o", q(out)].join(" ");
    const r = spawnSync(cmd, { shell: true, stdio: "ignore", timeout: 180000 });
    if (r.status === 0 && fs.existsSync(out)) {
      console.log(`  ${out}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
    } else {
      failed++;
      console.log(`  Skipped ${path.basename(p)} (this environment cannot spawn npx)`);
    }
  }
  if (failed) {
    // When the environment forbids spawning child processes, print the exact command to run in a shell.
    console.log("\n  Run the following manually to finish beautifying:");
    for (const p of targets) {
      const out = p.replace(/\.js$/, ".pretty.js");
      console.log(`    npx -y js-beautify@1.15.4 -f "${p}" -o "${out}"`);
    }
    console.log("  (Beautifying only affects readability; it does not affect reading the original source.)");
  }
}

// ---------- 4. Keyword frequencies ----------
if (SHOW_API) {
  const src = inline.map((s) => s.body).join("\n");

  const GROUPS = {
    "Canvas drawing": [
      [String.raw`\.filter\s*=`, "filter assignment (filters)"],
      ["getImageData", "getImageData"],
      ["putImageData", "putImageData"],
      ["createImageData", "createImageData"],
      [String.raw`createPattern`, "createPattern"],
      ["createLinearGradient", "linear gradient"],
      ["createRadialGradient", "radial gradient"],
      ["createConicGradient", "conic gradient"],
      ["globalCompositeOperation", "composite mode"],
      ["globalAlpha", "global alpha"],
      [String.raw`\.clip\s*\(`, "clip"],
      ["setLineDash", "dashed lines"],
      ["drawImage", "drawImage"],
      ["bezierCurveTo", "cubic bezier"],
      ["quadraticCurveTo", "quadratic bezier"],
      ["arcTo", "arcTo"],
      [String.raw`\.ellipse\s*\(`, "ellipse"],
      ["shadowBlur", "shadow"],
    ],
    "Fonts": [
      ["FontFace", "FontFace constructor"],
      [String.raw`document\.fonts`, "document.fonts"],
      ["loadFontFace", "loadFontFace (mini program)"],
      ["unicode-range", "unicode-range slicing"],
      ["woff2", "woff2"],
      [String.raw`\.ttf`, "ttf"],
    ],
    "Storage & network": [
      ["localStorage", "localStorage"],
      ["sessionStorage", "sessionStorage"],
      ["indexedDB", "indexedDB"],
      ["fetch\\s*\\(", "fetch"],
      ["XMLHttpRequest", "XHR"],
      ["WebSocket", "WebSocket"],
      ["new Worker", "Web Worker"],
    ],
    "Audio & media": [
      ["AudioContext", "Web Audio"],
      ["MediaRecorder", "MediaRecorder"],
      ["getUserMedia", "getUserMedia"],
      ["captureStream", "captureStream"],
    ],
    "Export & encoding": [
      ["toDataURL", "toDataURL"],
      ["toBlob", "toBlob"],
      ["convertToBlob", "convertToBlob"],
      ["gifenc|GIFEncoder", "GIF encoder library"],
      [String.raw`\bGIF\b`, "GIF literal"],
    ],
    "Graphics & runtime": [
      ["Path2D", "Path2D"],
      ["DOMMatrix", "DOMMatrix"],
      ["setTransform", "setTransform"],
      ["OffscreenCanvas", "OffscreenCanvas"],
      ["WebGL", "WebGL"],
      ["requestAnimationFrame", "rAF"],
    ],
    "Bundle signatures": [
      ["__webpack_require__", "webpack"],
      ["sourceMappingURL", "sourcemap reference"],
      [String.raw`\bimport\s*\(`, "dynamic import"],
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
    push("Custom", k, count(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  // Sort groups by their internal total (descending); sort items within a group by count (descending).
  // This keeps each group's entries contiguous.
  const groups = [...byGroup.entries()]
    .map(([name, items]) => ({
      name,
      items: items.sort((a, b) => b.n - a.n),
      total: items.reduce((a, x) => a + x.n, 0),
    }))
    .sort((a, b) => b.total - a.total);

  console.log("\n" + "=".repeat(64));
  console.log("Keyword frequencies (occurrences > 0)");
  console.log("=".repeat(64));
  let shown = 0;
  outer: for (const g of groups) {
    if (shown >= LIMIT) break;
    console.log(`\n[${g.name}]  (${g.total} hits)`);
    for (const it of g.items) {
      if (shown >= LIMIT) break outer;
      shown++;
      console.log(`  ${String(it.n).padStart(5)}  ${it.label}`);
    }
  }

  const notable = zeros.filter((z) =>
    /filter assignment|createPattern|getImageData|globalCompositeOperation|WebGL|AudioContext|Path2D|DOMMatrix|OffscreenCanvas/.test(
      z.label
    )
  );
  if (notable.length) {
    console.log("\n" + "-".repeat(64));
    console.log('Notable items "NOT USED" (you can rule out a whole implementation route from these)');
    console.log("-".repeat(64));
    notable.forEach((z) => console.log(`  NOT USED  ${z.label}`));
  }
}

console.log("\nDone. Next step: read the largest block along the dominant path, focusing on the config tables and the core transform.");
