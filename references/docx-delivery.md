# 文档交付：完整的 tencent-docx 交付链

Phase 4 的执行手册。按本清单执行，可**一次通过质量闸门（quality gate）**，免去返工。

---

## 1. 路由

先加载 `tencent-docs-routing` 判定任务类型。"从零生成一份新文档" → `full_pipeline`，
交付链（delivery chain）固定为 **S1 写作 → S2 排版 → S3 转 .docx**。一旦组装完成，该链必须按顺序一直跑到 S3。

中间产物（`.md` / `.html`）**不得**传给 `present_files`，正文也不得粘贴进回复；
只交付 S3 产出的 `.docx`，并且**必须立即用 `present_files` 打开**。

> 注：若目标产物是"技术分享页"而非"规格文档"，可以跳过本链，直接产出单文件 HTML。
> 本链针对的是**交付一份 Word 文档**的场景。

---

## 2. 阶段 1 —— 写作

`doc-writer` 按关键词路由到某个 Expert。功能规格文档通常命中不了 L2 领域专家
（不在合同 / 研究报告 / 商业文案 / 技术博客 / 学术 / 科普 / 工作报告 / 诗歌之列），因此落到
**L1 `general-writer`**，`route_tag = general_writing`，`genre = general`，Critic 默认为 `skip`。

产物：`stage1/final_draft.md` —— **纯 Markdown**，不带 YAML frontmatter，
不内嵌 HTML 标签，标题从 H1 开始且不跳级。

> 如果用户实际想要的是"技术博客"口吻（有观点、叙事性），则应当命中 L2 `tech-blog-expert`。
> 功能规格是构建文档，不是博客 —— 停留在 `general` 是正确的。

---

## 3. 阶段 2 —— 排版

没有参考版式文档时，使用 `html-template`，并从内容推断 `genre`：
"报告 / 分析报告 / 方案"类内容命中 **`business-report`**（主题 `business-modern`）。
产物：`stage2/formatted-<theme>.html` + `stage2/design_tokens.json`。

### 3.1 一次通过 html-review 的预设清单

`html-review` 是一道脚本化闸门（退出码 0 = 通过）；六个维度必须全部通过，且总分须 ≥ 80。
**首次失败只允许做一次针对性修复，不得循环** —— 所以必须一次就过。按本清单写 HTML：

| 检查项 | 规则 | 违规后果 |
|--------|------|---------|
| **DT-01 不得出现裸色值** | `<style>` 中不得出现裸写的 `#xxxxxx` / `rgba(...)`；一律用 `var(--color-*)` | 该维度扣 20 分 |
| **DT-03 不得出现裸间距** | 不得裸写 `12px`、`0.6em`、`0.5em 0.8em`；一律用 `var(--spacing-*)` 或自定义 `--space-*` 变量 | 该维度扣 20 分 |
| **SI-02 表格结构完整** | **每一个** `<table>` 都必须有 `<thead>` 和 `<tbody>` | 包括 KV 表与摘要卡片表 |
| **TQ-01 段落不超过 500 字符** | 单个 `<p>` 必须 ≤ 500 字符 | **代码块使用 `<p class="code-block">` 时同样受此限制** |
| **TQ-03 标题之间须有正文** | `<h2>` 之后不得直接接 `<h3>`；`<h3>` 之后不得直接接 `<h4>` | 为每章补一句引导语 |
| **BR-01 执行摘要块** | `business-report` 必须有 `.executive-summary` | 缺失会在体裁维度扣分 |

常见失败的修正办法：

1. 把 `<style>` 里所有裸间距抽成变量：`--space-xs/sm/md/lg/xl`、`--space-cell-y`、`--space-cell-x` 等。
2. 把三处 `rgba(...)` 提示框背景改成 `var(--color-info-bg)` 之类的变量（值用十六进制柔和色，见 §4.2）。
3. 给摘要卡片、指标表和提示框补上 `<thead>/<tbody>`（无表头的表可用视觉隐藏的 `<th>`）。
4. 把两个超长代码块 `<p>` 各拆成两个。
5. 在八个 `<h2>` 标题后各补一句引导语。
6. 增加一个 `.executive-summary` 块（含 `summary-header` + 指标表 + 摘要卡片）。

