# 功能规格文档骨架 · Functional Spec Document Outline

Phase 3 的产出骨架。目标是让一位工程师**在完全看不到原站的情况下把它实现出来**。

The output skeleton for Phase 3. The goal is to let an engineer **implement it without ever seeing the original site**.

写作纪律：数字给具体值 + 可调区间；接口给签名；验收项写成可勾选的；每一个模糊形容词都换成一个数字。

Writing discipline: give numbers as concrete values plus an adjustable range; give interfaces as signatures; write acceptance items as checkboxes; replace every vague adjective with a number.

---

## 推荐的章节结构 · Recommended Section Structure

```
封面（可选，取决于交付媒介）
摘要 / 执行摘要                      ← 一个位置，一章
1. 文档说明
    (1) 本文目的
    (2) 共用的底层链路（不变的部分）       ← 最有价值的一章
    (3) 术语约定
2 … N. 各方案规格（一个方案一章）
    (1) 素材/形状定义
    (2) 视觉/行为特征规格（表格）
    (3) 配色与基底（或对应资源）
    (4) 节点/边界装饰
    (5) 动效
    (6) 本方案特有变体
N+1. 实现接口契约
    (1) 变更面清单（表格：模块 / 是否改动 / 备注）
    (2) 核心接口签名
    (3) 内部执行步骤（按顺序）
    (4) 资源/基底接口
    (5) 动效推进接口
    (6) 组合配置
N+2. 参数总表
N+3. 验收点（分方案清单 + 公共清单）
N+4. 风险与待办（含证据缺口）
N+5. 与原实现的差异速查（对照表）
X.  使用建议（按用户意图写其中一部分）
      · 当作教科书（学习向，见 learning-track.md）
      · 当作蓝图（净室向，见 clean-room-design.md）
```

**「摘要」只写一次。** 骨架里它是**一个位置**，不是两章：不要同时写「摘要」和「执行摘要」，也不要让同一句结论在文档里出现两遍。它承载三样东西——**结论**（这套机制的关键判断）、**关键指标**（实现前必须定死的几个数字）、**风险边界**（哪几处是假设而非证据）。排版链会把它映射成 `.executive-summary` 块，那是同一个位置的另一种呈现，不是第二个章节。

**Write the summary once.** In this skeleton it is **one slot**, not two chapters: do not write both a "摘要" and an "执行摘要", and never let the same conclusion appear twice. It carries three things — **conclusions** (the key verdicts about the mechanism), **key metrics** (the numbers that must be fixed before implementation), and **risk boundary** (which parts are assumptions rather than evidence). The layout chain maps it into an `.executive-summary` block, which is the same slot rendered differently, not a second chapter.

**章节数要在动笔前定下来。** 篇幅由**变更面**决定，不由目标的大小决定：

| 用户要的 | 章节数 | 取舍 |
|---|---|---|
| 解析某个功能 / 搞懂这一块 | 8–11 章 | 机制链讲透，跳过与结论无关的模块 |
| 整个目标拆成可施工规格 | 12–16 章 | 每模块一章，末尾加差异速查 |
| 只要结论 / 只要能不能换做法 | 3–5 章 | 结论 + 证据 + 施工要点，不铺骨架 |

**Fix the chapter count before drafting.** Length is set by the **change surface**, not by the size of the target:

| What was asked | Chapters | Trade-off |
|---|---|---|
| Analyze one feature / understand this part | 8–11 | Explain the mechanism chain fully; skip modules irrelevant to the verdict |
| Whole target as a buildable spec | 12–16 | One chapter per module, plus a difference quick reference at the end |
| Just a verdict / can it be done differently | 3–5 | Verdict + evidence + build points; skip the full skeleton |

超过上限说明**还没收敛**，回 Phase 2 重新判断哪几个环节是决定性的。硬撑章节不会增加信息，只会让变更面更难看清。

Exceeding the cap means **you have not converged** — go back to Phase 2 and re-decide which links are decisive. Padding chapters adds no information; it only makes the change surface harder to see.

---

## 逐章写作要点 · Section-by-Section Writing Points

### 「共用的底层链路」—— 先画出不变的面 · "The Shared Underlying Pipeline" — Draw the Unchanged Surface First

**这是整份文档里价值最高的一章。** 用一张表把"从输入到输出"的每一层列出来，并标出哪些不变：

**This is the highest-value chapter in the entire document.** Use a table to list every layer from input to output, and mark which ones stay unchanged:

| 阶段 | 处理 | 产出 |
|------|------|------|
| ① … | 具体的算法/调用 | 中间数据结构 |
| … | | |
| ⑥ 落地 | **所有差异都在这一步** | 最终产物 |

| Stage | Processing | Output |
|------|------|------|
| ① … | The specific algorithm / call | Intermediate data structure |
| … | | |
| ⑥ Landing | **All differences live in this step** | Final artifact |

