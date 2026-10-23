# 文档交付：单文件 HTML · Document Delivery: The Single-File HTML

Phase 4 的执行手册。默认交付物是**一份能直接双击打开、断网也能看、可以直接发给同事**的 `.html` 文件。

The execution handbook for Phase 4. The default deliverable is a single `.html` file that opens with a double click, reads fine offline, and can be sent to a colleague as-is.

---

## 1. 交付形态与产物路径 · 1. Artifact Shape and Output Path

四个硬要求，缺一不可：

Four hard requirements, all mandatory:

| 要求 | 具体含义 | 反面 |
|---|---|---|
| **单文件** | 一份 `.html`，CSS 内联在 `<style>` 里，不引用任何外部 `.css` / `.js` / 字体 / 图片 | 拆成 `index.html + style.css`，换台机器就掉样式 |
| **自包含** | 图示用内联 `<svg>`，代码块用 `<pre><code>`，不写 `src="http...` | 用外链 CDN 上的图床截图，断网即空白 |
| **可读** | 正文行长、字号阶梯、留白按 §3 约束来，屏幕上看不累 | 整页 12px 密排，读者三分钟关掉 |
| **可导航** | 页首或侧栏有目录，每个条目锚到对应章节；标题可回顶 | 一份 15 章的长文档只能靠滚动找人 |

**Single file**, **self-contained**, **readable**, **navigable** — those are the four. Inline the CSS, use inline `<svg>` for diagrams, `<pre><code>` for code, and never reference an external stylesheet, script, font, or image.

产物路径固定为工作目录下的 `deliverable/<document-name>.html`；源 Markdown 留在 `deliverable/<document-name>.md` 一并交付，便于后续改动。

The output path is fixed at `deliverable/<document-name>.html` in the working directory; keep the source Markdown at `deliverable/<document-name>.md` alongside it so later edits are cheap.

> **不要**把中间产物（探针输出、抽出的源码、证据笔记）塞进交付文件。交付物只承载规格正文与使用建议。

> **Do not** pack intermediates (probe output, extracted source, evidence notes) into the delivered file. The artifact carries the spec body and the usage notes only.

---

## 2. 预检：交付环境是否可用 · 2. Precheck: Is the Delivery Environment Usable

Phase -1 的第四项检查。**在写正文之前跑一次**，零成本、不联网：

The fourth Phase -1 check. **Run it before writing the body**, at zero cost and with no network:

```bash
python scripts/build_doc.py --selftest
```

它检查三件事：Python 版本可用、输出目录可写、内置的七条结构性断言能正常运行。任何一条失败，**当场**告诉用户并切到 Markdown 降级，不要等全文写完。

It checks three things: the Python version is usable, the output directory is writable, and the six built-in structural assertions run. If any fails, tell the user **on the spot** and switch to the Markdown fallback — do not wait until the draft is done.

生成只有一份的依赖：**Python 标准库**。不需要 `pip install`，不需要虚拟环境，不需要任何插件。这是单文件 HTML 相对 .docx 链最重要的优势——它的失败模式几乎不存在。

The only dependency is the **Python standard library**. No `pip install`, no virtualenv, no plugin. That is the single biggest advantage of single-file HTML over a `.docx` chain — its failure modes are nearly nonexistent.

---

## 3. 七条版式约束 · 3. The Seven Layout Constraints

**写 HTML 之前把这张表整张读完**，不要写完再回头调。这七条直接决定文档是"能读"还是"没人读得下去"。

**Read this table in one pass before writing HTML**; do not write first and tune later. These seven decide whether the document is readable or unreadable.

