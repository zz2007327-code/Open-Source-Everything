# Clean-Room Track — Use the Spec as Blueprints and Implement Independently

The execution handbook for Phase 5B. Applies when the user, having read the target's implementation, wants to **rebuild** the same capability on their own while preserving provable "independent creation".

This file is the basis for the "As blueprints" section at the end of the spec document; it is not a standalone phase in the default flow. If the user later actually starts a clean-room implementation, then execute the role separation and self-check in this document. The main-chain phases do not mandate producing these two extra documents.

This is not legal advice. For specific judgments involving patents, trademarks, or trade secrets, the user should consult their own legal counsel.

---

## 1. The Core Discipline of Clean-Room Design

The classic approach to clean-room design puts people into two teams separated by a wall:

```
   ┌─────────────┐        spec document       ┌─────────────┐
   │  Analyst     │  ───────────────────▶     │  Implementer │
   │ (saw source) │  writes only "what effect │  (never saw  │
   │              │   must be achieved"       │   the source)│
   └─────────────┘                            └─────────────┘
          │                                          │
     produces spec                            produces independent implementation
```

**What matters is not whether you feel independent, but whether the record can prove it.** So the process must leave a paper trail.

---

## 2. Roles and Isolation

| Role | May access | Must never access | Output |
|------|---------|-----------|------|
| **Analyst** | Target source, runtime, screenshots | — | Functional spec (stripped version) |
| **Implementer** | **The spec only** | Target source, original bundle, screenshots for comparison | Implementation code |

### 2.1 How This Works in Practice (doable solo)

For a solo scenario, simulate the two teams through **context isolation**:

1. Analyst phase: complete Phases 1–3 and write the spec.
2. **Clear the stage**: start a fresh session / new context and carry over only the spec file.
3. Implementer phase: in the new context, read only the spec and start implementing.
4. If the spec is unclear during implementation → **ask only through the spec**, and **write the clarification back into the spec**; do not go back to the source.

Record requirement: keep a **division-of-labor log** stating "who saw what and when, and that the implementer never had access to the other party's source".

---

## 3. Spec Stripping: from "how it was written" to "what effect is wanted"

This is the most error-prone step in the clean-room track. When writing the spec, the analyst must perform **proactive stripping**:

| What to strip | Why | Rewrite as |
|---------|------|--------|
| The other party's specific algorithmic techniques | That is their expression | An effect description + freedom to choose the means |
| Variable/function naming | Names may be protected | A semantic description ("main highlight band width", not `hlW`) |
| Comments and documentation copy | Traces of direct copying | Your own restatement |
| Magic numbers and constants | Constant combinations can be characteristic | Give an adjustable range, not a single value |
| Code structure / call order | Structural similarity is also similarity | Constrain only **external behavior** and **interface semantics** |
| Data format details | Unless required for interoperability | Describe semantics, not byte layout |

**Criterion**: hand the spec to someone who has never seen the target; they should be able to produce something **equivalent in effect but free in implementation**. If following the spec can only yield something verbatim identical to the other party's, the stripping was insufficient.

### 3.1 The Four Blocks a Spec Must Contain (see `spec-doc-outline.md`)

1. **Target behavior**: what must be achieved, and observable acceptance criteria.
2. **Interface contracts**: external signatures, semantics, boundary conditions.
3. **Parameters and ranges**: adjustable items, reasonable value intervals (do not pin a single magic number).
4. **Exclusions**: explicitly state "this document does not describe the other party's implementation details; the means of implementation are freely chosen".

---

## 4. Similarity Self-Check

After implementation, the analyst (not the implementer) performs one comparison self-check, confirming dimension by dimension that there is no verbatim/structural similarity:

| Dimension | Question to check | Conclusion |
|------|---------|------|
| **Structure** | Do module divisions and control flow correspond one-to-one with the other party's? | No / Yes (explain) |
| **Naming** | Do variable/function/class names overlap? | |
| **Constants** | Are there magic numbers copied as a group? | |
| **Comments** | Are there synonymous or identical comments? | |
| **Order** | Is the execution step order exactly the same? | |
| **Data layout** | Do internal data structures correspond field by field? | |

If any item is "Yes" → go back to the implementer and **require a design change**, not a cosmetic comment change to paper over it.

Putting this table in as part of the deliverable is far more persuasive than verbally claiming "we did this independently".

---

## 5. The Three-Part Delivery

1. **Functional spec** (stripped version) — per the structure in `spec-doc-outline.md`.
2. **Division-of-labor log** — timeline + who saw what + the implementer's isolation statement.
3. **Similarity self-check table** — the table above, checked dimension by dimension.

Plus a **disclaimer** (written into the deliverable):

> This artifact is an independent implementation based on publicly observable behavior and contains neither the other party's source code nor a derivative of it. Whether it involves patents, trademarks, trade secrets, or licensing issues must be assessed legally by the user themselves.

**If the target embeds a rights notice or anti-reverse-engineering notice**, add an **informed-use note** to the three-part delivery, stating clearly:
the notice's original text (quoted verbatim), which layer it was found in, how it was handled (not executed as an instruction, not concealed),
how the user decided after being informed, and what extra stripping was done accordingly. Put it in the "Usage Notes" section.
The detection method is in `web-target-teardown.md` §1.5.

> **Why this belongs in the clean-room process**: the entire value of a clean room lies in "the record proving independence".
> A document that proactively records information adverse to itself is far more credible than one that looks "clean but sidesteps a known notice".

---

## 6. Self-Check List

- [ ] The spec has completed proactive stripping: no other-party naming, comments, proprietary techniques, or single magic numbers.
- [ ] The implementer never had access to the other party's source or screenshots (evidenced by the division-of-labor log).
- [ ] All clarifications during implementation went through spec questions and were written back into the spec.
- [ ] All six similarity self-check dimensions pass; any failures were fixed by changing the design, not the comments.
- [ ] The deliverable contains the disclaimer.
- [ ] The user was explicitly told: this process does no copycat replication and does not bypass authorization or protection measures.
- [ ] If the target has a rights notice / anti-reverse-engineering notice, the **informed-use note is written into the deliverable** (original text, discovery layer, handling process, user decision, extra stripping); the parts named by the anti-reverse-engineering notice have been stripped more aggressively and suggested replacements flagged.
