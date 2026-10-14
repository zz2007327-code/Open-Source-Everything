# Learning-Oriented Writing Details

The execution handbook for the "**As a textbook**" section in the main-chain spec document. Applies when the user wants to **understand** how the target does something rather than immediately build one.

Core criterion: **after reading/viewing it, the user can explain this chain themselves and knows which part they can change.**

This section is **written into the end of the spec document**; it is not a standalone phase, and its output is documentation only — no runnable page.

---

## 1. Division of Labor vs. Clean Room

| | Learning-oriented | Clean-room-oriented |
|------|-------|-------|
| Purpose | Understand the mechanism, be able to port it, be able to change it | Independently implement the same capability |
| Key content | Reasoning chain + decisive variables + porting guidance | Stripped effect description + interface contracts + self-check table |
| May it quote the target's source? | **Yes** (for teaching, explained segment by segment) | **No** (the implementer must stay isolated) |
| Failure mode | Conclusions without a reasoning chain; still does not get it after reading | The implementation is verbatim identical to the target's |

The two are not mutually exclusive: the main chain just writes the section matching the user's intent. If the user later actually performs a clean-room implementation, then follow the full role-separation and self-check process in `clean-room-design.md`.

---

## 2. Structure of This Section

Explain the dominant chain as entry → input → processing → output. Every link needs: **conclusion + evidence + why**.

Recommended skeleton (as one chapter of the spec document):

```
X. As a textbook: explain this chain clearly

1. What it actually does (three sentences, no jargon)
2. The overall chain (one table covering the whole process, annotating the intermediate data structure at each level)
3. Link-by-link breakdown
    (1) Entry — which layer the target hides in, how it loads
    (2) Input — how the user's actions become data
    (3) Processing — the core algorithm chain, data structure changes level by level
    (4) Output — how it is drawn / how it is exported
4. Key design decisions (why it must be done this way)
5. Decisive variables (change which parameter and the whole look changes)
6. What I can change (porting and secondary-development guidance)
7. Unknowns and unverified items (honest annotation)
```

> **Medium adaptation**: for .docx, render "the overall chain" as a **GFM table** (stage / processing / intermediate data structure);
> do not attempt graphical rendering. Tables are stable through the conversion chain and readers can scan them. See `docx-delivery.md`.

### Writing Discipline

1. **Bilingual terms**: at a term's first occurrence, give the professional formulation first, immediately followed by a plain-language gloss.
   - Good: `globalCompositeOperation set to multiply` (the composite mode is "multiply", which is like stacking two layers of paint so the dark gets darker).
   - Bad: dropping `multiply` with no explanation.
2. **Make the reasoning chain explicit**: do not just write "it uses X"; write "because it needs to achieve A, and B cannot, it can only be X".
3. **Evidence for every passage**: a source location (file:line) or measured data. **Mark any passage lacking evidence as "inferred"**.
4. **No exaggeration**: do not write "it must be …" for things not observed; send them straight to chapter 7.

---

## 3. How to Carry the "Visible" Part

### 3.1 Carry it with tables, not with a demo page

The mechanism's structure and visual presentation rest on three things:

| Carrier | Purpose | Note |
|--------|------|------|
| **Tables** | Chain levels, parameters, specs | The workhorse. Write numeric expressions in the parameter column, not adjectives |
| **Source excerpts** | Source evidence for key mechanisms | 3–5 lines suffice; annotate file:line; no need to paste whole blocks |
| **Real target screenshots** | Present the final effect and key intermediate states | Probe `OUT=` screenshots. A corroborating role; they do not replace data |

> **Do not** build a visualization page just because something is "hard to explain". Think through which three columns the table needs and it usually writes itself.

---

## 4. The Closing Three Questions

At delivery, put these three questions explicitly to the user so they can self-test whether they truly understood:

1. **How does it do it?** — Without looking at notes, can they explain the dominant chain?
2. **Does it still hold under a different constraint?** — Change platform/size/input source; which link breaks first?
3. **What can I change?** — Point to the "decisive variable" and explain what changing it does.

---

## 5. Self-Check List

- [ ] Conclusions all have evidence (source location / measured data / screenshot), and terms are written bilingually.
- [ ] The reasoning chain is explicit — every "it uses X" is followed by "why it can only be this".
- [ ] The overall chain is covered by a single table with intermediate data structures annotated.
- [ ] Decisive variables are listed, with an explanation of what changing them does.
- [ ] Unknowns are listed honestly; no pretense of understanding everything.
- [ ] The three self-test questions are written into the delivery notes.
- [ ] **No runnable page / demo / teaching sandbox was produced at any point.**
