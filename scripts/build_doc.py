#!/usr/bin/env python3
"""build_doc.py — Markdown 源稿 → 自包含单文件 HTML。

设计目标只有一条：**把结构化内容准确地搬进 HTML，并在落盘之前自己验自己。**
所以这里不追求完整的 Markdown 解析器，只覆盖功能规格文档实际会用的子集：
标题、段落、GFM 表格、围栏代码块、无序/有序列表、引用块、水平线、
行内代码、粗体、链接、以及 `[[DIAGRAM:name]]` 占位插入的内联 SVG。

依赖：**仅 Python 标准库**（不需要 pip、不需要虚拟环境、不需要任何插件）。

用法：
    python build_doc.py --selftest                       # Phase -1 环境自检
    python build_doc.py draft.md -o out.html             # 生成
    python build_doc.py draft.md -o out.html --title "标题" --subtitle "副标题"
    python build_doc.py draft.md -o out.html --no-toc    # 不出目录

退出码：0 成功；1 输入错误；2 结构性断言失败（**不落盘**）。
"""

from __future__ import annotations

import argparse
import html as html_mod
import io
import os
import re
import sys
import tempfile
from typing import Any

# --------------------------------------------------------------------------
# 样式：与 references/html-delivery.md §4 的骨架保持一致。
# 改动这里时必须同步改那份文档，否则「文档说的」和「脚本做的」会分叉。
# --------------------------------------------------------------------------

CSS = """\
:root{
  --ink:#1f2328; --ink-2:#5b6570; --line:#e3e7eb; --bg:#ffffff;
  --bg-soft:#f6f8fa; --accent:#2f6feb;
  --space-1:.35rem; --space-2:.7rem; --space-3:1.1rem;
  --space-4:2rem; --space-5:3.2rem;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);
     font:16px/1.75 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
.wrap{max-width:46em;margin:0 auto;padding:var(--space-5) var(--space-3)}
h1{font-size:2rem;line-height:1.3;margin:0 0 var(--space-2)}
h2{font-size:1.6rem;line-height:1.35;margin:var(--space-5) 0 var(--space-2);
   padding-top:var(--space-3);border-top:1px solid var(--line)}
h3{font-size:1.25rem;line-height:1.4;margin:var(--space-4) 0 var(--space-2)}
h4{font-size:1.05rem;line-height:1.45;margin:var(--space-3) 0 var(--space-2)}
p{margin:0 0 .9rem}
.lead{color:var(--ink-2)}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(47,111,235,.25)}
a:hover{border-bottom-color:var(--accent)}
table{border-collapse:collapse;width:100%;margin:var(--space-2) 0 var(--space-3);
      font-size:.92rem;line-height:1.5}
th,td{border:1px solid var(--line);padding:.5rem .65rem;text-align:left;vertical-align:top}
th{background:var(--bg-soft);font-weight:600}
pre{background:var(--bg-soft);border:1px solid var(--line);border-radius:6px;
    padding:var(--space-2);overflow-x:auto;font-size:.88rem;line-height:1.55}
pre code{font-size:inherit;background:none;border:0;padding:0}
code{font-family:ui-monospace,Consolas,"Courier New",monospace;
     background:var(--bg-soft);border:1px solid var(--line);border-radius:4px;
     padding:.1em .3em;font-size:.9em}
ul,ol{margin:0 0 .9rem;padding-left:1.5rem}
li{margin:.15rem 0}
blockquote{margin:var(--space-2) 0 var(--space-3);padding:var(--space-2) var(--space-3);
           border-left:3px solid var(--accent);background:var(--bg-soft);
           color:var(--ink);font-size:.96rem}
blockquote p:last-child{margin-bottom:0}
hr{border:0;border-top:1px solid var(--line);margin:var(--space-4) 0}
.toc{background:var(--bg-soft);border:1px solid var(--line);border-radius:8px;
     padding:var(--space-2) var(--space-3);margin:var(--space-4) 0;font-size:.94rem}
.toc strong{display:block;margin-bottom:.3rem}
.toc ol{margin:.1rem 0;padding-left:1.3rem}
.toc ol ol{padding-left:1.1rem}
.toc ol.plain{list-style:none;padding-left:.1rem}
.toc ol.plain ol{list-style:none;padding-left:1.1rem}
.toc li{margin:.1rem 0}
.toc a{border-bottom:0}
.summary{margin:var(--space-4) 0;padding:var(--space-3);
         background:var(--bg-soft);border:1px solid var(--line);
         border-left:4px solid var(--accent);border-radius:8px}
.summary h2{margin:0 0 .5rem;padding:0;border:0;font-size:1.2rem}
.tag{display:inline-block;padding:0 .35em;border-radius:4px;font-size:.8em;
     font-weight:600;line-height:1.6;white-space:nowrap;vertical-align:.05em}
.tag-s1{background:#e6f0ff;color:#1a4fb4}
.tag-s2{background:#e8f5ec;color:#1e6b3a}
.tag-s3{background:#f1eafe;color:#5b21b6}
.tag-gap{background:#fdf2d9;color:#8a5a00}
.figure{margin:var(--space-3) 0;text-align:center}
.figure svg{max-width:100%;height:auto}
.figure figcaption{margin-top:.4rem;font-size:.86rem;color:var(--ink-2)}
.backtop{position:fixed;right:1.1rem;bottom:1.1rem;padding:.35rem .7rem;
         background:var(--bg);border:1px solid var(--line);border-radius:999px;
         font-size:.85rem;color:var(--ink-2);box-shadow:0 1px 4px rgba(0,0,0,.08)}
@media (max-width:640px){
  .wrap{padding:var(--space-4) var(--space-2)}
  body{font-size:15px}
  table{display:block;overflow-x:auto;white-space:nowrap}
}
@media print{
  .toc,.backtop{display:none}
  .wrap{max-width:none;padding:0}
  body{font-size:10.5pt}
  table,pre,blockquote{page-break-inside:avoid}
  pre{white-space:pre-wrap;word-break:break-word}
  h2,h3{page-break-after:avoid}
  @page{margin:18mm 16mm}
}
"""

