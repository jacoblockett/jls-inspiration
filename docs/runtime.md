# Runtime

Inspiration installs a small coordinator runtime plus the screenshot/media-capture tool used by research agents.

The installed `inspiration` CLI provides:

```text
inspiration init [--path <project>]
inspiration history <command> ...
inspiration capture <url> [screenshot flags]
```

`capture` delegates to the bundled screenshot executable. The screenshot tool is built from the uncompiled source under `tools/`; compiled binaries are release artifacts and are not committed to the repository.

Research state lives under the selected project's `.inspiration/` directory. The SQLite database is an implementation detail and should be accessed through `inspiration history`, not edited directly.

## Browser requirement

HTML screenshots require a Chromium-family browser available to Puppeteer. The screenshot tool honors `PUPPETEER_EXECUTABLE_PATH` and otherwise uses Puppeteer's browser resolution. Direct image/video/media URLs can be downloaded without rendering HTML.

## Standalone installation

JLS installation is recommended. To install a target release package manually:

1. Copy the packaged `inspiration` executable and `screenshot` executable into the same stable directory. Keep the platform's `.exe` suffix on Windows.
2. Install `SKILL.md` and the appropriate `agents/codex` or `agents/claude` specialist files for the harness.
3. Replace `{{INSPIRATION_CLI}}` in installed skill, agent, and instruction files with the absolute path to the `inspiration` executable.
4. Ensure a compatible Chromium-family browser is available when HTML capture is required.

The release package also includes `AGENTS.md`, `manifest.json`, and the MIT license.
