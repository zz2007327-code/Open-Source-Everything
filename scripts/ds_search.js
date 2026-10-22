#!/usr/bin/env node
/**
 * ds_search.js — cost-optimised DeepSeek-V4.1-Flash-1017 Search / Fetch client (S3 evidence source)
 *
 * Endpoints (references/web-research.md §2.4, §3.4):
 *   POST https://api.deepseek.com/v1/tools/search
 *   POST https://api.deepseek.com/v1/tools/fetch
 *
 * Auth: bearer token via DEEPSEEK_API_KEY. No keyless mode. Without a key this exits 2 and the
 * caller must drop research to [S3-c] hypothesis notes (SKILL.md Phase 1 step 9).
 *
 * ── Cost model ────────────────────────────────────────────────────────────────────────────────
 * Billing is PER REQUEST, not per result and not per token: $0.75 / 1,000 successful calls.
 * Therefore the only way to spend less is to issue FEWER REQUESTS. Everything below exists for
 * that one goal, and every run reports exactly what it saved.
 *
 *   search  <query>            one request
 *   search  --batch q1 ; q2    N queries folded into ONE request (OR-joined) and split locally
 *   fetch   <url>              one request, unless it is already in the local cache
 *   fetch   <url> --probe      zero requests: reuse the body from an earlier search instead
 *
 * Usage:
 *   node ds_search.js search "<query>"
 *   node ds_search.js search --batch "q1 ; q2 ; q3"
 *   node ds_search.js fetch "<url>" [--probe]
 *   node ds_search.js cache [--stats|--clear]
 *   node ds_search.js plan "<query1 ; query2 ; ...>"    # show what a batch would cost, spend nothing
 *
 * Environment variables:
 *   DEEPSEEK_API_KEY   required, bearer token
 *   COUNT=<1-50>       results per request (default 10). Price is identical for count 3 and count 50,
 *                      so a larger count is free headroom — raise it before adding a second query
 *   CONTENT=1          need_content:true — page bodies inline (cold-start recon)
 *   ORI=<text>         ori_question — the user's original question
 *   LOCALIZATION=<ip>  localize results for geo-gated targets
 *   BASE=<url>         API base (default https://api.deepseek.com)
 *   JSON=<path>        write the raw response to disk
 *   CACHE=<dir>        cache directory (default .ds-cache next to this script)
 *   CACHE_TTL=<hours>  cache lifetime (default 168 = 7 days); 0 disables the cache
 *   NO_CACHE=1         neither read nor write the cache (for a deliberate fresh run)
 *   FORCE=1            bypass the cache read for this call (still refreshes the entry)
 *
 * Output: one line per result carrying the mechanical [S3-a|b|c] grade (§4.1), then a cost report
 * on stderr: requests issued, requests avoided, and the dollar figure those avoided requests
 * represent at the official rate.
 *
 * Exit codes:
 *   0 ok · 2 no key · 3 bad args · 4 HTTP error (mapped to the §3.4 evidence-log wording)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── Official rate, used only to report savings. Never billed by this script. ──────────────────
const USD_PER_1K_REQUESTS = 0.75;

// Default to the skill root (one level up from scripts/) so `cache --stats` in a shell after a run
// finds the same directory a run wrote to, regardless of the caller's cwd.
const CACHE_DIR = process.env.CACHE || path.join(__dirname, "..", ".ds-cache");
const CACHE_TTL_H = process.env.CACHE_TTL === undefined ? 168 : Number(process.env.CACHE_TTL);
const CACHE_ON = CACHE_TTL_H > 0 && process.env.NO_CACHE !== "1";

function usage() {
  const head = fs.readFileSync(__filename, "utf8").split("*/")[0];
  console.log(head.replace(/^#![^\n]*\n/, "").replace(/^\/\*\*?[ \t]?/, "").replace(/^\n+/, ""));
}

// ── Cache ────────────────────────────────────────────────────────────────────────────────────
// Content-addressed on (kind, payload) so that a repeated query or a re-fetch of the same URL
// costs nothing. This is the single largest saving in practice: reconnaissance passes re-issue
// near-identical queries, and fetch is routinely called on a page search already returned.
function cachePath(kind, payload) {
  const h = crypto.createHash("sha256").update(kind + "\u0000" + payload).digest("hex").slice(0, 32);
  return path.join(CACHE_DIR, `${kind}-${h}.json`);
}

function cacheGet(kind, payload) {
  if (!CACHE_ON || process.env.FORCE === "1") return null;
  const p = cachePath(kind, payload);
  try {
    const st = fs.statSync(p);
    const ageH = (Date.now() - st.mtimeMs) / 3.6e6;
    if (ageH > CACHE_TTL_H) return null;
    const rec = JSON.parse(fs.readFileSync(p, "utf8"));
    rec._cache = { hit: true, ageH: Number(ageH.toFixed(1)), path: p };
    return rec;
  } catch {
    return null;
  }
}

function cachePut(kind, payload, value) {
  if (!CACHE_ON) return;
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(kind, payload), JSON.stringify(value));
  } catch {
    /* a cache is an optimisation; never fail the run over it */
  }
}

