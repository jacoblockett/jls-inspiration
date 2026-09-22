## Inspiration

Use `$inspiration` when the user asks for a moodboard, design-reference/precedent research, visual direction research, product/UX pattern research, or a durable inspiration report grounded in external references.

Inspiration is a coordinator, not a design/implementation agent. It filters raw project context through `inspiration-brief`, then runs separate visual and product/UX research tracks with independent auditors before synthesis.

Visual claims require inspection of saved visual evidence. Browser/search metadata, DOM/code inspection, and prose descriptions are not substitutes for opening the captured artifact itself.

Inspiration state lives under `.inspiration/`. Do not edit `.inspiration/research.db` directly. Use the runtime CLI at `{{INSPIRATION_CLI}}` for initialization, capture, and history operations.

The required specialists are `inspiration-brief`, `inspiration-visual-researcher`, `inspiration-visual-auditor`, `inspiration-product-researcher`, `inspiration-product-auditor`, and `inspiration-synthesizer`. Invoke those exact specialists at the stages required by the skill. Do not substitute generic children or parent-thread judgment.
