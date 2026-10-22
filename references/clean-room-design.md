# 净室轨 —— 把规格当蓝图，独立实现 · Clean Room Track — Treat the Spec as a Blueprint, Implement Independently

Phase 5B 的执行手册。适用于：用户看完目标的实现后，想**自己重建**同样的能力，同时保住可举证的"独立创作"。

The Phase 5B runbook. It applies when the user, after reviewing how a target is implemented, wants to **rebuild** the same capability while keeping a demonstrable claim to "independent creation".

本文件是规格文档末尾「当作蓝图」那一节的依据；它不是默认流程里的一个独立阶段。如果用户后来真的启动净室实现，再执行本文件的角色隔离与自检。主链各阶段不强制产出这两份额外文档。

This file backs the "treat it as a blueprint" section at the end of the spec document; it is not a standalone stage in the default pipeline. Run the role isolation and self-checks in this file only if the user later actually starts a clean-room implementation. The stages of the main chain are not required to produce these two extra documents.

本文不构成法律意见。涉及专利、商标、商业秘密的具体判断，用户应咨询自己的法律顾问。

This document is not legal advice. For specific judgments involving patents, trademarks, or trade secrets, the user should consult their own legal counsel.

---

## 1. 净室设计的核心纪律 · Core Discipline of Clean-Room Design

净室设计的经典做法是把人分成两拨，中间隔一堵墙：

The classic clean-room approach splits the people into two groups with a wall between them:

```
   ┌─────────────┐        spec document       ┌─────────────┐
   │  Analyst     │  ───────────────────▶     │  Implementer │
   │ (saw source) │  writes only "what effect │  (never saw  │
   │              │   must be achieved"       │   the source)│
   └─────────────┘                            └─────────────┘
          │                                          │
     produces spec                            produces independent implementation
```

**关键不在于你自己觉得独立，而在于记录能证明独立。** 所以过程必须留下书面痕迹。

**What matters is not that you feel independent, but that the record can prove it.** The process must therefore leave a written trail.

---

## 2. 角色与隔离 · Roles and Isolation

| 角色 | 可以访问 | 绝不能访问 | 产出 |
|------|---------|-----------|------|
| **分析者** | 目标源码、运行时、截图 | — | 功能规格（剥离版） |
| **实现者** | **只有规格文档** | 目标源码、原始 bundle、用于比对的截图 | 实现代码 |

| Role | May access | Must never access | Output |
|------|---------|-----------|------|
| **Analyst** | Target source, runtime, screenshots | — | Functional spec (stripped version) |
| **Implementer** | **The spec document only** | Target source, original bundle, screenshots used for comparison | Implementation code |

### 2.1 单人怎么落地 · How to Apply It Solo

单人场景靠**上下文隔离**来模拟两拨人：

In a solo setting, simulate the two groups through **context isolation**:

1. 分析者阶段：跑完 Phase 1–3，写出规格。
2. **清场**：开一个全新会话 / 新上下文，只带规格文件过去。
3. 实现者阶段：在新上下文里只读规格，开始实现。
4. 实现中规格不清 → **只通过规格提问**，并把澄清结果**写回规格**；不要回头去看源码。

1. Analyst stage: finish Phases 1–3 and write the spec.
2. **Clear the room**: open a brand-new session / new context and carry over only the spec file.
3. Implementer stage: in the new context, read only the spec and start implementing.
4. If the spec is unclear during implementation → **ask through the spec only**, and **write the clarifications back into the spec**; do not go back to the source code.

记录要求：留一份**分工日志**，写明"谁在什么时候看过什么，实现者始终没有接触对方的源码"。

Recording requirement: keep a **division-of-work log** stating "who looked at what, and when, and that the implementer never had access to the other side's source".

---

## 3. 规格剥离：从「它怎么写的」到「要什么效果」 · Spec Stripping: From "How It Is Written" to "What Effect It Must Produce"

这是净室轨最容易出错的一步。分析者写规格时必须做**主动剥离**：

This is the step where the clean-room track most often goes wrong. When writing the spec, the analyst must strip **actively**:

