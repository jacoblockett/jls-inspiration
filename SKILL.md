---
name: inspiration
description: Research visual design and product/UX direction through audited multi-source inspiration. Use when the user wants a moodboard, design-reference board, precedent research, product-pattern research, or implementation guidance grounded in external references.
---

# Inspiration

Inspiration coordinates audited visual and product/UX research. It does not perform the specialist research itself, design the target product, or implement the resulting guidance.

Its job is to establish the research brief, run the required specialists, enforce review gates, preserve durable research state, and return the final approved report.

## Invariants

1. The skill is the coordinator. Specialists never spawn specialists, and required specialists run serially.
2. The specialist definition owns each specialist's semantic contract. Spawn prompts contain only dynamic paths, evidence, mode, and review deficiencies required for that transaction.
3. Raw project ideation goes to the briefing specialist, not directly to downstream researchers or auditors. Downstream work is governed by the approved brief.
4. Use only user-supplied, explicitly authorized, or otherwise authoritative project context allowed by the active harness.
5. Visual and product/UX research are separate transactions. Neither packet is approved until its matching auditor returns PASS.
6. Reviewer findings are instructions to repair the current work, not reasons to restart valid research. Preserve accepted material and stable deficiency identity wherever possible.
7. Do not weaken review criteria to end a repair loop. Surface a genuine external blocker when required authority, evidence, tooling, or inspection capability is unavailable.
8. The synthesizer runs only after both research tracks pass review. It receives approved inputs only and performs no new research.
9. Durable research history is managed through `history`. Never read or modify `.inspiration/research.db` directly.
10. The final output is research guidance for later design or implementation work. Inspiration itself does not make the product or silently convert research into a design mandate.

## Required specialists

Use these exact registered specialists:

- `inspiration-brief`
- `inspiration-visual-researcher`
- `inspiration-visual-auditor`
- `inspiration-product-researcher`
- `inspiration-product-auditor`
- `inspiration-synthesizer`

Do not replace a required specialist with a generic child or parent-thread semantic judgment. Close each child after consuming its result.

## Tools

Use `history` for durable research history and `screenshot` for visual capture/downloads.

Initialize project state before substantive work:

```text
history init --path <PROJECT_ROOT>
```

Use `history --help` and `screenshot --help` for exact current syntax rather than relying on memorized flags.

Inspiration state lives under `<PROJECT_ROOT>/.inspiration/`.

## Start

1. Resolve `PROJECT_ROOT`, the user's research goal, and the authorized context scope.
2. Initialize Inspiration state with `history init --path <PROJECT_ROOT>`.
3. Spawn `inspiration-brief` with `PROJECT_ROOT`, `RESEARCH_GOAL`, `AUTHORIZED_CONTEXT`, and `.inspiration/work/brief.md` as `BRIEF_PATH`.
4. If the specialist returns `NEEDS_USER`, ask only its returned questions and rerun it with the answers.
5. Continue only after the brief returns `READY`.

The completed brief is the semantic input for later research stages. Do not supplement it with the original prompt or raw ideation unless a specialist explicitly requires one narrow authorized excerpt to resolve a named ambiguity.

## Visual research

Use:

- packet: `.inspiration/work/visual-research.md`
- audit: `.inspiration/work/visual-audit.md`
- assets: `.inspiration/assets/visual/`

Spawn `inspiration-visual-researcher` in `INITIAL` mode with the project, brief, and packet paths.

When it returns `READY`, spawn `inspiration-visual-auditor` with the project, brief, packet, and audit paths.

- `PASS`: visual research is approved.
- `REPAIR`: rerun the visual researcher in `REPAIR` mode with the audit path and relevant repair history, then audit the revised packet again.
- `BLOCKED`: surface the external blocker and preserve the current work.

Continue targeted repair and review until PASS or a genuine external blocker prevents further progress.

## Product / UX research

Use:

- packet: `.inspiration/work/product-research.md`
- audit: `.inspiration/work/product-audit.md`
- assets: `.inspiration/assets/product/`

After visual PASS, spawn `inspiration-product-researcher` in `INITIAL` mode with the project, brief, and packet paths.

When it returns `READY`, spawn `inspiration-product-auditor` with the project, brief, packet, and audit paths.

Handle `PASS`, `REPAIR`, and `BLOCKED` the same way as the visual transaction. Repairs remain targeted to the auditor's deficiencies and preserve valid prior work.

## Synthesis

After both auditors PASS, spawn `inspiration-synthesizer` with:

- `PROJECT_ROOT`
- `BRIEF_PATH`
- `VISUAL_PACKET_PATH`
- `VISUAL_AUDIT_PATH`
- `PRODUCT_PACKET_PATH`
- `PRODUCT_AUDIT_PATH`
- `REPORT_PATH`

Use `.inspiration/report.md` for `REPORT_PATH` unless the user requested another path.

Verify that the synthesizer returns `COMPLETE` and that the report exists. Return the report path and a concise summary to the user.

## Completion boundary

Inspiration is complete only when both research tracks have auditor PASS verdicts and the synthesizer has produced the final report.

Do not continue into product design or implementation unless the user separately asks for that work outside the Inspiration workflow.