### 3.2 其他硬性约束

- 封面与正文是 `<body>` 下**两个相邻的顶层 `<section>` 元素**：
  `<section role="cover">` + `<section role="body" data-page-restart="1">`。
  正文内所有章节用 `<div>`；不要用顶层 `<section>`（分页会错）。
- 封面上每个块级元素**各自写** `text-align: center`；不能依赖从父级继承
  （转换器不计算 CSS 继承，否则标题会被 justify 拉伸出异常字距）。
- 禁止 `display:grid` 与 `<dl><dt><dd>`；结构化内容一律用 `<table>`。
- 禁止封面上的装饰性短横线（如 `<hr class="cover-rule">`）；它们在 .docx 里会变成通栏线。
- 设置 `<meta name="docx-page-size" content="A4">`；`body` 用
  `max-width: var(--page-content-width)` 约束宽度，不设高度。
- 对带左边框（`border-left`）的块，在文本前加两个 `&nbsp;&nbsp;`（Word 没有可靠的左边框间距）。

### 3.3 转换器能承载什么、不能承载什么

**通过 html-review ≠ 版式在 Word 里落地。** 前者是 HTML 侧的静态检查；后者取决于转换器（conversion）实际支持哪些 CSS 特性。下表是结论 —— **写 HTML 之前先据此选载体**：

| 想要的版式 | 转换器的实际行为 | 正确载体 |
|--------------|---------------|---------|
| 用一个底纹包住多个段落 | **不跨块继承**：容器 `<div>` 上的 `background` 不会传到子段落 | 改用**单列表格卡片**，底纹加在 `<td>` 上（完整写法见下） |
| 章节标题下的横线 | **不为 `h1`–`h6` 写 `w:pBdr`**；加在标题自身的边框无效 | 改成"章节引导段"：`<p class="lead">` + `.lead { border-top: … }` |
| 用空段落作分隔 | `divider` 组件（空段落 + 下边框）会被**空段落清理环节删掉** | 同上；把边框放在有文字的引导段上 |
| 用零宽空格 `&#8203;` 伪造非空段落 | 段落能保住，但**样式不落地**（样式应用以"有可见文字"为匹配条件） | 不要用不可见字符骗它；用真实文字 |
| 段落级边框（内联 `style`） | 内联 `style` 与段落文字会**错配**（实测边框落到了上一个标题上） | 段落级边框**一律走类选择器**；类选择器落点准确 |
| 用 `rgba()` 做底纹 | **不支持**；会告警 `Unsupported/keyword background 'rgba(...)'; ignored`，底纹被丢弃（边框保留） | 换成十六进制柔和色（§4.2 表） |

**带底纹卡片的标准写法**（底纹与边框都能落地）：

```html
<table>
  <thead><tr><th>Executive Summary</th></tr></thead>
  <tbody><tr><td>Body paragraph…</td></tr></tbody>
</table>
```

底纹写在 `<td>` 的 class 上（十六进制柔和色），不要写在 `<table>` 或外层 `<div>` 上。

### 3.4 拿不准就先探针 —— 不要拿正式稿去撞闸门

转换器的能力靠读文档是穷举不完的。**遇到没见过的版式需求，先花 5 分钟做最小探针**：

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

**回读转换结果**（判据是 `w:pBdr` / `w:shd` 落在哪个段落）：

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

探针通过之后，再生成正式稿。**拿正式稿撞闸门是浪费** —— 一次重建加一次重新转换，
本来 5 分钟的探针就能解决。

### 3.5 转换后必须回读版式 ——"转换成功"不够