# 允许出现在产物里的自定义标签（由 Markdown 的 <span class="tag ..."> 或 raw HTML 透传）
TAG_ALLOWLIST = ("tag-s1", "tag-s2", "tag-s3", "tag-gap")


# --------------------------------------------------------------------------
# 行内解析
# --------------------------------------------------------------------------

_PLACEHOLDER = "\x00{}\x00"


def inline(text: str) -> str:
    """行内 Markdown → HTML。先抽走代码片段与裸 URL，避免被后续规则二次处理。"""
    stash: list[str] = []

    def keep(fragment: str) -> str:
        stash.append(fragment)
        return _PLACEHOLDER.format(len(stash) - 1)

    # 1) 行内代码
    text = re.sub(r"`([^`]+)`",
                  lambda m: keep("<code>%s</code>" % html_mod.escape(m.group(1), quote=False)),
                  text)
    # 2) 已有的 HTML 标签（我们自己的 tag/figure 等）先保护起来
    text = re.sub(r"<(/?)(span|sup|sub|br|strong|em|svg|path|text|figure|figcaption)\b[^>]*>",
                  lambda m: keep(m.group(0)), text)
    text = re.sub(r"<!--.*?-->", lambda m: keep(m.group(0)), text, flags=re.S)
    # 3) 裸 URL（不落在 markdown 链接里）
    text = re.sub(r"(?<![(=\"'])\bhttps?://[^\s<>()\[\]]+",
                  lambda m: keep('<a href="%s">%s</a>' % (m.group(0), m.group(0))), text)
    # 4) 转义剩余字符
    text = html_mod.escape(text, quote=False)
    # 5) 粗体 / 斜体
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![*\w])\*([^*\n]+?)\*(?![*\w])", r"<em>\1</em>", text)
    # 6) Markdown 链接 [t](u)
    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", r'<a href="\2">\1</a>', text)
    # 7) 还原
    for i, frag in enumerate(stash):
        text = text.replace(_PLACEHOLDER.format(i), frag)
    return text


# --------------------------------------------------------------------------
# 块解析
# --------------------------------------------------------------------------

def _slug(text: str, used: dict[str, int]) -> str:
    """由标题文本生成稳定 id；重复则加 -2 / -3 后缀。"""
    plain = re.sub(r"<[^>]+>", "", text)
    base = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", plain).strip("-").lower() or "section"
    base = base[:60]
    if base in used:
        used[base] += 1
        return "%s-%d" % (base, used[base])
    used[base] = 1
    return base


