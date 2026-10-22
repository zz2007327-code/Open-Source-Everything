# Phase 2 Gate Execution Standard: Critical-Link Verification

Phase 2's admission rule is "**no spec may be written before the decisive links are verified**".

This file is Phase 2's execution standard. The gate takes this form:
**verify only 1–3 decisive links, and produce no runnable page.**
Execution details from the replica era are kept in the appendix at the end, read only when the "add a replica segment" conditions in SKILL.md hold.

---

## 0. Two Prerequisite Disciplines

These two are worth more than any verification checklist — violating them causes an entire module to be reworked.

### 0.1 Mechanism source text first: do not write an effect's behavior into the spec before reading the source function that carries it

For any **visual/behavioral mechanism** that will enter the spec, you must locate and read the function that carries it in the source before writing.

The test is simple — ask yourself one question before writing:

> **What is the source function for this effect, and which line is it on?**

If you cannot answer, you have not read enough; do not put it in the spec.

Writing after reaching the truth versus guessing from appearance differs by **an entire module**:

- Counter-example (real): a "lace border" was understood from appearance as **vector stroking**, and a set of colored jagged paths was hand-drawn; only after reading the source did the real mechanism turn out to be **pre-rendered decorative tiles + `drawImage` tiling**, plus a stitch-by-stitch border line. → The entire lace rendering function was rewritten from scratch and the corresponding spec section voided.
- The most expensive thing about putting an approximation into a spec is that **it becomes the baseline for every subsequent comparison**. Once the look is "about right", you lose the motivation to discover that the mechanism differs, until a downstream implementation finally goes wrong.

### 0.2 Zero invented numbers: every constant has only two legitimate sources

Every magic number in the spec may come only from:

1. A **source constant** (copy its value directly); or
2. A **source expression** (copy the formula, substitute the same inputs).

"There, I improvised something close enough" is not allowed — an approximation makes the spec "similar but not correct", and such deviations are extremely hard to attribute during implementation.

- Counter-example (real): per-glyph random parameters were written as `.95+rnd()*.14` (the source has `.84+rnd()*.32`); glyph width used `adv * size` (the source uses the **constant `1.04em`**); per-glyph `turn` rotation and per-line `lineWobble` were omitted. → The entire layout spec was rewritten.

> Self-check action: **grep each magic number in the spec back to the source**. Any that do not match is invented.

---

## 1. Narrow Down the Decisive Links

**A decisive link = a place where, if misunderstood, the whole spec goes crooked.**

Not every link deserves deep verification. Spend a few minutes narrowing them down; typically there are only **1–3**.

### 1.1 Criteria

A link is decisive if and only if it satisfies any one of:

| Criterion | Example |
|------|------|
| It produces a **data structure** shared across the whole chain | A layout grid, a geometry point table, an intermediate-state object |
| Its mechanism is **counter-intuitive** and near-certain to be guessed wrong from appearance | A "lace border" is actually tile tiling, not stroking |
| It determines the **performance or memory magnitude** | Whether something is recomputed every frame, whether it is cached offscreen |
| It is the **source of interaction/timing** | Event → state machine → the update chain it triggers |
| It determines the **most visually prominent part** | The main render function, the composite mode |

### 1.2 Convergence Discipline

- More than **3** narrowed down → you have not converged; go back to Phase 1 and reread the source rather than verifying each one doggedly.
- Cannot narrow down any decisive link → the target's mechanism is simple; Phase 2 can use the single "source citation" path in §2. Do not manufacture busywork.
- The user already pointed at a specific module → that module is the decisive link; verify nothing else.

---

## 2. Three Verification Paths (cheapest first)

**Path 1 is the default. Taking Path 3 requires stating the reason first.**

### Path 1 — Source Citation (cheapest, default)

Write no code at all; do only three things:

1. Locate and transcribe the source snippet that carries the mechanism (with file and line numbers).
2. Annotate line by line how that code produces the claimed behavior.
3. Collect every constant that appears into a table: `constant name / value / source line / role`.

Deliverable shape (goes straight into Phase 3):

| Mechanism | Carrying function (file:line) | Key snippet | Constant table | Conclusion strength |
|------|--------------------|---------|--------|---------|
| Main render compositing | bundle.js:8821–8890 | 3–5 line excerpt | overlay alpha 0.92 / blur 12 | Source-confirmed |

**Why this path suffices**: a spec's job is to let someone implement, not to let someone accept rendered output. Source citation is enough to support "how to do it", and it carries **no rework risk** — because there is no intermediate implementation for you to get wrong.