| # | 约束 | 具体值 | 为什么 |
|---|---|---|---|
| **L1** | **正文行长上限** | 内容区 `max-width: 46em`（约 78–85 字符） | 行长超过 ~90 字符时，眼睛回扫会串行，长文档尤其明显 |
| **L2** | **字号阶梯** | 正文 `16px`，章标题 `1.6rem`，节标题 `1.25rem`，表格 `0.92rem`，代码 `0.88rem` | 阶梯少于四档就没有层次；档差小于 0.15rem 读者分辨不出 |
| **L3** | **行高** | 正文 `1.75`，表格 `1.5`，代码 `1.55` | 中文正文行高低于 1.6 会明显压抑；表格行高过高会把表拉散 |
| **L4** | **表格列数上限 6** | 超过 6 列就拆表，或把低优先级列合并成一列 | 窄屏与 A4 打印下，7 列以上每列只剩 3–4 个字 |
| **L5** | **章节留白** | 章前 `3.2rem`，节前 `2rem`，段后 `0.9rem` | 留白是长文档唯一的"呼吸位"；全部均等会让章节边界消失 |
| **L6** | **对比度** | 正文 `#1f2328` on `#ffffff`；次要文字不低于 `#5b6570` | 浅灰正文（如 `#999`）在投影、打印、低亮度屏上基本不可读 |
| **L7** | **目录与锚点** | 目录只收 `h2` / `h3`；每个 `h2` / `h3` 必须有 `id`；页面顶部有固定回顶入口 | 收 `h4` 会让目录比正文还长；缺 `id` 就是一排死链 |

补充三条同样硬性的：

Three more, equally hard:

- **打印友好**：`@media print` 里去掉侧栏与阴影，表格 `page-break-inside: avoid`，代码块允许换行。**至少一半的读者会把 HTML 打成 PDF 看。**
- **不引入外部字体**：中文字体走 `system-ui, "PingFang SC", "Microsoft YaHei", sans-serif` 系统栈。用 webfont 会破坏自包含，还会在断网时变成豆腐块。
- **不用 `position: fixed` 做正文容器**：只在回顶按钮与侧栏目录上用；正文用普通流式布局，否则打印和窄屏都会出问题。

- **Print-friendly**: strip the sidebar and shadows in `@media print`, set `page-break-inside: avoid` on tables, allow code to wrap. **At least half of readers will print the HTML to PDF.**
- **No external fonts**: use the system stack `system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`. A webfont breaks self-containment and turns into tofu boxes offline.
- **No `position: fixed` for the body container**: reserve it for the back-to-top button and the sidebar contents; the body uses normal flow, otherwise print and narrow screens both break.

---

## 4. 页面骨架 · 4. Page Skeleton

固定结构，照着填。**不要每篇重新设计视觉**——版式统一才有"这是同一个技能产出的"那种可信感。

