# Screenshot

`screenshot` is the independent Puppeteer-based capture/download runtime supplied for Inspiration research.

Its source lives under `runtimes/screenshot/`. Target builds produce `bin/screenshot` or `bin/screenshot.exe`.

## Source provenance

The repository preserves the supplied unbuilt screenshot source files verbatim:

```text
runtimes/screenshot/
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── screenshot.mjs
```

The prebuilt `screenshot.exe` supplied alongside those files is intentionally not committed. Release workflows build target-specific executables from the source.

## Behavior

The runtime accepts a URL and either:

- renders HTML through Puppeteer and saves a screenshot, or
- downloads a direct non-HTML/attachment response.

Automatic behavior can be overridden with `--force-screenshot` or `--force-download`.

Run:

```text
screenshot --help
```

for the runtime's complete flag reference.

## Browser requirement

HTML capture requires a Chromium-family browser available to Puppeteer. `PUPPETEER_EXECUTABLE_PATH` may be used to select the executable explicitly.

Direct file/media downloads do not require HTML rendering.