def strip_frontmatter(md: str) -> tuple[str, dict[str, str]]:
    """剥掉 YAML frontmatter，并把它当元数据返回。

    不做这一步的话，`---` 会被当成三条水平线，整个 frontmatter 里的长段落
    （description / summary）会原样出现在正文最前面——而且首个 H1 的判定也会失准，
    标题退化成「未命名文档」。
    """
    meta: dict[str, str] = {}
    if not md.startswith("---"):
        return md, meta
    lines = md.split("\n")
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() in ("---", "..."):
            end = i
            break
    if end is None:
        return md, meta
    for line in lines[1:end]:
        m = re.match(r"^([A-Za-z_][\w-]*)\s*:\s*(.*)$", line)
        if m:
            val = m.group(2).strip().strip('"').strip("'")
            meta[m.group(1)] = val
    return "\n".join(lines[end + 1:]), meta


def parse_blocks(md: str) -> list[tuple[str, Any]]:
    """把 Markdown 拆成块序列。返回 [(kind, payload), ...]。

    kind ∈ {h1,h2,h3,h4,para,table,code,ul,ol,quote,hr,figure,summary}
    """
    md, _meta = strip_frontmatter(md)
    lines = md.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    blocks: list[tuple[str, Any]] = []
    i, n = 0, len(lines)

    def is_table_sep(s: str) -> bool:
        s = s.strip()
        return bool(s) and "-" in s and set(s) <= set("|-: ") and "|" in s

    def cells(row: str) -> list[str]:
        row = row.strip()
        if row.startswith("|"):
            row = row[1:]
        if row.endswith("|"):
            row = row[:-1]
        # 支持 \| 转义
        parts = re.split(r"(?<!\\)\|", row)
        return [p.strip().replace("\\|", "|") for p in parts]

    while i < n:
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        # 围栏代码块
        m = re.match(r"^(```+|~~~+)\s*([\w+-]*)", stripped)
        if m:
            fence, lang = m.group(1), m.group(2)
            i += 1
            buf: list[str] = []
            while i < n and not lines[i].strip().startswith(fence[:3]):
                buf.append(lines[i])
                i += 1
            i += 1  # 收尾栅栏
            blocks.append(("code", {"lang": lang, "text": "\n".join(buf)}))
            continue

        # 水平线
        if re.fullmatch(r"(-{3,}|\*{3,}|_{3,})", stripped):
            blocks.append(("hr", None))
            i += 1
            continue

        # 标题
        m = re.match(r"^(#{1,6})\s+(.*?)\s*#*$", stripped)
        if m:
            level = len(m.group(1))
            body = m.group(2)
            # 摘要块：`## 摘要` / `## 执行摘要` 单独成块，便于页首样式
            if level == 2 and re.fullmatch(r"(摘要|执行摘要|Executive Summary|Summary)", body.strip(), re.I):
                i += 1
                buf = []
                while i < n:
                    nxt = lines[i]
                    if re.match(r"^#{1,6}\s+", nxt.strip()):
                        break
                    buf.append(nxt)
                    i += 1
                blocks.append(("summary", parse_blocks("\n".join(buf))))
                continue
            blocks.append(("h%d" % min(level, 4), body))
            i += 1
            continue

        # 列表项内部的表格会带缩进（`   | a | b |`），必须先剥掉缩进再判断，
        # 否则整张表会被当成普通段落吞掉——而且不会报错。A1 断言正是为这种情况准备的。
        indent = len(line) - len(line.lstrip(" "))

        # 表格：当前行有 |，下一行是分隔行
        if "|" in stripped and i + 1 < n and is_table_sep(lines[i + 1]):
            header = cells(stripped)
            cols = len(header)
            i += 2
            rows: list[list[str]] = []
            while i < n:
                row = lines[i].strip()
                if not row or "|" not in row:
                    break
                body_cells = cells(row)
                if len(body_cells) < cols:
                    body_cells += [""] * (cols - len(body_cells))
                rows.append(body_cells[:cols])
                i += 1
            blocks.append(("table", {"header": header, "rows": rows}))
            continue

        # 引用块
        if stripped.startswith(">"):
            buf = []
            while i < n and lines[i].strip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            blocks.append(("quote", parse_blocks("\n".join(buf))))
            continue

        # 列表
        m = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", raw)
        if m:
            ordered = bool(re.match(r"\d+[.)]", m.group(2)))
            items: list[list[Any]] = []  # [(text, sub_blocks)]
            base_indent = len(m.group(1))
            while i < n:
                cur = lines[i]
                cm = re.match(r"^(\s*)([-*+]|\d+[.)])\s+(.*)$", cur)
                if cm and len(cm.group(1)) <= base_indent + 1:
                    items.append([cm.group(3), None])
                    i += 1
                    continue
                if cm and len(cm.group(1)) > base_indent + 1 and items:
                    # 嵌套列表：整体吃掉，作为子块
                    sub_start = i
                    sub_indent = len(cm.group(1))
                    while i < n:
                        scm = re.match(r"^(\s*)([-*+]|\d+[.)])\s+", lines[i])
                        if not lines[i].strip():
                            i += 1
                            continue
                        if not scm or len(scm.group(1)) < sub_indent:
                            break
                        i += 1
                    sub_md = "\n".join(re.sub(r"^\s{%d}" % sub_indent, "", x) for x in lines[sub_start:i])
                    items[-1][1] = parse_blocks(sub_md)
                    continue
                if not cur.strip() and items:
                    i += 1
                    continue
                # 列表项内部嵌的表：`   | a | b |` + 下一行 `   |---|---|`。
                # 必须在"续行拼接"之前拦住，否则整张表会被当成 item 的续行文字吞掉。
                if items and "|" in cur.strip() and i + 1 < n and is_table_sep(lines[i + 1]):
                    sub_indent = len(cur) - len(cur.lstrip(" "))
                    sub_start = i
                    i += 1
                    while i < n and lines[i].strip() and "|" in lines[i]:
                        i += 1
                    sub_md = "\n".join(
                        re.sub(r"^\s{0,%d}" % sub_indent, "", x) for x in lines[sub_start:i])
                    sub_blocks = parse_blocks(sub_md)
                    if items[-1][1]:
                        items[-1][1].extend(sub_blocks)
                    else:
                        items[-1][1] = sub_blocks
                    continue
                if cur.startswith(" " * (base_indent + 2)) and items:
                    items[-1][0] += " " + cur.strip()
                    i += 1
                    continue
                break
            blocks.append(("ol" if ordered else "ul", items))
            continue

        # 图示占位
        m = re.fullmatch(r"\[\[DIAGRAM:(.+?)\]\]", stripped)
        if m:
            name = m.group(1).strip()
            i += 1
            blocks.append(("figure", {"name": name,
                                      "caption": ""}))
            continue

        # 段落：吃到空行或下一个块起始
        buf = [stripped]
        i += 1
        while i < n:
            nxt = lines[i]
            s = nxt.strip()
            if not s:
                break
            if re.match(r"^(#{1,6}\s|```|~~~|>|\s*([-*+]|\d+[.)])\s)", s):
                break
            if "|" in s and i + 1 < n and is_table_sep(lines[i + 1]):
                break
            if re.fullmatch(r"(-{3,}|\*{3,}|_{3,})", s):
                break
            buf.append(s)
            i += 1
        blocks.append(("para", " ".join(buf)))

    return blocks


