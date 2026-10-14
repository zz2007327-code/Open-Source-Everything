# Document Delivery: the Full tencent-docx Chain

The execution handbook for Phase 4. Following this checklist lets you **pass the quality gate in one shot** and avoid rework.

---

## 1. Routing

Load `tencent-docs-routing` first to determine the task type. "Generate a new document from scratch" → `full_pipeline`,
with the chain fixed as **S1 writing → S2 styling → S3 convert to .docx**. Once composed, the chain must run in order through to S3.

Intermediate artifacts (`.md` / `.html`) **must not** be passed to `present_files`, and the body text must not be pasted into replies;
only the `.docx` from S3 is delivered, and it **must be opened immediately via `present_files`**.

> Note: if the target artifact is a "tech talk page" rather than a "spec document", you may skip this chain and emit a single-file HTML directly.
> This chain targets the case of **delivering a Word document**.

---

## 2. Stage 1 — Writing

`doc-writer` routes to an Expert by keyword. Functional spec documents usually hit no L2 domain expert
(not contract / research report / business copy / tech blog / academic / popular science / work report / poetry), so they land on
**L1 `general-writer`**, `route_tag = general_writing`, `genre = general`, and Critic defaults to `skip`.

Output: `stage1/final_draft.md` — **pure Markdown**, with no YAML frontmatter,
no embedded HTML tags, and headings starting at H1 without skipping levels.

> If the user actually wants a "tech blog" voice (opinionated, narrative), it should hit L2 `tech-blog-expert`.
> A functional spec is a build document, not a blog — staying `general` is correct.

---

## 3. Stage 2 — Styling

With no reference layout document, use `html-template`, and infer `genre` from the content:
"report / analysis report / proposal"-type content hits **`business-report`** (theme `business-modern`).
Output: `stage2/formatted-<theme>.html` + `stage2/design_tokens.json`.

### 3.1 Preset Checklist for Passing html-review in One Shot

`html-review` is a scripted gate (exit code 0 = pass); all six dimensions must pass and the total must be ≥ 80.
**A first failure allows only one targeted fix, no looping** — so it must pass the first time. Write the HTML per this checklist:

| Check | Rule | Consequence of violation |
|--------|------|---------|
| **DT-01 No bare color values** | `<style>` must not contain bare `#xxxxxx` / `rgba(...)`; always `var(--color-*)` | 20 points on the dimension |
| **DT-03 No bare spacing** | No bare `12px`, `0.6em`, `0.5em 0.8em`; always `var(--spacing-*)` or a custom `--space-*` variable | 20 points on the dimension |
| **SI-02 Complete table structure** | **Every** `<table>` must have `<thead>` and `<tbody>` | Includes KV tables and summary-card tables |
| **TQ-01 Paragraph under 500 characters** | A single `<p>` must be ≤ 500 characters | **The same limit applies when a code block uses `<p class="code-block">`** |
| **TQ-03 Body text between headings** | After an `<h2>` there must not be an `<h3>` directly; after an `<h3>` no `<h4>` directly | Add a lead sentence to each chapter |
| **BR-01 Executive summary block** | `business-report` must have `.executive-summary` | Missing it loses points on the genre dimension |

Corrections for common failures:

1. Extract every bare spacing in `<style>` into variables: `--space-xs/sm/md/lg/xl`, `--space-cell-y`, `--space-cell-x`, etc.
2. Change the three `rgba(...)` callout-box backgrounds into variables such as `var(--color-info-bg)` (use hexadecimal soft colors for the values, see §4.2).
3. Add `<thead>/<tbody>` to the summary cards, metric tables, and callout boxes (a visually hidden `<th>` works for headerless tables).
4. Split each of the two over-long code-block `<p>` elements into two.
5. Add a lead sentence after each of the eight `<h2>` headings.
6. Add an `.executive-summary` block (with `summary-header` + metric table + summary cards).

### 3.2 Other Hard Constraints

- The cover and the body are **two adjacent top-level `<section>` elements** under `<body>`:
  `<section role="cover">` + `<section role="body" data-page-restart="1">`.
  All chapters inside the body use `<div>`; do not use top-level `<section>` (it paginates incorrectly).
- Every block-level element on the cover **writes its own** `text-align: center`; it cannot rely on inheritance from the parent
  (the converter does not compute CSS inheritance, otherwise the title gets stretched by justify into abnormal letter spacing).
