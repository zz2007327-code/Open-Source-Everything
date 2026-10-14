# 文档交付：tencent-docx 全链路

Phase 4 的执行手册。按此清单操作可**一次通过**质量门禁，避免返工。

---

## 1. 路由

先加载 `tencent-docs-routing` 判定任务类型。「从零生成一份新文档」→ `full_pipeline`，
链路固定为 **S1 创作 → S2 美化 → S3 转 .docx**。链路一旦组合必须顺序执行到 S3 结束。

中间产物（`.md` / `.html`）**不得** `present_files`，也不得在回复里贴正文；
只有 S3 产出的 `.docx` 才交付，且**必须立即 `present_files` 打开预览**。

> 注：若目标产物是「技术分享页」而不是「规格文档」，可以不套本文链路，直接出单文件 HTML。
> 本文链路针对**要交付 Word 文档**的场景。

---

## 2. Stage 1 — 创作

`doc-writer` 按关键词路由 Expert。功能规格类文档通常命不中任何 L2 领域专家
（非合同/研报/商业文案/技术博客/学术/科普/工作汇报/诗歌），因此落到
**L1 `general-writer`**，`route_tag = general_writing`，`genre = general`，Critic 默认 `skip`。

产出：`stage1/final_draft.md`——**纯 Markdown**，不带 YAML frontmatter，
不嵌 HTML 标签，标题从 H1 起不跳级。

> 若用户其实想要「技术博客」口吻（有观点、有叙事），那应命中 L2 `tech-blog-expert`。
> 功能规格是施工文档，不是博客——保持 `general` 是对的。

---

## 3. Stage 2 — 美化

无参考版式文档时走 `html-template`，`genre` 按内容推断：
「报告/分析报告/方案」类命中 **`business-report`**（主题 `business-modern`）。
产出：`stage2/formatted-<主题>.html` + `stage2/design_tokens.json`。

### 3.1 一次通过 html-review 的预置清单

`html-review` 是脚本化门禁（退出码 0 = 通过），六个维度全过且总分 ≥ 80 才算过。
**首检不过只允许一次定向修正，不循环**——所以首检就要过。按下列清单写 HTML：

| 检查项 | 规则 | 违反后果 |
|--------|------|---------|
| **DT-01 无裸色值** | `<style>` 里不得出现裸 `#xxxxxx` / `rgba(...)`，一律 `var(--color-*)` | 维度 20 分 |
| **DT-03 无裸间距** | 不得出现裸 `12px`、`0.6em`、`0.5em 0.8em`，一律 `var(--spacing-*)` 或自定义 `--space-*` 变量 | 维度 20 分 |
| **SI-02 表格结构完整** | **每个** `<table>` 都必须有 `<thead>` 和 `<tbody>` | 含 KV 表、摘要卡表 |
| **TQ-01 段落不超 500 字符** | 单个 `<p>` 内容 ≤ 500 字符 | **代码块用 `<p class="code-block">` 时同样受此限** |
| **TQ-03 标题间要有正文** | `<h2>` 后不得直接接 `<h3>`；`<h3>` 后不得直接接 `<h4>` | 每个章节补一句导语 |
| **BR-01 执行摘要区** | `business-report` 必须有 `.executive-summary` | 缺则 genre 维度扣分 |

常见不合格项的修正动作：

1. 把 `<style>` 里所有裸间距抽成变量：`--space-xs/sm/md/lg/xl`、`--space-cell-y`、`--space-cell-x` 等。
2. 把三处 `rgba(...)` 呼出框底纹改成变量 `var(--color-info-bg)` 等（值用十六进制柔色，见 §4.2）。
3. 给摘要卡、指标表、呼叫框补 `<thead>/<tbody>`（无表头的表可放一个视觉隐藏的 `<th>`）。
4. 把两个超长代码块 `<p>` 各拆成两段。
5. 八个 `<h2>` 后各补一句章节导语。
6. 新增 `.executive-summary` 区块（含 `summary-header` + 指标表 + 摘要卡）。

### 3.2 其他硬约束

- 封面与正文是 `<body>` 下**相邻的两个顶层 `<section>`**：
  `<section role="cover">` + `<section role="body" data-page-restart="1">`。
  正文内部的章节一律用 `<div>`，不要用顶层 `<section>`（会被错误分页）。