# --------------------------------------------------------------------------
# 渲染
# --------------------------------------------------------------------------

def render_tables(blocks: list[tuple[str, Any]], used_ids: dict[str, int]) -> str:
    out: list[str] = []
    for kind, payload in blocks:
        if kind == "table":
            head = "".join("<th>%s</th>" % inline(c) for c in payload["header"])
            body = "".join(
                "<tr>%s</tr>" % "".join("<td>%s</td>" % inline(c) for c in row)
                for row in payload["rows"]
            )
            out.append("<table>\n<thead><tr>%s</tr></thead>\n<tbody>%s</tbody>\n</table>\n"
                       % (head, body))
    return "".join(out)


def render_blocks(blocks: list[tuple[str, Any]], used_ids: dict[str, int],
                  headings: list[tuple[int, str, str]] | None = None) -> str:
    out: list[str] = []
    for idx, (kind, payload) in enumerate(blocks):
        if kind == "h1":
            hid = _slug(payload, used_ids)
            out.append('<h1 id="%s">%s</h1>\n' % (hid, inline(payload)))
            if headings is not None:
                headings.append((1, hid, payload))
        elif kind in ("h2", "h3", "h4"):
            level = int(kind[1])
            hid = _slug(payload, used_ids)
            out.append('<%s id="%s">%s</%s>\n' % (kind, hid, inline(payload), kind))
            if headings is not None:
                headings.append((level, hid, payload))
        elif kind == "para":
            cls = ' class="lead"' if idx + 1 < len(blocks) and blocks[idx + 1][0].startswith("h") else ""
            out.append("<p%s>%s</p>\n" % (cls, inline(payload)))
        elif kind == "code":
            lang = payload["lang"]
            cls = ' class="language-%s"' % lang if lang else ""
            out.append("<pre><code%s>%s</code></pre>\n"
                       % (cls, html_mod.escape(payload["text"], quote=False)))
        elif kind == "ul" or kind == "ol":
            out.append("<%s>\n" % kind)
            for text, sub in payload:
                inner = inline(text)
                if sub:
                    inner += render_blocks(sub, used_ids, headings)
                out.append("<li>%s</li>\n" % inner)
            out.append("</%s>\n" % kind)
        elif kind == "quote":
            out.append("<blockquote>\n%s</blockquote>\n" % render_blocks(payload, used_ids, headings))
        elif kind == "hr":
            out.append("<hr>\n")
        elif kind == "figure":
            # 图示模块是可选的：没有 figures.py 时降级为一句提示，而不是崩掉整篇文档
            svg = ""
            try:
                import figures  # type: ignore
                svg = getattr(figures, "FIGURES", {}).get(payload["name"], "")
            except ImportError:
                svg = ""
            if svg:
                cap = payload.get("caption") or ""
                out.append('<figure class="figure">%s%s</figure>\n'
                           % (svg, "<figcaption>%s</figcaption>" % inline(cap) if cap else ""))
            else:
                out.append('<p class="lead">［图示缺失：%s］</p>\n' % inline(payload["name"]))
        elif kind == "summary":
            out.append('<section class="summary">\n<h2>摘要</h2>\n%s</section>\n'
                       % render_blocks(payload, used_ids, headings))
        elif kind == "table":
            out.append(render_tables([(kind, payload)], used_ids))
    return "".join(out)


