# Screenshot Tool

```text
screenshot <url> [flags]
```

Use `screenshot --help` for exact syntax.

## Flags

| Flag | Purpose |
| --- | --- |
| `--output, -o <file|dir>` | Set the output file or existing output directory. Defaults to the current directory. |
| `--width, -w <px>` | Set viewport width. Default `1280`. |
| `--height, -h <px>` | Set viewport height. Default `720`. |
| `--device-scale-factor <n>` | Set screenshot device scale factor. Default `1`. |
| `--fullpage` | Capture the full page. |
| `--fullpage-max-height <px>` | Limit full-page capture height. |
| `--wait <ms>` | Wait after navigation before capture. Default `1000`. |
| `--wait-until <event>` | Set the navigation completion event. Default `domcontentloaded`. |
| `--force-screenshot` | Render the URL as a screenshot. |
| `--force-download` | Download the URL response. |
| `--help` | Show CLI help. |

Supported `--wait-until` values: `load`, `domcontentloaded`, `networkidle0`, and `networkidle2`.

`--force-screenshot` and `--force-download` are mutually exclusive.

## Behavior

By default, the tool inspects the URL response before choosing an action:

- HTML is rendered in Puppeteer and captured as an image.
- Attachment responses and direct non-text, non-HTML media are downloaded.

URLs without a scheme try HTTPS first, then HTTP.

If `--output` names an existing directory, screenshots use `screenshot.png` and downloads use the source filename when available. Otherwise, `--output` is treated as the output file path.

Screenshot format follows a `.jpg`, `.jpeg`, or `.webp` output extension. Other extensions use PNG.

## Browser

HTML capture requires a Chromium-family browser available to Puppeteer.

Set `PUPPETEER_EXECUTABLE_PATH` to select the browser executable explicitly. Direct downloads do not require browser rendering.
