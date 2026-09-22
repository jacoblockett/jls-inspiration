---
name: inspiration
description: Research visual design and product/UX direction through audited multi-source inspiration. Use when the user wants a moodboard, design-reference board, precedent research, product-pattern research, or implementation guidance grounded in external references.
---

# Inspiration

Inspiration is a research coordinator. It does not design or implement the product. It builds an evidence-backed reference set and a durable Markdown report that a later design or implementation agent can use.

The workflow has two independent research tracks:

1. visual/design inspiration
2. product/UX inspiration

Each track has its own researcher and independent auditor. Raw project ideation is filtered through a briefing specialist before either track sees it.

## Core invariants

1. The skill itself is the coordinator. Specialists never spawn specialists.
2. Researchers and auditors receive the filtered research brief, not the raw ideation corpus, unless a later stage explicitly requires a narrow source excerpt to resolve a concrete ambiguity.
3. A fact is research-driving only when it materially changes what makes a reference relevant or transferable. Incidental style preferences do not become search filters merely because they exist.
4. Visual conclusions require visual evidence. Search metadata, DOM/code inspection, marketing copy, or a source's reputation cannot substitute for inspecting the actual captured image or other directly viewable artifact.
5. A source may be relevant while a particular screenshot from that source is not. Every retained visual artifact must itself visibly demonstrate the property claimed for it.
6. Researchers search broadly but select narrowly. Breadth is a discovery strategy, never a category quota.
7. Established working products receive the strongest weight in product/UX conclusions. Emerging, amateur, and experimental work may contribute promising hypotheses but is not treated as validated merely because it is novel.
8. "Product X does this" is not equivalent to "this works." Preserve the evidence level of every product/UX claim.
9. Researchers query durable history globally before revisiting a URL so prior work in either track is visible. Every materially inspected source is logged for the active track, and captured artifact hashes are used to flag duplicate evidence.
10. Auditors independently inspect accepted evidence and may reject, request replacement, or identify research gaps. They do not merely critique prose.
11. Repair loops preserve valid accepted work. Do not restart broad research because one subset failed review.
12. If the same material deficiency makes no progress across three distinct repair strategies, stop as stalled instead of looping indefinitely.
13. The synthesizer receives only the approved brief and reviewer-PASSed research packets. It performs no new research.
14. The final report is research guidance, not a hidden design specification. Preserve uncertainty, alternatives, and explicit "take/leave" boundaries.

## Runtime

Use the Inspiration runtime at:

```text
{{INSPIRATION_CLI}}
```

Initialize durable state at the project root before substantive work:

```text
{{INSPIRATION_CLI}} init --path <PROJECT_ROOT>
```

State lives under `<PROJECT_ROOT>/.inspiration/`. Do not read or modify `research.db` directly. Use the history commands:

```text
{{INSPIRATION_CLI}} history seen <url> [--track visual|product] --path <PROJECT_ROOT>
{{INSPIRATION_CLI}} history touch <url> --track <visual|product> --stage <stage> [--actor researcher|auditor] [--artifact <file>] [--note <text>] --path <PROJECT_ROOT>
{{INSPIRATION_CLI}} history get <url> [--track visual|product] --path <PROJECT_ROOT>
{{INSPIRATION_CLI}} history list [--track visual|product] [--verdict accepted|rejected|pending] --path <PROJECT_ROOT>
{{INSPIRATION_CLI}} history search <text> [--track visual|product] --path <PROJECT_ROOT>
```

Capture evidence with:

```text
{{INSPIRATION_CLI}} capture <url> --output <path> [capture flags]
```

Run `{{INSPIRATION_CLI}} capture --help` for exact flags. The capture command downloads direct non-HTML media and screenshots rendered HTML. Avoid `--force-download` and `--force-screenshot` unless automatic behavior is actually wrong.

A Chromium-family browser must be available for HTML screenshots. The runtime checks Puppeteer's configured browser, common Chrome/Chromium/Edge installations, and `PUPPETEER_EXECUTABLE_PATH`.

## Required specialists

Use these exact registered specialists serially:

- `inspiration-brief`
- `inspiration-visual-researcher`
- `inspiration-visual-auditor`
- `inspiration-product-researcher`
- `inspiration-product-auditor`
- `inspiration-synthesizer`

Do not substitute generic children or parent-thread judgment for a required stage. Close each child after consuming its result.

## Start