def build_toc(headings: list[tuple[int, str, str]]) -> str:
    """只收 h2 / h3，输出一棵嵌套正确的 <ol> 树。

    两个必须处理的细节：
    1. **嵌套层级**：用栈记住"当前打开着哪些层级"。每遇到一个 h3，只有当上一个
       兄弟是 h2 时才新开子表；否则它只是同一条 h2 下的又一个 h3。
    2. **重复编号**：源稿标题常自带 "1. " / "1.1 " 前缀（中文技术文档的惯例）。
       `<ol>` 也会自己编号，两者叠加就会渲染成 "1. 1. 审查发现"。
       所以标题文本自带编号时，改用 `class="plain"` 的无编号列表。
    """
    picked = [(lv, hid, txt) for lv, hid, txt in headings if lv in (2, 3)]
    if not picked:
        return ""

    # 只要有一个标题自带数字编号，整份目录就关掉 <ol> 自动编号，避免混排
    numbered = any(re.match(r"^\s*\d+(\.\d+)*[.、]\s", re.sub(r"<[^>]+>", "", t))
                   for _lv, _hid, t in picked)
    cls = ' class="plain"' if numbered else ""

    out: list[str] = ['<nav class="toc" aria-label="目录">', "<strong>目录</strong>"]
    stack: list[int] = []

    def close_to(level: int) -> None:
        """把栈里 >= level 的层级全部关闭。"""
        while stack and stack[-1] >= level:
            out.append("</li></ol>")
            stack.pop()

    prev_level = None
    for lv, hid, txt in picked:
        if prev_level is None:
            out.append("<ol%s>" % cls)
            stack.append(lv)
            out.append('<li><a href="#%s">%s</a>' % (hid, inline(txt)))
        elif lv > prev_level:
            out.append("<ol%s>" % cls)
            stack.append(lv)
            out.append('<li><a href="#%s">%s</a>' % (hid, inline(txt)))
        elif lv == prev_level:
            out.append('</li><li><a href="#%s">%s</a>' % (hid, inline(txt)))
        else:
            close_to(lv + 1)
            out.append('</li><li><a href="#%s">%s</a>' % (hid, inline(txt)))
        prev_level = lv

    close_to(0)
    out.append("</nav>")
    return "\n".join(out) + "\n"


# --------------------------------------------------------------------------
# 断言：落盘前的七条自检 + 版式告警
# --------------------------------------------------------------------------

