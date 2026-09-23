---
name: inspiration
description: Research visual design and product/UX direction through audited multi-source inspiration. Use when the user wants a moodboard, design-reference board, precedent research, product-pattern research, or implementation guidance grounded in external references.
---

# Inspiration

Inspiration coordinates audited visual and product/UX research. It does not perform specialist research, design the target product, or implement the resulting guidance.

Its job is to obtain an approved research brief, route work through the required specialists and review gates, and return the final approved report.

## Invariants

1. The skill is the coordinator. Specialists never spawn specialists, and children run serially.
2. The specialist definition owns each specialist's semantic contract. Spawn prompts contain only the dynamic paths, evidence, mode, and prior review information required for that transaction.
3. Raw project ideation goes only to the briefing specialist and brief auditor. The brief auditor verifies that transformation before the brief becomes authoritative for downstream research.
4. Use only user-supplied, explicitly authorized, or otherwise authoritative project context allowed by the active harness.
5. The brief, visual research, and product/UX research are separate reviewed transactions. No reviewed artifact is approved until its matching auditor returns PASS.
6. Reviewer findings trigger targeted repair of the current work. Preserve valid accepted material and stable deficiency identity.
7. Allow one targeted worker/auditor repair cycle per reviewed transaction. If the re-audit still returns REPAIR, stop and surface the remaining deficiencies rather than entering reviewer/worker ping-pong.
8. The synthesizer runs only after the brief and both research tracks pass review. It receives approved inputs only and performs no new research.
9. The coordinator does not perform specialist research or specialist-owned bookkeeping. Each specialist owns the tools and mechanics required by its contract.
10. The final output is research guidance for later design or implementation work. Inspiration does not silently turn research into a design mandate.

## Required specialists

Inspiration requires these exact registered specialists:

- `inspiration-brief`
- `inspiration-brief-auditor`
- `inspiration-visual-researcher`
- `inspiration-visual-auditor`
- `inspiration-product-researcher`
- `inspiration-product-auditor`
- `inspiration-synthesizer`

Spawn a fresh child for each required stage and close it after consuming its result. Do not replace a required specialist with a generic child or parent-thread semantic judgment. If a required specialist cannot run, fail that stage closed.

## Brief transaction

Use `.inspiration/work/brief.md` as `BRIEF_PATH` and `.inspiration/work/brief-audit.md` as `AUDIT_PATH`.

1. Resolve `PROJECT_ROOT`, the user's research goal, and the authorized context scope.
2. Spawn `inspiration-brief` in `INITIAL` mode with `PROJECT_ROOT`, `RESEARCH_GOAL`, `AUTHORIZED_CONTEXT`, and `BRIEF_PATH`.
3. If it returns `NEEDS_USER`, ask only its returned questions and rerun the briefing specialist with the answers until it returns `READY`.
4. Spawn `inspiration-brief-auditor` with `PROJECT_ROOT`, `RESEARCH_GOAL`, `AUTHORIZED_CONTEXT`, `BRIEF_PATH`, `AUDIT_PATH`, and any user answers supplied during briefing.
5. Auditor `PASS`: the brief becomes the authoritative semantic input for downstream research.
6. Auditor `REPAIR`: run one fresh briefing-specialist repair with `MODE: REPAIR`, `AUDIT_PATH`, and the prior deficiency ledger. If repair returns `NEEDS_USER`, ask only those questions and rerun the repair with the answers. Then re-audit with the prior deficiency ledger.
7. Auditor `BLOCKED`: surface the external blocker and preserve the current work.
8. Re-audit `REPAIR`: surface the remaining deficiencies and stop.

After brief PASS, do not supplement the approved brief with the original prompt or raw ideation. Only the brief auditor may compare the brief against the authorized source context.

## Visual research transaction

Use `.inspiration/work/visual-research.md` as `PACKET_PATH` and `.inspiration/work/visual-audit.md` as `AUDIT_PATH`.

1. Spawn `inspiration-visual-researcher` in `INITIAL` mode with `PROJECT_ROOT`, `BRIEF_PATH`, and `PACKET_PATH`.
2. `READY`: spawn `inspiration-visual-auditor` with `PROJECT_ROOT`, `BRIEF_PATH`, `PACKET_PATH`, and `AUDIT_PATH`.
3. Auditor `PASS`: the visual track is approved.
4. Auditor `REPAIR`: run one fresh researcher repair with `MODE: REPAIR`, `AUDIT_PATH`, and the relevant repair history, then re-audit with the prior deficiency ledger.
5. Researcher or auditor `BLOCKED`: surface the external blocker and preserve the current work.
6. Re-audit `REPAIR`: surface the remaining deficiencies and stop the track.

## Product / UX research transaction

After visual PASS, use `.inspiration/work/product-research.md` as `PACKET_PATH` and `.inspiration/work/product-audit.md` as `AUDIT_PATH`.

Run the same researcher → auditor → optional single targeted repair pattern with `inspiration-product-researcher` and `inspiration-product-auditor`.

Do not proceed to synthesis without product PASS.

## Synthesis

After both research auditors PASS, spawn `inspiration-synthesizer` with:

- `PROJECT_ROOT`
- `BRIEF_PATH`
- `VISUAL_PACKET_PATH`
- `VISUAL_AUDIT_PATH`
- `PRODUCT_PACKET_PATH`
- `PRODUCT_AUDIT_PATH`
- `REPORT_PATH`

Use `.inspiration/report.md` for `REPORT_PATH` unless the user requested another path.

`COMPLETE`: verify the report exists, then return its path and a concise summary.
`BLOCKED`: surface the synthesizer's blocker.

## Parent-owned mechanics

The parent owns only workflow mechanics: resolving project/goal/context scope; assigning standard brief/packet/audit/report paths; serial child lifecycle; forwarding exact child outputs, verdicts, and prior deficiencies; enforcing the single repair allowance and stage gates; verifying expected output files; and returning the final result.

The parent must not replace Brief, Brief Auditor, Researcher, Auditor, or Synthesizer semantic work with its own substitute.

Do not infer that a stage passed merely because an expected file exists. Approval comes from the corresponding specialist verdict.

## Completion boundary

Inspiration is complete only when the brief auditor and both research auditors have PASS verdicts and the synthesizer returns COMPLETE with the final report.

Do not continue into product design or implementation unless the user separately asks for that work outside the Inspiration workflow.