// ── Cost ledger ──────────────────────────────────────────────────────────────────────────────
// Every avoidable request is recorded here so the saving is reported as a number, not a claim.
const ledger = { issued: 0, avoided: 0, reasons: [] };
const note = (reason, n = 1) => {
  ledger.avoided += n;
  const hit = ledger.reasons.find((r) => r.reason === reason);
  if (hit) hit.n += n;
  else ledger.reasons.push({ reason, n });
};

function costReport() {
  const money = (n) => `$${((n * USD_PER_1K_REQUESTS) / 1000).toFixed(6)}`;
  const baseline = ledger.issued + ledger.avoided;
  console.error("\n── S3 cost ─────────────────────────────────────────────");
  console.error(`  requests issued   ${ledger.issued}`);
  console.error(`  requests avoided  ${ledger.avoided}`);
  for (const r of ledger.reasons) console.error(`      ${r.n}× ${r.reason}`);
  console.error(
    `  without this layer ${baseline} requests = ${money(baseline)};` +
      ` actually ${ledger.issued} = ${money(ledger.issued)}`
  );
  if (baseline) {
    const pct = Math.round((ledger.avoided / baseline) * 100);
    console.error(`  saved ${pct}%${pct >= 50 ? "  ← fewer than half the naive cost" : ""}`);
  }
  console.error("────────────────────────────────────────────────────────");
}

// ── Arg parsing ─────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const mode = argv[0];
if (!mode || mode === "-h" || mode === "--help") {
  usage();
  process.exit(mode ? 0 : 3);
}

const FLAGS = new Set(argv.filter((a) => a.startsWith("--")));
const POSITIONAL = argv.slice(1).filter((a) => !a.startsWith("--"));