- 封面每个块级元素**自己写** `text-align: center`，不能靠父容器继承
  （转换器不做 CSS 继承计算，否则标题会被 justify 撑成字距异常）。
- 禁止 `display:grid` / `<dl><dt><dd>`；结构化内容一律 `<table>`。
- 禁止封面装饰性短横线（`<hr class="cover-rule">` 之类），转 docx 会变满版横线。
- 设置 `<meta name="docx-page-size" content="A4">`，`body` 用
  `max-width: var(--page-content-width)` 约束宽度、不设高度。
- 有左边框（`border-left`）的块，文字开头加两个 `&nbsp;&nbsp;`（Word 左边框无可靠间距）。

### 3.3 转换器能承载什么、不能承载什么

**html-review 全过 ≠ 版式能落到 Word 里。** 前者是 HTML 侧的静态检查，后者取决于转换器
实际支持哪些 CSS 特性。下面这张表是结论，**写 HTML 前先按它选载体**：

| 你想要的版式 | 转换器实际行为 | 正确载体 |
|--------------|---------------|---------|
| 一块底纹包住多段落 | **不跨块级继承**：写在容器 `<div>` 上的 `background` 不会下发到子段落 | 用**单列成卡表**，底纹落 `<td>` 上（见下表完整写法） |
| 章标题下画一条横线 | **不给 `h1`–`h6` 写 `w:pBdr`**，标题自身加边框无效 | 改成「每章导语段」：`<p class="lead">` + `.lead { border-top: … }` |
| 空段落当分隔线 | `divider` 组件（空段落 + 下边框）会被**空段落清理流程删掉** | 同上，用有文字的导语段承载边框 |
| 用零宽空格 `&#8203;` 伪装非空段落 | 段落被保留，但**样式不落**（样式应用按「有可见文字」匹配） | 不要用看不见的字符骗它，改用真实文字 |
| 段落级边框（内联 `style`） | 内联 `style` 与段落文字的**配对会错位**（实测边框落到了上一个标题上） | 段落级边框**一律走 class 选择器**，类选择器落位准确 |
| `rgba()` 做底纹 | **不支持**，告警 `Unsupported/keyword background 'rgba(...)'; ignored`，底纹被丢弃（边框保留） | 改用十六进制柔色（§4.2 表） |

**底纹卡片的标准写法**（底纹与边框都能落位）：

```html
<table>
  <thead><tr><th>执行摘要</th></tr></thead>
  <tbody><tr><td>正文段落…</td></tr></tbody>
</table>
```

底纹写在 `<td>` 的 class 上（十进十六进制柔色），不要写在 `<table>` 或外层 `<div>` 上。

### 3.4 拿不准就先用探针，不要拿正式稿去撞

转换器的承载能力无法靠读文档穷尽。**遇到没见过的版式需求时，先花 5 分钟做最小探针**：

```bash
# 每个变体一段，一次转换全部验证
cat > work/rule_test.html <<'EOF'
<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="docx-page-size" content="A4">
<style>
:root { --color-text:#1f1f1f; --color-border:#c9c9c9; --ff-body:"宋体",serif; --fs-body:12pt; --space-xs:0.25em; }
.lead { border-top: 1px solid var(--color-border); padding-top: var(--space-xs); }
body { font-family: var(--ff-body); font-size: var(--fs-body); color: var(--color-text); }
</style></head><body>
<section role="body">
  <h2>甲章</h2>
  <p class="lead">甲章导语（class + border-top）。</p>
  <p>正文。</p>
  <h2>乙章</h2>
  <p style="border-top: 1px solid #c9c9c9;">乙章导语（内联 + 裸十六进制）。</p>
  <p>正文。</p>
</section></body></html>
EOF
# 转换后逐段查 w:pBdr 落位，一次就能看出哪种载体有效
```

**用转换结果反查**（判据是 `w:pBdr` / `w:shd` 落在哪个段落上）：

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

探针跑通后再生成正式稿。**拿正式稿去撞门禁是浪费**——一次重建 + 一次重转的开销，
本可以在 5 分钟的探针里解决。

### 3.5 转换后必须反查版式，不能只看「转换成功」

`{"success": true}` 只说明没崩。版式是否落地要**逐项反查 XML**：