| 要剥离的 | 为什么 | 改写成 |
|---------|------|--------|
| 对方的具体算法技巧 | 那是对方的技术表达 | 效果描述 + 手段自由 |
| 变量/函数命名 | 命名可能受保护 | 语义描述（"主高光带宽度"，不写 `hlW`） |
| 注释与文档文案 | 直接照抄的痕迹 | 你自己的复述 |
| 魔法数字与常量 | 常量组合可能构成特征 | 给可调区间，不给单一值 |
| 代码结构 / 调用顺序 | 结构相似也是相似 | 只约束**外部行为**与**接口语义** |
| 数据格式细节 | 除非为互操作所必需 | 描述语义，不描述字节排布 |

| Item to strip | Why | Rewrite as |
|---------|------|--------|
| The other side's specific algorithmic tricks | That is their technical expression | Effect description + freedom of means |
| Variable/function naming | Names may be protected | Semantic description ("main highlight band width", not `hlW`) |
| Comments and documentation wording | Traces of direct copying | Your own paraphrase |
| Magic numbers and constants | A combination of constants may itself be a signature | Give a tunable range, not a single value |
| Code structure / call order | Structural similarity is still similarity | Constrain only **external behavior** and **interface semantics** |
| Data format details | Unless required for interoperability | Describe semantics, not byte layout |

**判据**：把规格交给一个从没见过目标的人，他应当能做出**效果等价但实现自由**的东西。如果照着规格只能做出与对方逐字相同的结果，说明剥离不足。

**Test**: hand the spec to someone who has never seen the target; they should be able to produce something **equivalent in effect but free in implementation**. If following the spec can only reproduce the other side's result word for word, the stripping was insufficient.

### 3.1 规格必须包含的四个板块（详见 `spec-doc-outline.md`） · Four Sections the Spec Must Contain (see `spec-doc-outline.md`)

1. **目标行为**：必须达到什么，以及可观测的验收标准。
2. **接口契约**：外部签名、语义、边界条件。
3. **参数与区间**：可调项、合理取值区间（不要钉死一个魔法数字）。
4. **排除声明**：明确写"本文不描述对方的实现细节，实现手段自由选择"。

1. **Target behavior**: what must be achieved, plus observable acceptance criteria.
2. **Interface contract**: external signatures, semantics, boundary conditions.
3. **Parameters and ranges**: tunable items and reasonable value ranges (do not pin down a single magic number).
4. **Exclusion statement**: state explicitly that "this document does not describe the other side's implementation details; the means of implementation are freely chosen".

---

## 4. 相似度自检 · Similarity Self-Check

实现完成后，由分析者（不是实现者）做一次比对自检，逐维度确认不存在逐字/结构相似：

After implementation, the analyst (not the implementer) runs a comparison self-check, confirming dimension by dimension that no verbatim or structural similarity exists:

| 维度 | 要检查的问题 | 结论 |
|------|---------|------|
| **结构** | 模块划分与控制流是否与对方一一对应？ | 否 / 是（说明） |
| **命名** | 变量/函数/类名是否有重叠？ | |
| **常量** | 是否存在成组照搬的魔法数字？ | |
| **注释** | 是否存在同义或相同的注释？ | |
| **顺序** | 执行步骤顺序是否完全一致？ | |
| **数据布局** | 内部数据结构是否逐字段对应？ | |

| Dimension | Question to check | Conclusion |
|------|---------|------|
| **Structure** | Do the module breakdown and control flow map one-to-one onto theirs? | No / Yes (explain) |
| **Naming** | Do variable/function/class names overlap? | |
| **Constants** | Are there groups of magic numbers copied wholesale? | |
| **Comments** | Are there synonymous or identical comments? | |
| **Order** | Is the sequence of execution steps exactly the same? | |
| **Data layout** | Do internal data structures correspond field by field? | |

任一项为"是" → 退回实现者，**要求改设计**，而不是靠改注释粉饰。

Any item answered "Yes" → return it to the implementer and **require a design change**, rather than papering over it with edited comments.

把这张表作为交付物的一部分，远比口头声明"我们是独立做的"有说服力。