Fixed structure; fill it in. **Do not redesign the visuals per document** — a consistent layout is what makes the output feel like it came from one skill.

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{文档标题}</title>
<style>
  :root{
    --ink:#1f2328; --ink-2:#5b6570; --line:#e3e7eb; --bg:#ffffff;
    --bg-soft:#f6f8fa; --accent:#2f6feb; --warn:#b7791f; --ok:#2f855a;
    --s3:#8b5cf6;
    --space-1:.35rem; --space-2:.7rem; --space-3:1.1rem;
    --space-4:2rem; --space-5:3.2rem;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font:16px/1.75 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;}
  .wrap{max-width:46em;margin:0 auto;padding:var(--space-5) var(--space-3)}
  h1{font-size:2rem;line-height:1.3;margin:0 0 var(--space-2)}
  h2{font-size:1.6rem;line-height:1.35;margin:var(--space-5) 0 var(--space-2);
     padding-top:var(--space-3);border-top:1px solid var(--line)}
  h3{font-size:1.25rem;line-height:1.4;margin:var(--space-4) 0 var(--space-2)}
  p{margin:0 0 .9rem}
  .lead{color:var(--ink-2)}
  table{border-collapse:collapse;width:100%;margin:var(--space-2) 0 var(--space-3);
        font-size:.92rem;line-height:1.5}
  th,td{border:1px solid var(--line);padding:.5rem .65rem;text-align:left;vertical-align:top}
  th{background:var(--bg-soft);font-weight:600}
  pre{background:var(--bg-soft);border:1px solid var(--line);border-radius:6px;
      padding:var(--space-2);overflow-x:auto;font-size:.88rem;line-height:1.55}
  code{font-family:ui-monospace,Consolas,monospace}
  .toc{background:var(--bg-soft);border:1px solid var(--line);border-radius:8px;
       padding:var(--space-2) var(--space-3);margin:var(--space-4) 0;font-size:.94rem}
  .toc ol{margin:.3rem 0;padding-left:1.3rem}
  .tag{display:inline-block;padding:0 .35em;border-radius:4px;font-size:.8em;
       font-weight:600;line-height:1.6;white-space:nowrap}
  .tag-s1{background:#e6f0ff;color:#1a4fb4}
  .tag-s2{background:#e8f5ec;color:#1e6b3a}
  .tag-s3{background:#f1eafe;color:#5b21b6}
  .tag-gap{background:#fdf2d9;color:#8a5a00}
  .note{border-left:3px solid var(--accent);background:var(--bg-soft);
        padding:var(--space-2) var(--space-3);margin:var(--space-2) 0 var(--space-3)}
  @media print{
    .toc,.backtop{display:none}
    .wrap{max-width:none;padding:0}
    table,pre{page-break-inside:avoid}
    pre{white-space:pre-wrap}
    h2{page-break-after:avoid}
  }
</style>
</head>
<body>
<div class="wrap">
  <h1>{文档标题}</h1>
  <p class="lead">{副标题：目标 + 交付性质（学习向 / 净室向 / 降级描述）}</p>

  <!-- 摘要：全文唯一一处结论块 -->
  <div class="note">
    <strong>摘要</strong>
    <p>{三到五句：结论 + 关键指标 + 风险边界}</p>
  </div>

  <nav class="toc" aria-label="目录">
    <strong>目录</strong>
    <ol>{目录条目，锚到 h2 / h3}</ol>
  </nav>

  <h2 id="s1">1. 文档说明</h2>
  <p class="lead">{本章引导语——每章都要有，不要 h2 直接接 h3}</p>
  <h3 id="s1-1">1.1 本文目的</h3>
  <p>…</p>
</div>
<a class="backtop" href="#top">↑ 回顶</a>
</body>
</html>
```

`body` 开头补一个 `<a id="top"></a>`，让回顶链接有落点。

Add `<a id="top"></a>` at the start of `body` so the back-to-top link has a target.

---

## 5. 证据标注的写法 · 5. How to Tag Evidence

三条证据等级直接以标签形式写进正文——这是本技能与"看起来很像的二手文章"之间最直观的区别。

The three evidence grades appear in the body as inline tags — the most visible difference between this skill's output and a plausible-sounding secondhand article.

| 等级 | 标签写法 | 什么时候用 |
|---|---|---|
| S1 线上构建源码 | `<span class="tag tag-s1">S1</span>` + `文件:行` | 结论可指向包内某段代码 |
| S2 运行时观测 | `<span class="tag tag-s2">S2</span>` + 实测值 | 结论来自探针输出、截图、计数 |
| S3 网络调研 | `<span class="tag tag-s3">S3-a/b/c</span>` + URL + 检索日期 | **只作印证，绝不单独支撑决定性结论** |
| 证据缺口 | `<span class="tag tag-gap">缺口</span>` | 试过但验证不了，写清为什么 |

**引用紧贴它支撑的那句话**，不要在文末堆一个参考文献节——那正是未标注断言溜过去的方式。

**Put the citation right next to the sentence it supports**; never pile them into a references section at the end — that is precisely how unlabeled assertions slip through.

---

## 6. 生成脚本必须自带断言 · 6. The Generation Script Must Assert

用 `scripts/build_doc.py` 把 Markdown 生成 HTML（章节多、表格多时比手写可靠），但**脚本会静默出错**——一条正则写错，几百个表格一起消失，而脚本照样退出 0。所以落盘之前必须过七条结构性断言：

Use `scripts/build_doc.py` to turn Markdown into HTML (more reliable than hand-writing when there are many chapters and tables), but **scripts fail silently** — one bad regex makes hundreds of tables disappear while the script still exits 0. So seven structural assertions must pass before anything hits the disk:

| # | 断言 | 对应哪种静默失败 |
|---|---|---|
| A1 | `<table>` 数量 == Markdown 表格块数量（含嵌套块） | 表格被正则吞掉，或被当成列表续行 |
| A2 | 每张表都有 `<thead>` 与 `<tbody>` | 表头结构缺失，表变成一堆裸 `<td>` |
| A3 | `<h*>` 数量 >= Markdown 标题数量 | 标题被吃掉，目录跟着塌 |
| A4 | `body_html` 长度 > 2000 字符 | 正文变空壳但退出码 0 |
| A5 | 无 `img/script/link/iframe/video/audio/source` 指向 `http(s)://`，且 CSS 无远程 `@import` | 外部资源混入，断网即变形 |
| A6 | 目录里每个 `href="#x"` 都能找到 `id="x"` | 目录全是死链 |
| A7 | 每个 `h2`/`h3` 都带 `id` | 标题拿不到永久链接；`--no-toc` 时 A6 空转，只剩这条兜底 |

| # | Assertion | Which silent failure it catches |
|---|---|---|
| A1 | `<table>` count == Markdown table blocks (nested blocks included) | A table swallowed by a regex, or read as a list continuation line |
| A2 | Every table has `<thead>` and `<tbody>` | Header structure lost; the table degrades into bare `<td>`s |
| A3 | `<h*>` count >= Markdown heading count | Headings eaten, the contents collapse with them |
| A4 | `body_html` length > 2000 chars | Body reduced to a shell but still exits 0 |
| A5 | No `img/script/link/iframe/video/audio/source` pointing at `http(s)://`, no remote CSS `@import` | An external resource slips in; the file falls apart offline |
| A6 | Every `href="#x"` in the contents has a matching `id="x"` | The contents become a row of dead links |
| A7 | Every `h2`/`h3` carries an `id` | Headings get no permalink; with `--no-toc`, A6 is idle and this is the only guard left |

> **A5 只拦"加载外部资源"的 `src`/`href`，不拦正文里的链接文本。** 正文写 `<a href="https://…">出处</a>` 是必须的——规格文档没有出处就是二手文章。这条边界很容易写错，一错就会把所有带引用的文档全拦下来。

> **A5 blocks only `src`/`href` that *load* an external resource — not citation links in the body.** Writing `<a href="https://…">source</a>` is mandatory; a spec without provenance is a secondhand article. This boundary is easy to get wrong, and getting it wrong rejects every properly cited document.

### 6.1 版式告警（不阻断） · 6.1 Layout Warnings (Non-blocking)

结构性断言管"内容有没有丢"，必须是硬失败；**版式约束管"读起来累不累"，多数是作者的取舍，硬失败会把正常交付拦在半路**。所以 §3 的七条约束里只有 L4 被脚本机械检查，且默认只告警：

Structural assertions answer "did content get lost" and must fail hard. **Layout constraints answer "is this tiring to read" — mostly an author's trade-off, and failing hard would block legitimate deliveries.** So among the seven constraints in §3, only L4 is mechanically checked, and by default it only warns:

| 行为 | 触发 | 结果 |
|---|---|---|
| 默认 | 某张表列数 > 6 | stderr 打印 `WARN L4 …`，**照常落盘** |
| `--strict-layout` | 同上 | 告警升级为失败，退出码 2，**不落盘** |

| Behavior | Trigger | Result |
|---|---|---|
| Default | Any table with more than 6 columns | Prints `WARN L4 …` to stderr, **still writes the file** |
| `--strict-layout` | Same | Warning escalates to failure, exit code 2, **nothing written** |

这条告警存在的原因很直接：**文档里写着"上限 6 列"、脚本却默默放行 7 列，规范和实现就分叉了。** 下一轮读文档的人会以为有保护，实际没有。

The reason this warning exists is blunt: **if the docs say "6 columns max" while the script silently allows 7, the spec and the implementation have diverged.** The next person reading the docs will assume protection that is not there.

落盘只有一句，**断言在 `open()` 之前**：

The write is one line, **assertions before `open()`**:

```python
assert_shape(blocks, body_html)          # 任何一条不过就抛异常，不落盘
open(out, "w", encoding="utf-8").write(html)
```

跑完后再做一次**肉眼复核**：打开产物，滚一遍目录、点三个锚点、把窗口缩到手机宽度。断言管结构，肉眼管观感，两者不能互相替代。

Then do one **visual pass**: open the artifact, scroll the contents, click three anchors, and squeeze the window to phone width. Assertions cover structure; eyes cover feel. Neither substitutes for the other.

---

## 7. 生成脚本的用法 · 7. Using the Generation Script

```bash
# 1) Phase -1 环境自检（零成本、不联网）
python scripts/build_doc.py --selftest

# 2) 生成（默认输出与输入同名的 .html）
python scripts/build_doc.py deliverable/spec.md \
    --subtitle "学习向 · 第 1 次拆解" \
    -o deliverable/spec.html

# 3) 严格版式：L4 列数超限也判定失败（用于要打印的正式稿）
python scripts/build_doc.py deliverable/spec.md -o deliverable/spec.html --strict-layout

# 4) 想先看解析结果再决定样式
python scripts/build_doc.py deliverable/spec.md --draft-only
```

四个选项说明：

Four options worth knowing:

| 选项 | 作用 | 什么时候用 |
|---|---|---|
| `--title` | 覆盖标题（默认取 frontmatter 的 `displayName`/`name`，再退到首个 H1） | 源稿没有 H1 或标题不合适 |
| `--subtitle` | 页首副标题，写目标 + 交付性质（学习向 / 净室向 / 降级描述） | 几乎每次都该写 |
| `--no-toc` | 不出目录 | 只有 3–5 章的短文档 |
| `--strict-layout` | 版式告警升级为失败（§6.1） | 要打印 / 要交付正式稿时 |

| Option | Effect | When to use |
|---|---|---|
| `--title` | Overrides the title (default: frontmatter `displayName`/`name`, then the first H1) | When the draft has no H1 or the title reads wrong |
| `--subtitle` | Page-head subtitle: target + delivery nature (learning / clean-room / degraded) | Should be given almost every time |
| `--no-toc` | No contents | Only for short 3–5 chapter documents |
| `--strict-layout` | Escalates layout warnings to failures (§6.1) | For a print-bound or formal delivery |

**脚本覆盖的 Markdown 子集**（超出范围的语法会原样留下，不会被误解）：标题 `#`–`####`、段落、GFM 表格（含列表项内嵌的缩进表格）、围栏代码块、有序/无序列表（含嵌套）、引用块、水平线、行内代码、粗体、斜体、Markdown 链接、裸 URL，以及 `[[DIAGRAM:name]]` 图示占位（`figures.py` 不存在时降级为一句提示，不报错）。

**The Markdown subset the script covers** (anything outside it stays literal rather than being misread): headings `#`–`####`, paragraphs, GFM tables (including indented tables nested inside list items), fenced code blocks, ordered/unordered lists (nested), blockquotes, horizontal rules, inline code, bold, italic, Markdown links, bare URLs, and the `[[DIAGRAM:name]]` placeholder (degrades to a note, never an error, when `figures.py` is absent).

> **写规格时不要用 `####` 以下的标题**：目录只收 `h2`/`h3`，更深的层级在读者眼里等于没有入口。需要第四层时，改用一张两列表把细分项收进去。

> **Do not go below `####` when writing the spec**: the contents collect `h2`/`h3` only, and anything deeper is effectively unreachable for the reader. When you need a fourth level, fold the detail into a two-column table instead.

---

## 8. 收尾 · 8. Wrapping Up

1. 源 Markdown 与产物 HTML 都留在 `deliverable/` 下；`stat` 两个路径确认真的存在，**不要从路径字符串推断成功**。
2. **立即用 `present_files` 打开 `.html` 预览** —— 硬性约束；不打开预览等于本轮交付未完成。
3. 在交付文件里没有纸面痕迹的地方，用一句「本文件由 XXX 第 N 次拆解产出，源稿见同名 .md」补上溯源。
4. 如果用户后来要 `.docx`，**不要**从 HTML 反推；直接按 `docx-delivery.md` 走 tencent-docx 链，从同一份 Markdown 源稿重新生成。

1. Keep both the source Markdown and the output HTML under `deliverable/`; `stat` both paths to confirm they exist — **never infer success from the path string**.
2. **Open the `.html` preview with `present_files` immediately** — a hard constraint; not opening it means this round's delivery is incomplete.
3. Where the file has no paper trail, add one line of provenance: "produced by teardown run N of <target>, source draft in the sibling `.md`".
4. If the user later wants `.docx`, **do not** back-convert the HTML; run the tencent-docx chain per `docx-delivery.md` from the same Markdown source.

> **为什么先 HTML 再 .docx，而不是反过来**：`.docx` 链的每一步都会丢信息（组件回填、边框继承、底纹支持），而 HTML 是信息的全集。从 Markdown 出发、分叉成两个产物，比从有损产物反推要可靠得多。

> **Why HTML first and `.docx` second, not the other way round**: every step of a `.docx` chain loses information (component filling, border inheritance, shading support), while HTML holds the whole set. Branching from Markdown into two artifacts is far more reliable than reconstructing from a lossy one.