`{"success": true}` 只表示没崩。版式是否落地，必须**对着 XML 逐项核对**：

| 要确认什么 | 怎么回读 |
|-----------|---------|
| 段落边框落点 | 统计 `w:pBdr` 出现次数及其所在段落，与预期数量比对（例如"16 章应有 16 处"） |
| 单元格底纹 | 找到目标表，读 `tcPr/w:shd@w:fill` |
| 分节与页码 | `w:sectPr` 应为 2 个（封面 + 正文），且正文节应有 `pgNumType` |
| 表格数量 | `len(d.tables)` 应与 HTML 中 `<table>` 元素数量一致 |
| 样式表是否覆盖标题 | 直接在 `word/styles.xml` 里读 `Heading2` 定义 |

> 典型案例：HTML 里有 h2 下划线、有执行摘要底纹，html-review 100 分通过，
> 但转换出的 .docx 里**两者都不存在**。原因是转换器不支持，不是写法失误。
> 所以"闸门通过"和"版式落地"是两件事，必须分别验证。

---

## 4. 阶段 3 —— 转 .docx

### 4.0 预检：绝不要假设转换器环境已存在

**在写任何 HTML 之前先跑这项检查。** 转换 venv 是懒创建的，而且经常是空的 —— `~/.venv-html-to-docx/Scripts/python.exe` 可能存在，但 `html_to_docx` 及其依赖并未安装。跳过这一步，就要在整篇文档写完之后才发现问题。

```bash
# 1. Does the venv exist and can it import the converter?
PY="$HOME/.venv-html-to-docx/Scripts/python.exe"
[ -x "$PY" ] && "$PY" -c "import html_to_docx, click, docx, bs4, lxml; print('env OK')" \
  || echo "env MISSING — run the install step below"
```

安装步骤 —— **插件目录用 glob 定位，绝不要硬编码版本号**（缓存路径带着形如 `5.7.3-wb.40038958.…` 的构建 id，每次插件更新都会变）：

```bash
export PATH="$HOME/.local/bin:$PATH"
PLUGIN=$(ls -d "$HOME/.workbuddy/plugins/cache/workbuddy-builtin/tencent-docx"/*/ | sort -V | tail -1)
echo "plugin: $PLUGIN"

# Create the venv only if it is actually absent (do NOT delete and rebuild an existing one)
[ -x "$PY" ] || uv venv "$HOME/.venv-html-to-docx"

uv pip install --python "$PY" --only-binary=:all: \
  -r "${PLUGIN}skills/html-to-docx/scripts/requirements.txt"

# Re-check
"$PY" -c "import html_to_docx, click, docx, bs4, lxml; print('env OK')"
```

要点：

- 那个 venv 由 uv 创建，**没有 pip** —— 不要用 `python -m pip`（会报 `No module named pip`）；必须用 `uv pip`。
- 始终传 `--only-binary=:all:`，避免 lxml 在没有 libxml2/libxslt 的环境里从源码构建失败。
- 不要在 skill 的 `scripts/` 下自建 `.venv`。转换器从**插件目录**读取 `html_to_docx`，所以导入模块时必须把插件的 `scripts/` 目录放进路径（见 §4.2）—— venv 只供第三方依赖。
- **如果预检怎么都过不了**，不要临时自己造一个转换器。按 SKILL.md Phase 4 降级（fallback）到 Markdown：按 `spec-doc-outline.md` 写出 `.md`，如实说明为什么没有产出 `.docx`，然后停止。

### 4.1 内置安装脚本的 Windows 专有坑

`scripts/wb/local/setup-html-to-docx.sh` **有一个平台假设 bug**：它检查 `$VENV_DIR/bin/python`，
但 Windows 上 uv 创建的 venv 是 `Scripts/python.exe`，于是判定环境无效 → `rm -rf` 重建 venv
→ 接着 `uv pip install` 长时间无输出（实测挂起 >10min）。