| 想确认什么 | 反查方法 |
|-----------|---------|
| 段落边框落位 | 统计 `w:pBdr` 出现次数与所在段落，和预期条数比对（如「16 章应有 16 条」） |
| 单元格底纹 | 找到目标表格，读 `tcPr/w:shd@w:fill` |
| 分节与页码 | `w:sectPr` 应等于 2（封面 + 正文），正文节里应有 `pgNumType` |
| 表格数量 | `len(d.tables)` 与 HTML 里 `<table>` 数一致 |
| 样式表是否覆盖了标题 | 直接读 `word/styles.xml` 里的 `Heading2` 定义 |

> 典型现象：HTML 里写了 h2 下划线、执行摘要底纹，html-review 100 分通过，
> 但转出来的 docx 里**两者都不存在**。原因是转换器不支持，而不是写错了。
> 所以「门禁过了」和「版式落地了」是两件事，必须分别验证。

---

## 4. Stage 3 — 转 .docx

### 4.1 准备运行环境（Windows 必读坑）

`scripts/wb/local/setup-html-to-docx.sh` **有平台假设 bug**：它检测 `$VENV_DIR/bin/python`，
但 Windows 上 uv 建的 venv 在 `Scripts/python.exe`，于是判定环境失效 → `rm -rf` 重建 venv
→ 随后 `uv pip install` 长时间无输出（实测卡 >10min）。

**绕过办法**（约 15s 装完 20 个包）：

```bash
export PATH="$HOME/.local/bin:$PATH"
uv pip install --python "$HOME/.venv-html-to-docx/Scripts/python.exe" \
  --only-binary=:all: \
  -r "<plugin_root>/skills/html-to-docx/scripts/requirements.txt"
```

要点：

- 该 venv 是 uv 建的，**不带 pip**——不要用 `python -m pip`（报 `No module named pip`），必须用 `uv pip`。
- 不要在该 skill 的 `scripts/` 下自建 `.venv`。
- 必带 `--only-binary=:all:`，避免 lxml 在无 libxml2/libxslt 环境下源码构建失败。

### 4.2 调用转换

```bash
cd "<plugin_root>/skills/html-to-docx/scripts"
"$HOME/.venv-html-to-docx/Scripts/python.exe" -m html_to_docx convert \
  "<abs>/stage2/formatted-<主题>.html" \
  -o "<abs>/stage3/<文档名>.docx" \
  --page-size A4 --orientation portrait \
  --margin-top 2.5 --margin-bottom 2.0 --margin-left 2.5 --margin-right 2.5
```

成功时 stdout 输出 `{"success": true, "docx_path": ...}`。

**`rgba()` 背景不受支持**：转换器会告警 `Unsupported/keyword background 'rgba(...)'; ignored`，
该处底纹被丢弃（边框保留）。改用十六进制柔色即可零告警：

| 语义 | 柔色十六进制 |
|------|-------------|
| info | `#EAF2F8` |
| warning | `#FDF2EA` |
| success | `#EDF5EE` |
| danger | `#FBE9E9` |

### 4.3 验证产物

不要只看「转换成功」。实际打开检查结构：

```bash
"$HOME/.venv-html-to-docx/Scripts/python.exe" -c "
import docx
d = docx.Document(r'<abs>/stage3/<文档名>.docx')
print('paragraphs:', len(d.paragraphs), 'tables:', len(d.tables), 'sections:', len(d.sections))
print('headings:', len([p for p in d.paragraphs if p.style.name.startswith('Heading')]))
"
```

`sections` 应等于 2（封面 + 正文），`tables` 数量应与 HTML 中的 `<table>` 数一致。

**结构对了不等于版式对了**——段落边框、单元格底纹、章标题分隔线都要按 §3.5 的表逐项反查 XML。

### 4.4 收尾

1. 写 `pipeline-state.yaml` 的 `stage_3` 块（`status: completed`、`skill_used: ["html-to-docx"]`、
   `present_files_opened: true`），并做 `consistency_check`（真实 `stat` 文件，不要凭路径猜）。
2. **立即 `present_files` 打开 `.docx` 预览**——这是硬约束，未开预览即等于 S3 未完成。
3. 若文档中存在 HTML 里改过、但未回写溯源记录的内容，补齐 `pipeline-state.yaml`。

> YAML 里写 Windows 绝对路径时注意转义：`"C:\\Users\\..."`。
> 用 Python 做字符串替换时容易把 `\\` 变成 `////`，替换后要 `grep` 复核一遍。