- `display:grid` and `<dl><dt><dd>` are forbidden; structured content always uses `<table>`.
- Decorative short horizontal rules on the cover (e.g. `<hr class="cover-rule">`) are forbidden; they become full-width rules in the .docx.
- Set `<meta name="docx-page-size" content="A4">`; `body` uses
  `max-width: var(--page-content-width)` to constrain width, with no height set.
- For blocks with a left border (`border-left`), prepend two `&nbsp;&nbsp;` to the text (Word has no reliable left-border spacing).

### 3.3 What the Converter Can and Cannot Carry

**Passing html-review ≠ the layout landing in Word.** The former is a static check on the HTML side; the latter depends on which CSS features the converter actually supports. The table below is the conclusion — **choose your carrier from it before writing HTML**:

| Layout you want | Converter's actual behavior | Correct carrier |
|--------------|---------------|---------|
| One background shading wrapping multiple paragraphs | **No cross-block inheritance**: a `background` on a container `<div>` does not propagate to child paragraphs | Use a **single-column card table**, with the shading on the `<td>` (see the full form below) |
| A horizontal rule under a chapter heading | **It does not write `w:pBdr` for `h1`–`h6`**; a border on the heading itself has no effect | Change to a "chapter lead paragraph": `<p class="lead">` + `.lead { border-top: … }` |
| An empty paragraph as a divider | The `divider` component (empty paragraph + bottom border) is **removed by the empty-paragraph cleanup pass** | Same as above; carry the border on a lead paragraph with text |
| Faking a non-empty paragraph with a zero-width space `&#8203;` | The paragraph is retained, but **the style does not land** (style application matches on "having visible text") | Do not fool it with invisible characters; use real text |
| Paragraph-level border (inline `style`) | Inline `style` and paragraph text are **mis-paired** (the border landed on the previous heading in testing) | Paragraph-level borders **always go through a class selector**; class selectors land accurately |
| `rgba()` for shading | **Unsupported**; warns `Unsupported/keyword background 'rgba(...)'; ignored` and the shading is discarded (border retained) | Switch to a hexadecimal soft color (§4.2 table) |

**Standard way to write a shaded card** (both shading and border land):

```html
<table>
  <thead><tr><th>Executive Summary</th></tr></thead>
  <tbody><tr><td>Body paragraph…</td></tr></tbody>
</table>
```

Write the shading on the `<td>`'s class (a hexadecimal soft color), not on the `<table>` or an outer `<div>`.

### 3.4 When Unsure, Probe First — Do Not Ram the Gate With the Real Draft

The converter's capabilities cannot be exhausted by reading docs. **When facing an unfamiliar layout need, spend 5 minutes on a minimal probe first**:

```bash
# One variant per block, all verified in a single conversion
cat > work/rule_test.html <<'EOF'
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="docx-page-size" content="A4">
<style>
:root { --color-text:#1f1f1f; --color-border:#c9c9c9; --ff-body:"Times New Roman",serif; --fs-body:12pt; --space-xs:0.25em; }
.lead { border-top: 1px solid var(--color-border); padding-top: var(--space-xs); }
body { font-family: var(--ff-body); font-size: var(--fs-body); color: var(--color-text); }
</style></head><body>
<section role="body">
  <h2>Chapter A</h2>
  <p class="lead">Chapter A lead (class + border-top).</p>
  <p>Body text.</p>
  <h2>Chapter B</h2>
  <p style="border-top: 1px solid #c9c9c9;">Chapter B lead (inline + bare hex).</p>
  <p>Body text.</p>
</section></body></html>
EOF
# After conversion, check where w:pBdr lands, paragraph by paragraph — one run reveals which carrier works
```

**Read back the conversion result** (the criterion is which paragraph `w:pBdr` / `w:shd` lands on):

```python
import docx
from docx.oxml.ns import qn
d = docx.Document(r'<abs>/work/rule_test.docx')
for p in d.paragraphs:
    pr = p._p.find(qn('w:pPr'))
    bd = pr.find(qn('w:pBdr')) if pr is not None else None
    sh = pr.find(qn('w:shd')) if pr is not None else None
    sides = [e.tag.split('}')[1] for e in bd] if bd is not None else []
    print('[%-10s] pBdr=%-16s shd=%-9s %r' % (p.style.name, ','.join(sides) or '-',
          sh.get(qn('w:fill')) if sh is not None else '-', p.text[:36]))
```

Generate the real draft only after the probe passes. **Ramming the gate with the real draft is wasteful** — one rebuild plus one reconversion
could have been solved in a 5-minute probe.

### 3.5 After Conversion You Must Read Back the Layout — "Conversion Succeeded" Is Not Enough