**规避办法**：用 §4.0 的安装步骤，不要用那个脚本。它约 15s 装完 20 个包，且从不删除已有 venv。

### 4.2 调用转换

模块在插件里，不在 venv 里 —— 把插件的 scripts 目录放进 `PYTHONPATH`，并从那里运行：

```bash
PLUGIN=$(ls -d "$HOME/.workbuddy/plugins/cache/workbuddy-builtin/tencent-docx"/*/ | sort -V | tail -1)
PY="$HOME/.venv-html-to-docx/Scripts/python.exe"
SCRIPTS="${PLUGIN}skills/html-to-docx/scripts"

cd "$SCRIPTS" && PYTHONPATH="$SCRIPTS" "$PY" -m html_to_docx convert \
  "<abs>/stage2/formatted-<theme>.html" \
  -o "<abs>/stage3/<document-name>.docx" \
  --page-size A4 --orientation portrait \
  --margin-top 2.5 --margin-bottom 2.0 --margin-left 2.5 --margin-right 2.5
```

成功时 stdout 打印 `{"success": true, "docx_path": ...}`。若看到 `ModuleNotFoundError: No module named 'click'`，说明 §4.0 的安装步骤没跑 —— 回去补，不要盲目重试。

**不支持 `rgba()` 背景**：转换器会告警 `Unsupported/keyword background 'rgba(...)'; ignored`，
该底纹被丢弃（边框保留）。换成十六进制柔和色后零告警：

| 语义 | 十六进制柔和色 |
|------|-------------|
| info | `#EAF2F8` |
| warning | `#FDF2EA` |
| success | `#EDF5EE` |
| danger | `#FBE9E9` |

### 4.3 验证产物

不要只看"转换成功"。要真正打开并检查结构：

```bash
"$HOME/.venv-html-to-docx/Scripts/python.exe" -c "
import docx
d = docx.Document(r'<abs>/stage3/<document-name>.docx')
print('paragraphs:', len(d.paragraphs), 'tables:', len(d.tables), 'sections:', len(d.sections))
print('headings:', len([p for p in d.paragraphs if p.style.name.startswith('Heading')]))
"
```

`sections` 应为 2（封面 + 正文），`tables` 数量应与 HTML 中 `<table>` 元素数量一致。

**结构正确不等于版式正确** —— 段落边框、单元格底纹、章节标题横线都必须按 §3.5 的表逐项对着 XML 回读。

### 4.4 收尾

`pipeline-state.yaml` 是本 skill 在 Phase 4 结束时写入工作目录的**交付溯源记录**。它的作用是让后续运行（或评审者）能判断这份文件由哪条样式链产出、源文件在哪 —— 没有它，一份没有纸面痕迹的 `.docx` 与手工拼出来的无法区分。保持最小化：

```yaml
# write this only after stage 3 succeeds and the preview has been opened
stages:
  stage1: { status: completed, skill_used: ["doc-writer"], artifact: "stage1/final_draft.md" }
  stage2: { status: completed, skill_used: ["html-template"], artifact: "stage2/formatted-business-modern.html" }
  stage3: { status: completed, skill_used: ["html-to-docx"], artifact: "stage3/<name>.docx",
            present_files_opened: true }
```

然后完成交付：

1. 写入上面三个 stage 块，并**实际 `stat` 每个 `artifact` 路径**做一致性核对 —— 绝不要从路径字符串推断成功。
2. **立即用 `present_files` 打开 .docx 预览** —— 这是硬性约束；不打开预览就等于阶段 3 未完成。
3. 若溯源记录写入后 HTML 又改过，把记录更新为磁盘上实际的内容。

> 在 YAML 里写 Windows 绝对路径要注意转义：`"C:\\Users\\..."`。
> 在 Python 里做字符串替换很容易把 `\\` 变成 `////`；替换后用 `grep` 复查。