然后用一句话收敛：**"唯一的变更面是第 ⑥ 步的绘制函数"**。变更面越小，实现成本越可控，读者越有信心。

Then converge in one sentence: **"the only change surface is the draw function in step ⑥"**. The smaller the change surface, the more controllable the implementation cost and the more confident the reader.

反模式：开篇就写"我们将实现 A、B、C 三套方案"，读者无法判断它们共用的成本有多大。

Anti-pattern: opening with "we will implement three variants, A, B and C", which leaves the reader unable to judge how much shared cost they carry.

### 各方案规格 —— 让表格扛住正文 · Per-Variant Specs — Let the Tables Carry the Prose

视觉/行为特征一律用两列表格（特征 / 规格），规格列写**数值表达式**而不是形容词：

Visual and behavioral characteristics always use a two-column table (feature / spec), with the spec column stating a **numeric expression** rather than an adjective:

| 特征 | 规格 |
|------|------|
| 横向振幅 | `A = w * 0.34`，其中 `w` 为标称宽度 |
| 缠绕周期 | `λ = w * 3.2`，随种子在 2.8–3.8 倍之间浮动 |
| 主高光带宽度 | `w * 0.22`，峰值不透明度 0.92 |

| Feature | Spec |
|------|------|
| Horizontal amplitude | `A = w * 0.34`, where `w` is the nominal width |
| Winding period | `λ = w * 3.2`, varying between 2.8x and 3.8x depending on the seed |
| Main highlight band width | `w * 0.22`, peak opacity 0.92 |

**所有长度参数都相对于字号 `w`**，绝不用绝对像素——这是唯一能与字号/缩放解耦的写法。

**All length parameters are relative to the font size `w`**, never absolute pixels — this is the only formulation that decouples them from font size and zoom.

### 接口契约 —— 给签名，不给描述 · Interface Contract — Give Signatures, Not Descriptions

```ts
type StrokeRenderer = (
  ctx: CanvasRenderingContext2D,
  path: Point[],
  width: number,
  seed: number,
  opts: { progress: number; color: string; palette: string[] }
) => void;
```

必须提供的关键信息：

Required key information:

1. **变更面清单**：哪些模块要改、哪些不改、怎么改（替换 / 参数化 / 扩展 / 复用）。
2. **接口签名**：名称、入参、出参、语义。
3. **内部执行步骤**：有序列表，逐步写清"用了什么、叠了什么、按什么顺序"。
   顺序本身常常就是关键（高光先叠还是后叠，效果完全不同）。
4. **组合配置**：把各方案做成配置对象数组，切换方案只改配置，不改调用方。

1. **Change-surface inventory**: which modules change, which do not, and how they change (replace / parameterize / extend / reuse).
2. **Interface signatures**: names, inputs, outputs, semantics.
3. **Internal execution steps**: an ordered list stating, step by step, "what is used, what is layered on, and in what order".
   The order itself is often the crux (highlight layered first or last gives completely different results).
4. **Composition config**: turn each variant into an entry of a config object array, so switching variants changes only the config, not the caller.

### 参数总表 · Master Parameter Table

把散落各章的参数收拢到一处，三列：参数 / 取值 / 可调区间。
这是实现时的数值手册，也是调参时的对照表。

Gather the parameters scattered across chapters into one place, three columns: parameter / value / adjustable range.
This is the numeric handbook for implementation and the lookup table for tuning.

### 验收点 · Acceptance Points

写成**可勾选的编号清单**，判据尽量落在"肉眼可分辨"这一级：

Write them as a **numbered checklist**, keeping criteria at the "distinguishable by eye" level:

- 好：`笔画在视觉上能分辨为两条交缠的藤蔓，而不是一条带肌理的线。`
- 好：`同一字符在参数不变时重复绘制，抖动完全一致（种子可复现）。`
- 差：`效果要自然。`

- Good: `the strokes read visually as two intertwined vines rather than a single textured line.`
- Good: `redrawing the same glyph with unchanged parameters yields exactly the same jitter (the seed is reproducible).`
- Bad: `the effect should look natural.`

两块：**分方案清单** + **公共清单**（跨方案的约束，例如"切换方案不改变底层结构"）。

Two parts: **a per-variant checklist** + **a shared checklist** (cross-variant constraints, e.g. "switching variants does not change the underlying structure").

### 风险与待办 · Risks and Open Items

三列表格：条目 / 说明 / 建议。写真实的工程风险（性能、平台差异、小尺寸下的边缘毛刺）；不要写"时间可能不够"这类填充。

Three-column table: item / description / recommendation. Write real engineering risks (performance, platform differences, edge jaggies at small sizes); do not write filler such as "there may not be enough time".

**「未知与未验证项」住在这里**，非空时不可省略。两类要分开写：

**"Unknowns and unverified items" live here**, and must not be omitted when non-empty. Write the two categories separately:

| 类别 | 长什么样 | 条目必须写清 |
|---|---|---|
| **证据缺口** | 机制未验证：没有 WebGL、登录墙、反爬、服务端 | 本地试过哪些验证手段、为什么失败，以及结论依据的是源码结构还是公开描述 |
| **待定决策** | 某处是按假设定的，不是按证据定的 | 做了什么假设、假设错了代价多大 |

| Category | What it looks like | What each entry must state |
|---|---|---|
| **Evidence gap** | Mechanism unverified: no WebGL, login wall, anti-scraping, server-side | Which local verification attempts were tried, why they failed, and whether the conclusion rests on source structure or on public descriptions |
| **Pending decision** | Something was settled by assumption, not by evidence | What was assumed, and how costly a wrong assumption is |

任何**只靠网络调研支撑的决定性环节**都要落到第一行——绝不能悄悄留在正文里。引证放在**它所支撑的那句话旁边**；不要收集到文末一个独立的参考文献章节，那正是未标注断言溜过去的方式。

Any **decisive step supported only by online research** must land in the first row — never leave it quietly in the body text. Put citations **next to the sentence they support**; do not collect them into a separate references chapter at the end, which is precisely how unlabeled assertions slip through.

### 差异速查 · Difference Quick Reference

结尾给一张对照表，维度 × 方案。让读者一眼定位到自己需要的那一行，再顺着行名回到对应章节。

Close with a comparison table, dimensions × variants. Let the reader find the row they need at a glance, then follow the row name back to the corresponding chapter.

---

## 交付媒介适配 · Delivery Medium Adaptation

| 媒介 | 适配要点 |
|------|---------|
| **单文件 HTML**（**默认**） | 结构完全按上面的骨架；用 `scripts/build_doc.py` 生成（内联 CSS、目录、锚点、`<thead>/<tbody>` 表格）；约束见 `html-delivery.md` |
| **.docx**（按需附加） | 仅当用户明确要 Word 时：从同一份 Markdown 走 `docx-delivery.md` 的 tencent-docx 链，**不要**从 HTML 反推 |
| **Markdown**（降级） | 直接按上述结构写；表格用 GFM。仅在 HTML 生成失败时使用，并如实说明原因 |

| Medium | Adaptation points |
|------|---------|
| **Single-file HTML** (**default**) | Structure exactly as the skeleton above; generate with `scripts/build_doc.py` (inline CSS, contents, anchors, `<thead>/<tbody>` tables); constraints in `html-delivery.md` |
| **.docx** (on-demand add-on) | Only when the user explicitly wants Word: run the tencent-docx chain in `docx-delivery.md` from the same Markdown, **never** back-convert the HTML |
| **Markdown** (fallback) | Write directly in the structure above; use GFM for tables. Only when HTML generation fails, and say why honestly |

无论哪种媒介，**内容结构完全一致**——媒介只影响排版，不影响章节骨架。

Whichever medium is used, **the content structure is identical** — the medium only affects typesetting, not the section skeleton.

---

## 自检清单 · Self-Check Checklist

交付前逐条过一遍：

Go through it item by item before delivery:

1. [ ] 「不变的部分」与「变更面」都显式写出，且变更面收敛到最小。
2. [ ] 每个数字都是具体值或表达式；没有"适当""略微""差不多"。
3. [ ] 每个方案都有可勾选的验收清单，判据落在肉眼可分辨这一级。
4. [ ] 接口签名完整；调用方不需要猜参数含义。
5. [ ] 执行步骤有明确顺序，关键顺序变化处有标注。
6. [ ] 所有长度参数都相对于字号，不是绝对像素。
7. [ ] 风险项是工程风险，且都有对应的建议动作。
8. [ ] 结尾有差异速查表。
9. [ ] 章节数在动笔前定好，且不超过对应档位的上限。
10. [ ] 「摘要」只有一处，同一句结论全文只出现一次。
11. [ ] 用到的每个组件都确认过它能落进最终产物（HTML 里能正常渲染，不依赖外部资源）。

1. [ ] The "unchanged part" and the "change surface" are both written out explicitly, and the change surface is reduced to the minimum.
2. [ ] Every number is a concrete value or an expression; no "appropriate", "slightly", "about right".
3. [ ] Every variant has a checkbox acceptance list, with criteria at the distinguishable-by-eye level.
4. [ ] Interface signatures are complete; the caller does not have to guess what a parameter means.
5. [ ] Execution steps have an explicit order, and points where the order matters are annotated.
6. [ ] All length parameters are relative to the font size, not absolute pixels.
7. [ ] Risk items are engineering risks, and each has a corresponding recommended action.
8. [ ] A difference quick-reference table closes the document.
9. [ ] The chapter count was fixed before drafting and stays within its tier's cap.
10. [ ] There is exactly one summary, and each conclusion appears exactly once.
11. [ ] Every component used was confirmed to survive into the final artifact (renders correctly in HTML, with no external dependency).
