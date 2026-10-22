# 学习向写作细则 · Writing Guidelines for the Learning Track

「**当作教科书**」章节的执行手册 —— 该章节位于主链交付的规格文档末尾。当用户想**弄懂**目标是怎么做到的、而不是立刻照着做一个时适用。

Execution manual for the "**treat it as a textbook**" section — that section sits at the end of the spec document delivered by the main chain. It applies when the user wants to **understand** how the target does what it does, rather than immediately building one.

核心判据：**看完之后，用户自己能讲清这条链路，并且知道哪一部分是自己可以改的。**

Core criterion: **after reading, the user can explain this chain themselves and knows which part they can change.**

这一节**写进规格文档末尾**，不是独立阶段；产出只有文档，没有可运行页面。

This section is **written at the end of the spec document**; it is not a standalone phase. The only deliverable is the document — there is no runnable page.

---

## 1. 与净室轨的分工 · 1. Division of Labor with the Clean-Room Track

| | 学习向 | 净室向 |
|------|-------|-------|
| 目的 | 理解机制，能移植、能改造 | 独立实现同样的能力 |
| 关键内容 | 推理链 + 决定性变量 + 移植指引 | 剥离后的效果描述 + 接口契约 + 自检表 |
| 可以引用目标源码吗 | **可以**（教学用，逐段讲解） | **不可以**（实现者必须隔离） |
| 失败形态 | 只有结论没有推理链；看完还是不懂 | 实现出来与目标逐字相同 |

| | Learning-oriented | Clean-room-oriented |
|------|-------|-------|
| Purpose | Understand the mechanism; be able to port and modify it | Independently implement the same capability |
| Key content | Reasoning chain + decisive variables + porting guide | Stripped-down effect description + interface contract + self-check table |
| May the target source be quoted? | **Yes** (for teaching, explained clause by clause) | **No** (the implementer must be isolated) |
| Failure mode | Conclusions without a reasoning chain; still no understanding after reading | The implementation matches the target word for word |

两者不互斥：主链只按用户意图写对应那一部分。如果用户后来真的要动手做净室实现，再走 `clean-room-design.md` 里的角色隔离与自检全流程。

The two are not mutually exclusive: the main chain writes only the part that matches the user's intent. If the user later really wants to do a clean-room implementation, then run the full role-isolation and self-check process in `clean-room-design.md`.

---

## 2. 这一节的结构 · 2. Structure of This Section

按 入口 → 输入 → 处理 → 输出 讲清主导链路。每一环都要有：**结论 + 证据 + 为什么**。

Explain the dominant chain as entry → input → processing → output. Every link must have: **conclusion + evidence + why**.

推荐骨架（作为规格文档的一章）：

Recommended skeleton (as one chapter of the spec document):

```
X. 当作教科书：把这条链路讲清楚

1. 它到底在做什么（三句话，不用术语）
2. 整体链路（一张表覆盖全程，标注每一层的中间数据结构）
3. 逐环拆解
    (1) 入口 —— 目标藏在哪一层，怎么加载
    (2) 输入 —— 用户的操作如何变成数据
    (3) 处理 —— 核心算法链，数据结构逐层变化
    (4) 输出 —— 怎么画出来 / 怎么导出
4. 关键设计决策（为什么必须这么做）
5. 决定性变量（改哪个参数，整体观感就会变）
6. 我可以改什么（移植与二次开发指引）
7. 未知与未验证项（诚实标注）
```

> **媒介适配**：交付 .docx 时，「整体链路」用 **GFM 表格**呈现（阶段 / 处理 / 中间数据结构）；
> 不要试图做图形化渲染。表格在转换链路里最稳，读者也能扫读。见 `docx-delivery.md`。

> **Medium adaptation**: when delivering .docx, present the "overall chain" as a **GFM table** (stage / processing / intermediate data structure);
> do not attempt graphical rendering. Tables survive the conversion chain most reliably, and readers can scan them. See `docx-delivery.md`.

### 写作纪律 · Writing Discipline

1. **术语双语**：术语首次出现时，先给专业表述，紧接着给一句大白话解释。
   - 好：`globalCompositeOperation` 设为 `multiply`（合成模式是"正片叠底"，就像两层颜料叠上去，暗的地方更暗）。
   - 差：只写 `multiply`，不做解释。