def layout_warnings(blocks: list[tuple[str, Any]]) -> list[str]:
    """版式告警（不阻断落盘）。

    结构性断言（A1–A6）管的是"内容有没有丢"，它们必须是硬失败；
    版式约束（L1–L7）管的是"读起来累不累"，多数是作者的取舍，硬失败会把
    一次正常的交付拦在半路。所以这里只**报告**，由调用方决定改不改。

    唯一的例外是 L4：列数超限是机械可判的，且修法明确（拆表 / 合并列），
    值得在每次生成时喊一声——否则文档里写着"上限 6 列"，脚本却默默放行 7 列，
    规范和实现就分叉了。
    """
    warns: list[str] = []
    for kind, payload in _walk(blocks):
        if kind != "table":
            continue
        cols = len(payload["header"])
        if cols > 6:
            head = " / ".join(re.sub(r"[`*_]", "", c)[:12] for c in payload["header"])
            warns.append("L4 表格有 %d 列（上限 6）：[%s…] —— 窄屏与 A4 打印下每列只剩 3–4 字，"
                         "建议拆成两张表或合并低优先级列" % (cols, head))
    return warns


def _walk(blocks: list[tuple[str, Any]]):
    """递归遍历所有嵌套块（列表子块、引用块、摘要块里的表也要算进去）。

    早先只对顶层 `blocks` 做计数，结果列表项里嵌的表被漏算，A1 会反过来说
    "HTML 14 != Markdown 12"——断言本身算错了，而不是产物错了。
    """
    for kind, payload in blocks:
        yield kind, payload
        if kind == "quote":
            yield from _walk(payload)
        elif kind in ("ul", "ol"):
            for _text, sub in payload:
                if sub:
                    yield from _walk(sub)
        elif kind == "summary":
            yield from _walk(payload)


def assert_shape(blocks: list[tuple[str, Any]], body_html: str) -> None:
    """结构性断言。任何一条不过就抛 AssertionError —— 调用方不得落盘。"""
    flat = list(_walk(blocks))
    md_tables = sum(1 for k, _ in flat if k == "table")
    n_tables = body_html.count("<table")
    assert n_tables == md_tables, "A1 表格数不符：HTML %d != Markdown %d" % (n_tables, md_tables)

    if md_tables:
        assert body_html.count("<thead") == md_tables, "A2 有表格丢了 <thead>"
        assert body_html.count("<tbody") == md_tables, "A2 有表格丢了 <tbody>"

    md_headings = sum(1 for k, _ in flat if re.fullmatch(r"h[1-4]", k))
    n_headings = len(re.findall(r"<h[1-4][ >]", body_html))
    assert n_headings >= md_headings, \
        "A3 标题数不符：HTML %d < Markdown %d" % (n_headings, md_headings)

    assert len(body_html) > 2000, "A4 正文过短（%d 字符），疑似空壳" % len(body_html)

    # A5 只拦"加载外部资源"的引用：img/script/link/iframe/video/audio/source 的 src|href。
    # 正文里的 <a href="https://..."> 是**链接文本**，不是资源——把它也算进去会误伤所有带出处的文档。
    ext = re.findall(r'<(?:img|script|link|iframe|video|audio|source)\b[^>]*\b(?:src|href)\s*=\s*["\']https?://',
                     body_html, re.I)
    assert not ext, "A5 存在 %d 处外部资源引用（img/script/link/iframe），破坏离线自包含" % len(ext)
    # 独立再查一次 CSS 里的 @import / url() 远程引用
    assert not re.search(r'@import\s+url\(\s*["\']?https?://', body_html, re.I), \
        "A5 CSS 里存在远程 @import"

    anchors = set(re.findall(r'href="#([^"]+)"', body_html))
    ids = set(re.findall(r'id="([^"]+)"', body_html))
    dangling = anchors - ids
    assert not dangling, "A6 目录锚点断链：%s" % ", ".join(sorted(dangling)[:5])

    # A7：每个 h2/h3 都必须带 id（L7 的另一半）。
    # A6 只验证「目录里写的锚点存在」，反过来的情况它看不见：某个标题没进目录、
    # 又恰好没 id，读者就永远拿不到指向它的永久链接。`--no-toc` 时 A6 完全空转，
    # 这条是那时唯一的保护。
    headless = re.findall(r"<h([23])(?![^>]*\sid=)[^>]*>(.*?)</h\1>", body_html, re.S)
    assert not headless, "A7 有 %d 个 h2/h3 缺 id：%s" % (
        len(headless), " / ".join(re.sub(r"<[^>]+>", "", t)[:24] for _lv, t in headless[:3]))