### Path 2 — Numeric Cross-Check

Substitute the source expression with concrete inputs and list "input → output" in a table to confirm the magnitude is sane.

- Good: `w = 1000px` → `amplitude = w*0.34 = 340px`; `wrap period = w*3.2 = 3200px`
- Purpose: catch **unit errors** and **magnitude errors** (treating em as px, degrees as radians, a ratio as an absolute value).
- Conveniently fill the probe's measured values into the same table for comparison:

| Quantity | Spec value (computed from the source expression) | Runtime measured (read via probe injection) | Consistent? |
|----|------------------------|--------------------------|---------|
| Total elements | 340 | 341 | Off by 1 (possible last-digit rounding, explained) |
| Canvas size | 1000×600 | 1000×600 | Consistent |

> Measured values come from `scripts/cdp_probe.js` `EVAL=`, injected directly into the **real target** — no replica needed.

### Path 3 — Minimal Reproduction (last resort)

**Use only when paths 1 and 2 cannot decide.** Shape requirements:

- **Cover only this one link**, never the full chain;
- May be a few lines of node / a canvas snippet / a single `EVAL=` injection, **not necessarily a self-contained HTML page**;
- No requirement to attach `__dbg()` / `__tick()` unless the user wants it as teaching material;
- The purpose is to answer a specific question (e.g. "what color does this blend mode actually output"), not "prove I can reproduce an equivalent effect".

Do not let throwaway work land on disk as a large file; if it must be kept, keep only the snippet + conclusion.

---

## 3. Gate Pass Criteria

Before entering Phase 3, check item by item:

- [ ] The **decisive links** for this task (1–3) are explicitly listed, with a rationale for each.
- [ ] Every decisive link points to a **source location** (file:line), a **piece of measured data**, or an **annotated screenshot**.
- [ ] Every magic number entering the spec has been **grepped back to the source**.
- [ ] Any "I don't know" statement in the spec went into "Unknowns and Unverified Items" rather than appearing in the body as a conclusion.
- [ ] Verification gaps caused by insufficient environment capability are honestly marked as **evidence gaps** with the basis stated.

> **One hard criterion**: if a sentence in the spec body points to no source/data/screenshot and did not go into the unknowns section, it is an unverified guess — go back and verify it.

---

## 4. How to Write an Evidence Gap

When insufficient environment capability (no WebGL, target requires real hardware, requires a logged-in state, etc.) prevents verification:

- Mark it honestly in the spec: "**This environment cannot verify X, because Y**";
- State that the conclusion rests on **source structure** rather than rendered output;
- Write it into the "Risks and Open Items" section.

> **A gap is not the problem; fabricated evidence is.**

---

## 5. Two Hard Facts About the Evidence Environment

| Fact | Impact | Action |
|------|------|------|
| Headless Chromium has **no WebGL by default** (`getContext('webgl2'\|'webgl')` returns `false`) | Targets relying on WebGL (Three.js, etc.) have **rendered output that cannot be observed directly** | Use the probe's `SOFTWEBGL=1` (`--enable-unsafe-swiftshader --use-angle=swiftshader`). **This reliably yields `WebGL 2.0`**. If it still fails, record an evidence gap per §4 |
| **rAF is throttled** on `file://` pages (remote pages are fine) | If you take the add-on replica segment, local-page animation "freezes" | Use a `setInterval` fallback + `__tick()` deterministic stepping (see appendix §A3) |

---

## 6. Performance: Look at Errors First, Then Timing

**When frame time is extreme, suspect an exception thrown every frame before suspecting a slow algorithm.**

When investigating a performance problem, do two things first:

1. Read the exceptions. The probe emits them at three layers, and `env` now mirrors all three so one read is enough:
   `env.bootErrs` (JS hook, initialization-time) / `env.exceptions` (CDP `Runtime.exceptionThrown`) / `env.consoleErrors` + `env.cdpConsoleErrors`.
   The authoritative copies also live at the top level of the JSON report (`report.exceptions` / `report.consoleErrors`).
   The overhead driven by exceptions is often an order of magnitude larger than the algorithm itself.
2. While reading timings, confirm **which link level** the time goes to, rather than guessing.

Only when there is no exception and the timing is still high should you discuss algorithmic optimization (caching, downsampling, offscreen compositing).

---

# Appendix — For Add-on Replica Segments Only

> **Read this appendix only when one of the three "add a replica segment" conditions in SKILL.md holds.**
> The main chain does not come here by default — **do not build a page just because you read these requirements**.