2. **推理链显式化**：不要只写"它用了 X"，要写"因为它要达到 A，而 B 做不到，所以只能是 X"。
3. **每段都有证据**：源码位置（文件:行）或实测数据。**没有证据的段落一律标注"推断"**。
4. **不夸大**：没观测到的东西不写"它一定是……"，直接放进第 7 章。

1. **Bilingual terminology**: the first time a term appears, give the technical formulation first, then immediately follow it with a plain-language explanation.
   - Good: set `globalCompositeOperation` to `multiply` (the blend mode is "multiply", as if two layers of paint were stacked, so dark areas get darker).
   - Bad: just write `multiply` with no explanation.
2. **Make the reasoning chain explicit**: do not just write "it uses X"; write "because it needs to achieve A and B cannot do it, X is the only option".
3. **Every paragraph has evidence**: source location (file:line) or measured data. **Any paragraph without evidence must be labelled "inferred"**.
4. **No overstatement**: do not write "it must be…" about things you have not observed; put them in chapter 7 instead.

---

## 3. 「看得见」的部分怎么承载 · 3. How to Carry the "Visible" Part

### 3.1 用表格承载，不用演示页 · 3.1 Use Tables, Not Demo Pages

机制的结构与视觉呈现靠三样东西：

The structure and visual presentation of the mechanism rest on three things:

| 载体 | 用途 | 注意 |
|--------|------|------|
| **表格** | 链路层级、参数、规格 | 主力。参数列写数值表达式，不写形容词 |
| **源码摘录** | 关键机制的源码证据 | 3–5 行足够；标注 文件:行；不必贴整块 |
| **真实目标截图** | 呈现最终效果与关键中间态 | 探针 `OUT=` 截图。旁证角色，不能替代数据 |

| Carrier | Use | Note |
|--------|------|------|
| **Tables** | Chain layers, parameters, specs | The workhorse. Write numeric expressions in parameter columns, not adjectives |
| **Source excerpts** | Source evidence for key mechanisms | 3–5 lines are enough; label file:line; no need to paste whole blocks |
| **Screenshots of the real target** | Show the final effect and key intermediate states | Probe `OUT=` screenshots. Corroborating role only; they cannot replace data |

> **不要**因为"不好用文字讲"就去做一个可视化页面。想清楚表格需要哪三列，通常自己就写出来了。

> **Do not** build a visualization page just because something "is hard to explain in words". Once you work out which three columns the table needs, you usually find you have already written it.

---

## 4. 收尾三问 · 4. Three Closing Questions

交付时把这三个问题明确交给用户，让他自测是否真的懂了：

Hand these three questions explicitly to the user at delivery, so they can test whether they really understood:

1. **它是怎么做到的？** —— 不看笔记，能不能讲清主导链路？
2. **换个约束还成立吗？** —— 换平台/换尺寸/换输入来源，哪一环最先坏？
3. **我能改什么？** —— 指向"决定性变量"，并说明改了会发生什么。

1. **How does it do it?** — Without looking at notes, can you explain the dominant chain?
2. **Does it still hold under a different constraint?** — Change the platform / the size / the input source: which link breaks first?
3. **What can I change?** — Point to the "decisive variables" and explain what happens if you change them.

---

## 5. 自检清单 · 5. Self-Check List

- [ ] 结论都有证据（源码位置 / 实测数据 / 截图），术语都写了双语。
- [ ] 推理链显式——每个"它用了 X"后面都跟了"为什么只能是它"。
- [ ] 整体链路用一张表覆盖，且标注了中间数据结构。
- [ ] 决定性变量已列出，并说明改它会怎样。
- [ ] 未知项诚实列出，没有假装全都懂了。
- [ ] 三个自测问题写进了交付说明。
- [ ] **全程没有产出任何可运行页面 / demo / 教学沙箱。**

- [ ] Every conclusion has evidence (source location / measured data / screenshot), and every term is given bilingually.
- [ ] The reasoning chain is explicit — every "it uses X" is followed by "why it could only be X".
- [ ] The overall chain is covered by a single table, with intermediate data structures labelled.
- [ ] Decisive variables are listed, with an explanation of what changes if you modify them.
- [ ] Unknowns are listed honestly; nothing pretends to be fully understood.
- [ ] The three self-test questions are written into the delivery notes.
- [ ] **No runnable page / demo / teaching sandbox was produced anywhere in the process.**