# --------------------------------------------------------------------------
# 组装
# --------------------------------------------------------------------------

PAGE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="开源一切 / teardown-to-spec">
<title>{title}</title>
<style>
{css}
</style>
</head>
<body>
<a id="top"></a>
<div class="wrap">
<h1 id="doc-title">{title}</h1>
{subtitle}
{summary}
{toc}
</div>
<a class="backtop" href="#top">↑ 回顶</a>
</body>
</html>
"""


def build(md: str, title: str | None, subtitle: str | None, toc: bool) -> str:
    blocks = parse_blocks(md)
    used_ids: dict[str, int] = {}

    # 摘要块单独提到页首，正文里不再重复
    summary_html = ""
    body_blocks: list[tuple[str, Any]] = []
    for kind, payload in blocks:
        if kind == "summary":
            summary_html = '<section class="summary">\n<h2 id="summary">摘要</h2>\n' \
                           '<para/>'  # 占位，稍后替换
            summary_payload = payload
        else:
            body_blocks.append((kind, payload))

    # 首个 h1 视作文档标题，避免与页首 <h1> 重复
    if body_blocks and body_blocks[0][0] == "h1":
        if not title:
            title = re.sub(r"<[^>]+>", "", inline(body_blocks[0][1]))
        body_blocks = body_blocks[1:]

    # 关键顺序：**先渲染正文**（id 在这里落地），再据实生成的标题列表出目录。
    # 反过来做会得到一张指向不存在 id 的死链目录——断言 A6 会当场拦住。
    headings: list[tuple[int, str, str]] = []
    body_html = render_blocks(body_blocks, used_ids, headings)

    if summary_html:
        sum_heads: list[tuple[int, str, str]] = []
        sum_body = render_blocks(summary_payload, used_ids, sum_heads)
        summary_html = ('<section class="summary">\n<h2 id="summary">摘要</h2>\n%s'
                        '</section>\n' % sum_body)

    title = title or "未命名文档"
    toc_html = build_toc(headings) if toc else ""
    sub_html = '<p class="lead">%s</p>\n' % inline(subtitle) if subtitle else ""

    page = PAGE.format(
        title=html_mod.escape(title, quote=False),
        css=CSS,
        subtitle=sub_html,
        summary=summary_html,
        toc=toc_html,
    )
    # 把正文插到目录之后
    page = page.replace("</div>\n<a class=\"backtop\"", body_html + "</div>\n<a class=\"backtop\"")
    return page


def _body_only(page: str) -> str:
    m = re.search(r'<div class="wrap">(.*)</div>\s*<a class="backtop"', page, re.S)
    return m.group(1) if m else page


def selftest() -> int:
    """Phase -1 自检：环境可用 + 七条断言真的会跑 + L4 告警双向验证。"""
    print("[1/4] Python %s" % sys.version.split()[0])
    filler = ("这一段只是把样本文档撑到断言 A4 所需的最小长度，不含任何业务含义，"
              "用来确认渲染链路在长正文下同样稳定。\n\n")
    sample = """# 自检样本文档

""" + filler * 25 + """## 1. 章节甲

这是一段正文，用来确认段落被正确包进 `<p>` 标签，而且行内代码不会被二次转义。

### 1.1 小节

| 参数 | 取值 |
|---|---|
| a | 1 |
| b | 2 |

## 2. 章节乙

- 列表项一
- 列表项二

```js
console.log("ok");
```