if (mode === "cache") {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log(`no cache at ${CACHE_DIR}`);
    process.exit(0);
  }
  if (FLAGS.has("--clear")) {
    for (const f of fs.readdirSync(CACHE_DIR)) fs.unlinkSync(path.join(CACHE_DIR, f));
    console.log(`cleared ${CACHE_DIR}`);
    process.exit(0);
  }
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  let bytes = 0;
  for (const f of files) bytes += fs.statSync(path.join(CACHE_DIR, f)).size;
  console.log(`cache ${CACHE_DIR}`);
  console.log(`  entries  ${files.length}`);
  console.log(`  size     ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`  ttl      ${CACHE_TTL_H}h${CACHE_ON ? "" : " (disabled)"}`);
  console.log(`  value    ${files.length} request(s) already paid for = $${((files.length * USD_PER_1K_REQUESTS) / 1000).toFixed(6)}`);
  process.exit(0);
}

if (!["search", "fetch", "plan"].includes(mode)) {
  console.error(`unknown mode: ${mode} (expected search | fetch | plan | cache)`);
  process.exit(3);
}

const KEY = process.env.DEEPSEEK_API_KEY;
if (mode !== "plan" && !KEY) {
  console.error(
    "DEEPSEEK_API_KEY is not set.\n" +
      "S3 is unavailable: these are bearer-authenticated APIs with no keyless mode.\n" +
      "Per SKILL.md Phase 1 step 9, downgrade research output to [S3-c] hypothesis notes\n" +
      "and record the gap in 'Unknowns and Unverified Items'. Do NOT swap in a generic\n" +
      "search engine while keeping the authority/rerank grading.\n" +
      'Free and instant check: `node scripts/ds_search.js plan "q1 ; q2"` works without a key.'
  );
  process.exit(2);
}

const BASE = (process.env.BASE || "https://api.deepseek.com").replace(/\/+$/, "");

const ERRORS = {
  400: "invalid request — fix the query/body before retrying",
  401: "invalid or missing API key",
  402: "insufficient balance — STOP researching; this is not an evidence gap",
  403: "fetch blocked by policy — record as a gap, do NOT retry or reroute",
  404: "no usable content (dead URL / site policy / unsupported type / no extractable Markdown)",
  408: "request-body timeout — retry with backoff",
  413: "request body too large",
  429: "QPS exceeded — back off; the research loop has lost its cap",
  500: "internal error — retry with backoff",
  504: "downstream timeout — retry with backoff",
};

async function call(endpoint, body) {
  ledger.issued++;
  const res = await fetch(BASE + endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const advice = ERRORS[res.status] || (res.status >= 500 ? "upstream failure — retry with backoff" : "unexpected error");
    const msg = (json && json.error && json.error.message) || text.slice(0, 300);
    console.error(`HTTP ${res.status}: ${advice}`);
    if (msg) console.error(`  server said: ${msg}`);
    process.exit(4);
  }
  return json;
}

/** Mechanical S3 grading — web-research.md §4.1. */
function gradeOf(r) {
  const a = typeof r.authority === "number" ? r.authority : -1;
  if (a >= 3 && r.date) return "S3-a";
  if (a >= 1 && a <= 2) return "S3-b";
  return "S3-c";
}

function printResult(r, bodyInline) {
  const auth = typeof r.authority === "number" ? r.authority : "?";
  const rr = typeof r.rerank_score === "number" ? r.rerank_score.toFixed(2) : "?";
  console.log(`[${gradeOf(r)}] auth=${auth} rr=${rr} ${r.date || "null"}  ${r.url}`);
  if (r.title) console.log(`        ${r.title}`);
  if (bodyInline && r.content) console.log(`        content: ${r.content.length} chars (inline)`);
  else if (r.summary) {
    const s = r.summary.replace(/\s+/g, " ");
    console.log(`        ${s.slice(0, 200)}${s.length > 200 ? "…" : ""}`);
  }
}

// ── Batch: fold N queries into one billable request ──────────────────────────────────────────
// The search API accepts OR-joined clauses, so several narrow questions can travel together.
// Results come back as a mixed pool; they are split back apart by matching the query's salient
// tokens against each hit's title + summary. Anything unmatched is kept as a shared tail rather
// than dropped — a lost hit costs more than a slightly noisy group.
const STOP = new Set(
  ("a an the is are was were be to of in on for and or how what why does do site after before " +
    "with without using use this that it its from by as at into vs version release docs source")
    .split(/\s+/)
);

function tokens(s) {
  return new Set(
    String(s)
      .toLowerCase()
      .replace(/site:\S+/g, " ")
      .replace(/after:\S+|before:\S+/g, " ")
      .replace(/[-"()]/g, " ")
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter((t) => t && t.length > 2 && !STOP.has(t))
  );
}

function splitBatch(queries, results) {
  const qTok = queries.map((q) => ({ q, t: tokens(q) }));
  const groups = queries.map((q) => []);
  const shared = [];
  for (const r of results) {
    const hay = tokens(`${r.title || ""} ${r.summary || ""} ${r.url || ""}`);
    let best = -1;
    let bestScore = 0;
    qTok.forEach((item, i) => {
      let s = 0;
      for (const t of item.t) if (hay.has(t)) s++;
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    });
    if (best >= 0 && bestScore >= 1) groups[best].push(r);
    else shared.push(r);
  }
  if (shared.length) groups[groups.length - 1].push(...shared);
  return groups;
}

(async () => {
  // ── plan: cost preview with zero spend ──────────────────────────────────────────────────────
  if (mode === "plan") {
    const raw = POSITIONAL.join(" ");
    const qs = raw.split(";").map((s) => s.trim()).filter(Boolean);
    if (!qs.length) {
      console.error("plan needs at least one query");
      process.exit(3);
    }
    const n = qs.length;
    const batched = 1;
    const cacheable = qs.filter((q) => cacheGet("search", q)).length;
    console.error(`planned ${n} quer${n === 1 ? "y" : "ies"}`);
    console.error(`  one-per-request   ${n} request(s) = $${((n * USD_PER_1K_REQUESTS) / 1000).toFixed(6)}`);
    if (n > 1) {
      console.error(`  batched into one  ${batched} request  = $${((batched * USD_PER_1K_REQUESTS) / 1000).toFixed(6)}`);
    }
    if (cacheable) console.error(`  ${cacheable} already cached — those queries will spend nothing`);
    console.error(`  effective cost    $${(((n - cacheable > 0 ? 1 : 0) * USD_PER_1K_REQUESTS) / 1000).toFixed(6)}`);
    process.exit(0);
  }

  // ── fetch ──────────────────────────────────────────────────────────────────────────────────
  if (mode === "fetch") {
    const url = POSITIONAL[0];
    if (!url) {
      console.error("fetch needs a URL");
      process.exit(3);
    }

    const hit = cacheGet("fetch", url);
    if (hit) {
      note("fetch served from cache");
      if (hit.title) console.error(`# ${hit.title}  (cached ${hit._cache.ageH}h ago, no request issued)`);
      console.log(hit.content || "");
      costReport();
      return;
    }

    // --probe: answer from a body that an earlier search already returned inline.
    // This is the cheapest legitimate way to "fetch" — zero requests.
    if (FLAGS.has("--probe")) {
      const idx = readPageIndex();
      const rec = idx[url];
      if (rec && rec.content) {
        note("fetch answered from earlier search payload (need_content)");
        if (rec.title) console.error(`# ${rec.title}  (from search cache, no request issued)`);
        console.log(rec.content);
        costReport();
        return;
      }
      console.error(
        "--probe found no inline body for this URL.\n" +
          "The earlier search did not run with CONTENT=1, so a real fetch is required.\n" +
          "Rule of thumb: run reconnaissance with CONTENT=1 and probe before fetching."
      );
      process.exit(3);
    }

    const page = await call("/v1/tools/fetch", { url });
    cachePut("fetch", url, page);
    if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(page, null, 2));
    if (page.title) console.error(`# ${page.title}`);
    console.log(page.content || "");
    costReport();
    return;
  }

  // ── search ─────────────────────────────────────────────────────────────────────────────────
  const rawQuery = POSITIONAL.join(" ").trim();
  if (!rawQuery) {
    console.error("search needs a query");
    process.exit(3);
  }

  const queries = FLAGS.has("--batch")
    ? rawQuery.split(";").map((s) => s.trim()).filter(Boolean)
    : [rawQuery];

  // Drop anything already cached before spending a request.
  const pending = [];
  for (const q of queries) {
    const hit = cacheGet("search", q);
    if (hit) {
      note("search query served from cache");
      emitSearch(hit, q, queries.length > 1);
    } else pending.push(q);
  }

  if (!pending.length) {
    costReport();
    return;
  }

  // Fold the remaining queries into a single request. Parenthesised and OR-joined so that each
  // clause's own operators (site:, after:, quoted phrases) stay scoped to that clause.
  const body = {
    query: pending.length === 1 ? pending[0] : pending.map((q) => `(${q})`).join(" OR "),
  };
  // A batched query needs headroom: the same request price buys up to 50 results, so scaling
  // count with the number of clauses is free. Capped at the documented maximum.
  const baseCount = Number(process.env.COUNT || 10);
  body.count = Math.min(50, pending.length === 1 ? baseCount : baseCount * pending.length);
  if (process.env.ORI) body.ori_question = process.env.ORI;
  if (process.env.LOCALIZATION) body.localization = process.env.LOCALIZATION;
  if (process.env.CONTENT === "1") body.need_content = true;

  if (pending.length > 1) {
    // n clauses would have been n requests; they cost 1. The saving is (n-1).
    note(`${pending.length - 1} request(s) collapsed by --batch`, pending.length - 1);
  }

  const out = await call("/v1/tools/search", body);
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(out, null, 2));

  const results = (out && out.results) || [];
  if (!results.length) {
    console.log("(empty result set — not billed; rewrite the query rather than reading harder)");
    costReport();
    return;
  }

  // Index bodies for later --probe use, so a fetch can be answered without a request.
  if (process.env.CONTENT === "1") indexPages(results);

  if (pending.length === 1) {
    cachePut("search", pending[0], out);
    emitSearch(out, pending[0], queries.length > 1);
  } else {
    const groups = splitBatch(pending, results);
    groups.forEach((g, i) => {
      const payload = { results: g, _splitFrom: pending.length };
      cachePut("search", pending[i], payload);
      console.error(`\n── ${pending[i]}`);
      emitSearch(payload, pending[i], true);
    });
    console.error(
      `\nNote: a batched response is split locally by token overlap with each clause. ` +
        `Rerun a clause on its own if a hit looks misassigned — that costs one extra request.`
    );
  }

  const allLow = results.every((r) => Number(r.rerank_score) < 1.5);
  if (allLow) {
    console.error(
      "\nWARNING: every result scored rerank_score < 1.5. That means the QUERY is bad, " +
        "not that the answer is unavailable — rewrite it before reading these."
    );
  }
  console.error(
    "\nReminder: a snippet/summary is a claim about a page. Use `fetch <url> --probe` first " +
      "(free), and only then a real fetch. Never let [S3-*] be the sole support for a decisive link."
  );
  costReport();
})().catch((e) => {
  console.error("request failed:", e.message);
  process.exit(4);
});

function emitSearch(payload, query, labelled) {
  if (labelled) console.log(`\n## ${query}`);
  const rs = payload.results || [];
  if (!rs.length) {
    console.log(`  (no results for this clause)`);
    return;
  }
  const inline = process.env.CONTENT === "1";
  rs.forEach((r) => printResult(r, inline));
}

// ── Page index: URL -> inline body captured during a CONTENT=1 search ────────────────────────
// Resolved lazily: a top-level `const` here would still be in its temporal dead zone when the
// async main flow (which starts before this line is reached) asks for it.
function pageIndexPath() {
  return path.join(CACHE_DIR, "pages.json");
}

function readPageIndex() {
  try {
    return JSON.parse(fs.readFileSync(pageIndexPath(), "utf8"));
  } catch {
    return {};
  }
}

function indexPages(results) {
  if (!CACHE_ON) return;
  try {
    const idx = readPageIndex();
    let changed = false;
    for (const r of results) {
      if (r.url && r.content) {
        idx[r.url] = { title: r.title, content: r.content, at: Date.now() };
        changed = true;
      }
    }
    if (changed) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(pageIndexPath(), JSON.stringify(idx));
    }
  } catch {
    /* non-fatal */
  }
}
