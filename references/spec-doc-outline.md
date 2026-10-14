# Functional Spec Document Skeleton

The output skeleton for Phase 3. The goal is to let an engineer **implement it without ever seeing the original site**.

Writing discipline: give numbers as concrete values + adjustable ranges; give interfaces as signatures; make acceptance items checkable; replace every vague adjective with a number.

---

## Recommended Section Structure

```
Cover (optional, depending on the delivery medium)
Abstract / Executive summary
1. Document notes
    (1) Purpose of this document
    (2) The shared underlying chain (the unchanged part)      ← the most important chapter
    (3) Terminology conventions
2 … N. Per-approach specs (one chapter per approach)
    (1) Material/shape definition
    (2) Visual/behavioral feature spec (table)
    (3) Colors and substrate (or corresponding resources)
    (4) Node/boundary decoration
    (5) Motion
    (6) Variants specific to this approach
N+1. Implementation interface contracts
    (1) Change surface list (table: module / changed? / notes)
    (2) Core interface signatures
    (3) Internal execution steps (in order)
    (4) Resource/substrate interfaces
    (5) Motion-advance interfaces
    (6) Composition configuration
N+2. Parameter summary table
N+3. Acceptance points (per-approach checklist + common checklist)
N+4. Risks and open items (including evidence gaps)
N+5. Quick reference of differences from the original implementation (comparison table)
X.  Usage Notes (write one part per the user's intent)
      · As a textbook (learning-oriented, see learning-track.md)
      · As blueprints (clean-room-oriented, see clean-room-design.md)
```

---

## Chapter-by-Chapter Writing Notes

### "The shared underlying chain" — draw the unchanged surface first

**This is the highest-value chapter in the whole document.** Use one table to list every level "from input to output" and mark which ones do not change:

| Stage | Processing | Output |
|------|------|------|
| ① … | Concrete algorithm/call | Intermediate data structure |
| … | | |
| ⑥ Landing | **All the differences are in this step** | Final artifact |

Then converge in one sentence: **"the only change surface is the draw function at step ⑥"**. The smaller the change surface, the more controllable the implementation cost and the more confident the reader.

The anti-pattern: opening with "we will build approaches A, B, and C" leaves the reader unable to judge their shared cost.

### Per-approach specs — let tables hold down the prose

Always use two-column tables (feature / spec) for visual/behavioral features, and write **numeric expressions** in the spec column rather than adjectives:

| Feature | Spec |
|------|------|
| Lateral amplitude | `A = w * 0.34`, where `w` is the nominal width |
| Wrap period | `λ = w * 3.2`, floating between 2.8–3.8× depending on seed |
| Main highlight band width | `w * 0.22`, peak opacity 0.92 |

**All length parameters are relative to the body size `w`**, never absolute pixels — that is the only way to decouple them from font size/scaling.

### Interface contracts — give signatures, not descriptions

```ts
type StrokeRenderer = (
  ctx: CanvasRenderingContext2D,
  path: Point[],
  width: number,
  seed: number,
  opts: { progress: number; color: string; palette: string[] }
) => void;
```

The key information to provide:

1. **Change surface list**: which modules change, which do not, and how (replace / parameterize / extend / reuse).
2. **Interface signatures**: name, inputs, outputs, semantics.
3. **Internal execution steps**: an ordered list, spelling out "what is used, what is layered, in what order" step by step.
   The order itself is often the key (layering highlight before dispersion looks completely different).
4. **Composition configuration**: make the approaches a configuration object array, so switching only changes configuration, not the caller.

### Parameter summary table

Collect the parameters scattered across chapters into one place, three columns: parameter / value / adjustable range.
This is the value handbook for implementation and the comparison table for tuning.

### Acceptance points

Write them as a **checkable numbered checklist**, with criteria at the "distinguishable to the naked eye" level where possible:

- Good: `The stroke is visually distinguishable as two intertwined vines, not a single textured line.`
- Good: `The same character drawn repeatedly with unchanged parameters has identical jitter (the seed is reproducible).`
- Bad: `The effect should look natural.`

Two blocks: a **per-approach checklist** + a **common checklist** (cross-approach constraints, e.g. "switching approaches does not change the underlying structure").

### Risks and open items

A three-column table: item / explanation / recommendation. Write real engineering risks (performance, platform differences, fringing at small sizes); do not write filler like "there may not be enough time".

### Difference quick-reference

Close with a comparison table, dimension × approach. Let the reader locate the row they need at a glance and follow the row name back to the corresponding chapter.

---

## Delivery Medium Adaptation

| Medium | Adaptation notes |
|------|---------|
| **.docx** (via tencent-docx) | Use GFM tables + level-3/4 headings; use fenced code blocks for code; see `docx-delivery.md` for structure |
| **Single-file HTML** (tech talk) | The main chain does **not** produce HTML. If the user explicitly wants an interactive demo, handle it as a separate add-on task; do not mix it into the spec document |
| **Markdown** | Write directly per the structure above; use GFM for tables |

Regardless of medium, **the content structure is identical** — the medium only affects typesetting, not the section skeleton.

---

## Self-Check List

Go through every item before delivery:

1. [ ] Both "the unchanged part" and "the change surface" are explicitly written out, and the change surface is converged to a minimum.
2. [ ] Every number is a concrete value or expression; no "appropriately", "slightly", "about right".
3. [ ] Every approach has a checkable acceptance checklist with criteria at the naked-eye level.
4. [ ] Interfaces have complete signatures; the caller does not have to guess parameter meanings.
5. [ ] Execution steps have an explicit order, and critical order changes are annotated.
6. [ ] All length parameters are relative to the body size, not absolute pixels.
7. [ ] Risk items are engineering risks and have corresponding recommended actions.
8. [ ] There is a closing difference quick-reference table.