> 引用块里的 **粗体** 与 `代码` 也要正常。
""" + filler * 10
    print("[2/4] 解析与渲染 …")
    blocks = parse_blocks(sample)
    kinds = [k for k, _ in blocks]
    if "table" not in kinds or "code" not in kinds or "quote" not in kinds:
        print("   FAIL：样本文档的表格 / 代码块 / 引用块没有被识别：%s" % kinds)
        return 1
    used: dict[str, int] = {}
    heads: list[tuple[int, str, str]] = []
    body = render_blocks([b for b in blocks if b[0] != "h1"], used, heads)
    print("[3/4] 结构性断言 …")
    try:
        assert_shape([b for b in blocks if b[0] != "h1"], body)
    except AssertionError as e:
        print("   FAIL：%s" % e)
        return 1
    # 反向验证：断言确实会拦住坏产物
    bad = [b for b in blocks if b[0] != "h1"]
    try:
        assert_shape(bad, body + '<img src="https://x.y/a.png">')
        print("   FAIL：外部资源断言没有生效")
        return 1
    except AssertionError:
        pass
    # 正文里的 <a href="https://..."> 是链接文本，不该被 A5 拦下
    try:
        assert_shape(bad, body + '<a href="https://example.com">example</a>')
    except AssertionError as e:
        print("   FAIL：A5 误伤了正文链接：%s" % e)
        return 1
    try:
        assert_shape(bad, body + '<a href="#nope">x</a>')
        print("   FAIL：断链锚点断言没有生效")
        return 1
    except AssertionError:
        pass
    try:
        assert_shape(bad, body.replace("<thead>", "<xx>", 1))
        print("   FAIL：表头结构断言没有生效")
        return 1
    except AssertionError:
        pass
    try:
        assert_shape(bad, body + "<h2>没有 id 的标题</h2>")
        print("   FAIL：A7 没有拦住缺失 id 的标题")
        return 1
    except AssertionError:
        pass
    # 版式告警：6 列不报、7 列必须报（L4）
    ok6 = [("table", {"header": ["a"] * 6, "rows": [["1"] * 6]}), ("para", "x" * 2100)]
    if layout_warnings(ok6):
        print("   FAIL：L4 对 6 列表格误报了")
        return 1
    bad7 = [("table", {"header": ["a"] * 7, "rows": [["1"] * 7]}), ("para", "x" * 2100)]
    if not layout_warnings(bad7):
        print("   FAIL：L4 没有拦住 7 列表格")
        return 1
    print("[4/4] 输出目录可写 …")
    d = tempfile.mkdtemp(prefix="tdoc-")
    f = os.path.join(d, "selftest.html")
    with io.open(f, "w", encoding="utf-8") as fh:
        fh.write(build(sample, "selftest", None, True))
    size = os.path.getsize(f)
    os.remove(f)
    print("   OK，写出 %d 字节" % size)
    print("env OK")
    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Markdown → 自包含单文件 HTML")
    ap.add_argument("input", nargs="?", help="Markdown 源稿路径")
    ap.add_argument("-o", "--out", help="输出 HTML 路径（默认与输入同名 .html）")
    ap.add_argument("--title", help="文档标题（默认取首个 H1）")
    ap.add_argument("--subtitle", help="副标题 / 一句话定位")
    ap.add_argument("--no-toc", action="store_true", help="不生成目录")
    ap.add_argument("--selftest", action="store_true", help="跑环境自检后退出")
    ap.add_argument("--draft-only", action="store_true",
                    help="只走到断言之前，用于调试解析问题")
    ap.add_argument("--strict-layout", action="store_true",
                    help="把版式告警（如 L4 表格列数超限）升级为失败，不落盘")
    args = ap.parse_args(argv)

    if args.selftest:
        return selftest()

    if not args.input:
        ap.error("需要输入文件，或使用 --selftest")
    if not os.path.isfile(args.input):
        print("输入文件不存在：%s" % args.input, file=sys.stderr)
        return 1

    with io.open(args.input, encoding="utf-8") as fh:
        md = fh.read()

    # frontmatter 里的 name / displayName 是标题的兜底来源
    _body, meta = strip_frontmatter(md)
    title = args.title or meta.get("displayName") or meta.get("name") or meta.get("title")
    page = build(md, title, args.subtitle, not args.no_toc)
    blocks = [b for b in parse_blocks(md) if b[0] not in ("h1", "summary")]
    body_html = _body_only(page)

    if args.draft_only:
        print(body_html[:2000])
        return 0

    try:
        assert_shape(blocks, page)
    except AssertionError as e:
        print("结构性断言失败，**未落盘**：%s" % e, file=sys.stderr)
        return 2

    # 版式告警：只报告，不阻断。`--strict-layout` 时才升级为失败。
    warns = layout_warnings(blocks)
    for w in warns:
        print("WARN " + w, file=sys.stderr)
    if warns and args.strict_layout:
        print("版式告警已升级为失败（--strict-layout），**未落盘**", file=sys.stderr)
        return 2

    out = args.out or (os.path.splitext(args.input)[0] + ".html")
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
    with io.open(out, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(page)          # 断言已在前一刻跑过
    print('{"success": true, "html_path": "%s", "bytes": %d}' % (out, len(page.encode("utf-8"))))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