## A1. Shape Requirements for an Add-on Replica Segment

- Single-file, self-contained, no external dependencies;
- **Reproduce only the decisive links**, never the full chain;
- Visualize each step as side-by-side stages where possible (e.g. "rasterize → skeleton → polyline → elements → finished");
- If the user explicitly wants it as teaching material, then attach self-check probes.

## A2. Self-Check Probes (required only when delivering to others as teaching material)

### `window.__dbg()` — returns structured state

| Field | Meaning | Why it is needed |
|------|------|-----------|
| `bootErr` | Array of boot-time throws (`try{ boot() }catch`) | **Most critical**. See §A3 row 1 |
| `errs` | Array of runtime errors | Distinguishes "did not draw" from "drew but threw" |
| `frames` | Actual rAF frame count | Determines whether rAF is throttled |
| `progress` / `done` | Progress / completed count | Determines whether the animation is really advancing |
| `stage` | Current processing stage | Determines which link level it is stuck at |
| `midPx` etc. | Pixel sample at screen center | Determines "did it draw offscreen" |
| `frameMs` | Per-frame time | Determines performance and incidentally exposes "an exception thrown every frame" |
| `dpr` / `zoom` / `ox` / `oy` | Viewport and transform | Troubleshoots coordinate-space misalignment |

### `window.__tick(n, dt)` — deterministic stepping

Does not depend on rAF; manually advances n frames, each with a fixed dt. Use: run the full chain even when rAF is unreliable in a headless environment; results are reproducible, so comparisons are comparable. Implementation-wise, factor the main loop into `tick(dt)`; `loop(now)` only does `dt = clamp(...)` and then calls `tick(dt)`.

Pair it with an **rAF fallback timer**: `setInterval(() => { if (now - lastRafAt > 250) tick(...); }, 1000/60)`.

## A3. Common Replica Bug Table

Recorded as "symptom → root cause → action". **The symptom is often wrong, and the root cause is often not where you think it is.**

| # | Symptom | Root cause | Action |
|---|------|------|------|
| 1 | `errs` is empty but the page is clearly broken; the probe reports no error either | The error occurs **during script initialization**, while the error hook was injected after page load | ① Build `window.__bootErr` in the page; ② switch the probe to `Page.addScriptToEvaluateOnNewDocument` (this skill's probe already injects at document-start) |
| 2 | A local replica's animation does not move at all | rAF is throttled on `file://` pages (remote pages are fine) | Add a `setInterval` fallback + `__tick()` deterministic stepping |
| 3 | Progress is negative and it never renders | The first rAF timestamp can precede script load time → `dt` is negative | `dt = clamp((t - lastMs)/1000, 0, 0.05)` |
| 4 | The screen goes blank after changing the canvas size | Changing canvas dimensions clears the canvas, and the next frame may not arrive | Call `draw()` **directly** at the end of `build()`/`resize` instead of waiting for rAF |
| 5 | Per-frame time is 500ms+, too laggy to debug | Not a slow algorithm — **an exception thrown every frame**: an `rgba(...)` color string was multiplied by a coefficient → `gradient.addColorStop('NaN')` | Look at `errs` immediately. Always pass **numeric components** `(r,g,b,a)` for gradients/colors |
| 6 | `drawImage` throws | An array was passed instead of a canvas | Check each passed object's type |
| 7 | Throws `X is not defined` | A **leftover call site** from a previous module rewrite | Grep the old function name and clean it out |
| 8 | The whole fabric runs offscreen (one solid color fill) | Forgot to map "world coordinates" to "viewport coordinates" | Introduce `originX/originY` explicitly; before drawing, `setTransform(DPR*z,0,0,DPR*z, DPR*ox, DPR*oy)` |
| 9 | Text overlaps the decorative edge | Layout used unscaled margins while decoration used scaled values | Have both read the **same** already-scaled quantity |
| 10 | The look is just slightly off from the target and will not converge | Defaults/constants were invented (see §0.2) | Grep each magic number back to the source |

## A4. Run a Replica With the Probe, Not With Your Eyes

```bash
export CHROME_PATH="<chromium>"
PORT=9601 OUT=replica-shot.png WAIT=2500 \
  EVAL="JSON.stringify(window.__dbg())" \
  node <skill>/scripts/cdp_probe.js "file:///<abs>/replica.html"
```

The probe returns the three-layer error view (`bootErrs` / `exceptions` / `consoleErrors`) in `env`.
