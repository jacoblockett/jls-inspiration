# Inspiration

Inspiration researches visual design and product/UX direction through multi-source references, independent auditing, and a final durable research report. It separates moodboard/design-reference work from product/UX research so visual taste does not become evidence of functional effectiveness and product convention does not silently dictate visual direction.

The workflow filters project context into a narrow research brief, runs independent visual and product research loops, verifies saved visual evidence directly, tracks visited sources in local SQLite state, and synthesizes only reviewer-approved findings.

Inspiration supports OpenAI Codex and Claude Code.

## Install

The recommended way to install Inspiration is with [JLS](https://github.com/jacoblockett/jls), which manages installation, updates, runtime placement, and removal.

Standalone target packages are available from [Releases](https://github.com/jacoblockett/jls-inspiration/releases).

## Runtime

The installed `inspiration` runtime provides two small research utilities:

- `inspiration capture`: screenshots rendered HTML or downloads direct image/video/media URLs.
- `inspiration history`: maintains the queryable `.inspiration/research.db` history used to avoid duplicate research and retain independent researcher/auditor judgments.

HTML capture requires a Chromium-family browser. The runtime uses Puppeteer's configured browser when available, then common Chrome/Chromium/Edge installations. `PUPPETEER_EXECUTABLE_PATH` can explicitly select another compatible browser.

Research state is stored under the project's `.inspiration/` directory. The SQLite database is an implementation detail and should be accessed through the runtime CLI rather than edited directly.

## Standalone installation

A release package contains the skill files, harness specialists, and the runtime executable for one platform target. If installing without JLS:

1. place the target runtime executable somewhere stable and executable;
2. install `SKILL.md` and the appropriate `agents/codex` or `agents/claude` specialist files according to your harness;
3. replace `{{INSPIRATION_CLI}}` in installed skill/agent/instruction files with the absolute runtime path;
4. ensure Chrome, Chromium, Edge, or another Puppeteer-compatible browser is installed, or set `PUPPETEER_EXECUTABLE_PATH`.

The runtime source lives under `tools/`. It is built from Bun/Puppeteer source during release automation; compiled binaries are not committed to the repository.

## License

This project is licensed under the [MIT License](LICENSE). Copyright © 2026 Jacob Lockett.