`{"success": true}` only means it did not crash. Whether the layout landed must be **verified item by item against the XML**:

| What to confirm | How to read it back |
|-----------|---------|
| Paragraph border placement | Count `w:pBdr` occurrences and their paragraphs, and compare against the expected count (e.g. "16 chapters should have 16") |
| Cell shading | Find the target table and read `tcPr/w:shd@w:fill` |
| Sections and page numbers | `w:sectPr` should equal 2 (cover + body), and the body section should have `pgNumType` |
| Table count | `len(d.tables)` should match the number of `<table>` elements in the HTML |
| Whether the style sheet overrides headings | Read the `Heading2` definition directly in `word/styles.xml` |

> Typical case: the HTML had h2 underlines and executive-summary shading, html-review passed at 100,
> yet **neither existed** in the converted .docx. The cause is converter non-support, not a writing mistake.
> So "the gate passed" and "the layout landed" are two different things and must be verified separately.

---

## 4. Stage 3 — Convert to .docx

### 4.1 Prepare the Runtime Environment (Windows must-read pitfall)

`scripts/wb/local/setup-html-to-docx.sh` **has a platform-assumption bug**: it checks for `$VENV_DIR/bin/python`,
but on Windows a uv-created venv has `Scripts/python.exe`, so it judges the environment invalid → `rm -rf` and rebuilds the venv
→ then `uv pip install` produces no output for a long time (observed to hang >10min).

**Workaround** (installs 20 packages in about 15s):

```bash
export PATH="$HOME/.local/bin:$PATH"
uv pip install --python "$HOME/.venv-html-to-docx/Scripts/python.exe" \
  --only-binary=:all: \
  -r "<plugin_root>/skills/html-to-docx/scripts/requirements.txt"
```

Key points:

- That venv was created by uv and **has no pip** — do not use `python -m pip` (it errors with `No module named pip`); you must use `uv pip`.
- Do not create your own `.venv` under the skill's `scripts/`.
- Always pass `--only-binary=:all:` to avoid lxml failing to build from source in an environment without libxml2/libxslt.

### 4.2 Invoke the Conversion

```bash
cd "<plugin_root>/skills/html-to-docx/scripts"
"$HOME/.venv-html-to-docx/Scripts/python.exe" -m html_to_docx convert \
  "<abs>/stage2/formatted-<theme>.html" \
  -o "<abs>/stage3/<document-name>.docx" \
  --page-size A4 --orientation portrait \
  --margin-top 2.5 --margin-bottom 2.0 --margin-left 2.5 --margin-right 2.5
```

On success, stdout prints `{"success": true, "docx_path": ...}`.

**`rgba()` backgrounds are unsupported**: the converter warns `Unsupported/keyword background 'rgba(...)'; ignored`,
and that shading is discarded (border retained). Switching to hexadecimal soft colors yields zero warnings:

| Semantics | Hexadecimal soft color |
|------|-------------|
| info | `#EAF2F8` |
| warning | `#FDF2EA` |
| success | `#EDF5EE` |
| danger | `#FBE9E9` |

### 4.3 Verify the Artifact

Do not just check "conversion succeeded". Actually open and inspect the structure:

```bash
"$HOME/.venv-html-to-docx/Scripts/python.exe" -c "
import docx
d = docx.Document(r'<abs>/stage3/<document-name>.docx')
print('paragraphs:', len(d.paragraphs), 'tables:', len(d.tables), 'sections:', len(d.sections))
print('headings:', len([p for p in d.paragraphs if p.style.name.startswith('Heading')]))
"
```

`sections` should equal 2 (cover + body), and the `tables` count should match the number of `<table>` elements in the HTML.

**Correct structure does not mean correct layout** — paragraph borders, cell shading, and chapter-heading rules must all be read back item by item against the XML per the §3.5 table.

### 4.4 Wrap-Up

1. Write the `stage_3` block in `pipeline-state.yaml` (`status: completed`, `skill_used: ["html-to-docx"]`,
   `present_files_opened: true`), and run a `consistency_check` (actually `stat` the files; do not guess from paths).
2. **Immediately open the `.docx` preview via `present_files`** — this is a hard constraint; not opening the preview means S3 is not complete.
3. If the document contains content changed in the HTML but not written back to the provenance record, complete `pipeline-state.yaml`.

> When writing Windows absolute paths in YAML, mind the escaping: `"C:\\Users\\..."`.
> Doing string replacement in Python easily turns `\\` into `////`; `grep` to recheck after replacing.