1. Resolve `PROJECT_ROOT` and the user's research goal.
2. Initialize `.inspiration` with the runtime CLI.
3. Determine the authorized ideation/context sources. Use only sources the user supplied, explicitly authorized, or that are already authoritative project state under the active harness instructions.
4. Spawn `inspiration-brief` with the research goal, authorized source paths/excerpts, and `.inspiration/work/brief.md` as `BRIEF_PATH`.
5. If it returns `NEEDS_USER`, ask only its targeted questions. Then rerun the specialist with the answers. Do not ask a general design questionnaire.
6. Do not pass the raw ideation corpus to later researchers or auditors. Their context starts from the completed brief.

The briefing specialist decides what is research-driving. For example, a project's natural-world subject matter can legitimately affect imagery/metaphor research; an incidental preference such as "make the theme blue" does not justify searching for blue websites unless color behavior itself is the stated research problem.

## Visual research transaction

Use `.inspiration/work/visual-research.md` for the current visual packet, `.inspiration/work/visual-audit.md` for its audit, and `.inspiration/assets/visual/` for visual evidence.

1. Spawn `inspiration-visual-researcher` in `INITIAL` mode with `PROJECT_ROOT`, `BRIEF_PATH`, `PACKET_PATH`, and the research goal.
2. The researcher must query history before materially investigating a candidate URL.
3. Discovery/browser use may pre-screen candidates, but acceptance requires a captured artifact followed by explicit inspection of that saved artifact through the harness's local image-view capability.
4. If a candidate looked promising but the captured artifact does not visibly support the claimed lesson, reject it and record why.
5. After the researcher returns READY, spawn `inspiration-visual-auditor` with the brief and packet paths. The auditor independently opens every retained visual artifact.
6. On `PASS`, continue to product/UX research.
7. On `REPAIR`, rerun the visual researcher in `REPAIR` mode with the audit path and prior repair history. Preserve accepted material and address only the rejected references/gaps plus direct consequences. Re-audit.
8. On `BLOCKED`, surface only the external capability or missing authority that actually prevents completion.
9. If three materially different repair strategies fail to improve the same deficiency, mark the visual track stalled and stop.

Visual saturation means additional sources are no longer contributing materially new visual directions, interaction-presentation ideas, or design principles. It does not mean every industry/category has been sampled.

## Product/UX research transaction

Use `.inspiration/work/product-research.md`, `.inspiration/work/product-audit.md`, and `.inspiration/assets/product/` for any captured product/interface evidence.

1. Spawn `inspiration-product-researcher` in `INITIAL` mode with the approved brief, paths, and research goal.
2. Weight evidence in this order unless the specific question justifies otherwise:
   - established direct products with demonstrated real-world use
   - established analogous/cross-industry patterns
   - documented emerging products or recent work
   - amateur/experimental concepts as hypotheses
3. Require direct evidence for interface claims. If the lesson depends on what an interface visually presents, capture and inspect the relevant artifact just as in the visual track.
4. Preserve claim class: observed pattern, established convention, evidence-supported finding, or speculative/promising idea.
5. Spawn `inspiration-product-auditor` after READY.
6. On `REPAIR`, rerun only targeted product research with the audit deficiencies and prior repair history, then re-audit.
7. On `PASS`, continue to synthesis. On `BLOCKED`, surface the actual blocker.
8. Apply the same three-no-progress-strategies stall rule.

Product/UX saturation means new sources are no longer adding materially new, well-supported lessons relevant to the brief.

## Visual evidence discipline

The canonical visual evidence is the saved artifact, not the browser session that led to it.

For every retained visual reference:

1. form a specific hypothesis about what may be useful before capture
2. capture/download the candidate
3. open the saved artifact itself
4. verify the claimed property is actually visible in that artifact
5. record accepted/rejected judgment and concise reason in history against the exact artifact with `--artifact <path>`
6. retain accepted evidence in the packet with source URL, artifact path, exact observation, `TAKE`, and `LEAVE`

If no local image-inspection capability exists, visual research is blocked. Do not downgrade silently to metadata-only moodboarding.

Avoid accumulating speculative assets. Discovery can be broad without downloading everything encountered.

## Synthesis

After both auditors PASS:

1. Spawn `inspiration-synthesizer` with `BRIEF_PATH`, both PASSed research packet paths, both audit paths, and `REPORT_PATH` (default `.inspiration/report.md` unless the user requested another path).
2. The synthesizer performs no browsing, capture, or new research.
3. Verify the report exists and references only approved findings/artifacts.
4. Return the report path and a concise summary to the user.

The report should separate:

- research brief
- visual directions and reference board
- product/UX findings
- established patterns versus promising hypotheses
- transferable lessons
- `TAKE` / `LEAVE` boundaries
- cautions and rejected directions worth remembering
- unresolved questions/limitations
- implementation guidance for a future model

Do not collapse the research into a single prescribed design unless the user explicitly asks for a design decision after research is complete.