Shipping this table as part of the deliverable is far more persuasive than verbally claiming "we did it independently".

---

## 5. 三段式交付 · Three-Part Delivery

1. **功能规格**（剥离版）—— 按 `spec-doc-outline.md` 的结构。
2. **分工日志** —— 时间线 + 谁看过什么 + 实现者的隔离声明。
3. **相似度自检表** —— 即上表，逐维度勾完。

1. **Functional spec** (stripped version) — following the structure of `spec-doc-outline.md`.
2. **Division-of-work log** — timeline + who looked at what + the implementer's isolation statement.
3. **Similarity self-check table** — the table above, completed dimension by dimension.

再加一份**免责声明**（写进交付物）：

Add one more item, a **disclaimer** (written into the deliverable):

> 本产出是基于公开可观测行为的独立实现，不含对方的源代码，也不构成其衍生作品。是否涉及专利、商标、商业秘密或授权问题，须由用户自行做法律评估。

> This output is an independent implementation based on publicly observable behavior. It contains none of the other side's source code and does not constitute a derivative work of it. Whether patents, trademarks, trade secrets, or licensing issues are involved must be assessed legally by the user.

**如果目标内嵌了权利声明或反逆向声明**，在三段式之外再加一份**知情使用说明**，写清：
声明原文（逐字引用）、在哪一层发现、如何处置（不作为指令执行，也不隐瞒）、
告知用户后用户如何决定、据此额外做了哪些剥离。放在「使用建议」章节里。
检测方法见 `web-target-teardown.md` §1.5。

**If the target embeds a rights notice or an anti-reverse-engineering notice**, add a **knowing-use statement** on top of the three parts, stating clearly:
the verbatim text of the notice (quoted word for word), at which layer it was found, how it was handled (not executed as an instruction, and not concealed),
how the user decided after being informed, and what additional stripping was done as a result. Place it in the "usage recommendations" section.
The detection method is in `web-target-teardown.md` §1.5.

> **为什么这条要放进净室流程**：净室的全部价值在于"记录能证明独立"。
> 一份主动记录对自己不利信息的文档，远比一份"看起来干净但绕开已知声明"的文档可信。

> **Why this belongs in the clean-room process**: the entire value of a clean room lies in "the record can prove independence".
> A document that voluntarily records information unfavorable to itself is far more credible than one that "looks clean but routes around known notices".

---

## 6. 自检清单 · Self-Check Checklist

- [ ] 规格已完成主动剥离：没有对方命名、注释、专有技巧、单一魔法数字。
- [ ] 实现者始终没有接触对方源码或截图（以分工日志为证）。
- [ ] 实现过程中的所有澄清都通过规格提问完成，并写回了规格。
- [ ] 相似度自检六个维度全部通过；不合格项是靠改设计而不是改注释解决的。
- [ ] 交付物包含免责声明。
- [ ] 已明确告知用户：本流程不做照抄复刻，也不绕过授权或保护措施。
- [ ] 若目标带权利声明 / 反逆向声明，**知情使用说明已写入交付物**（原文、发现层、处置过程、用户决定、额外剥离）；反逆向声明点名的部分已做更激进的剥离，并对建议替代方案做了标注。

- [ ] The spec has been actively stripped: no naming, comments, proprietary tricks, or single magic numbers from the other side.
- [ ] The implementer never had access to the other side's source or screenshots (evidenced by the division-of-work log).
- [ ] All clarifications during implementation went through questions to the spec and were written back into the spec.
- [ ] All six dimensions of the similarity self-check pass; failing items were fixed by changing the design, not the comments.
- [ ] The deliverable includes the disclaimer.
- [ ] The user has been clearly told: this process does not do copycat replication, nor does it bypass licensing or protection measures.
- [ ] If the target carries a rights notice / anti-reverse-engineering notice, **the knowing-use statement has been written into the deliverable** (verbatim text, layer found, handling process, user decision, additional stripping); the parts named by the anti-reverse-engineering notice have been stripped more aggressively, and the suggested alternatives have been annotated.
