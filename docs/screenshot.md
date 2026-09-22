# Screenshot Tool

`screenshot` captures visual evidence from URLs for Inspiration research.

Source: `screenshot/screenshot.mjs`  
Release executable: `bin/screenshot` or `bin/screenshot.exe`

## Usage

```text
screenshot <url> [flags]
```

Run `screenshot --help` for the complete flag reference.

## Behavior

By default, the tool inspects the URL response and chooses one of two actions:

- HTML content is rendered in Puppeteer and saved as a screenshot.
- Direct non-HTML or attachment responses are downloaded as files.

Use `--force-screenshot` or `--force-download` only when the automatic choice is wrong. They are mutually exclusive.

## Output

Use `--output` or `-o` to select a file or directory.

If the output is a directory:

- screenshots default to `screenshot.png`
- downloads use the source filename when one is available

Screenshot format follows the output extension for JPEG and WebP. Other extensions default to PNG.

## Screenshot options

```text
--width, -w <px>
--height, -h <px>
--device-scale-factor <n>
--fullpage
--fullpage-max-height <px>
--wait <ms>
--wait-until <event>
```

Default viewport: `1280x720`  
Default device scale factor: `1`  
Default extra wait: `1000 ms`  
Default navigation event: `domcontentloaded`

Supported `--wait-until` values:

```text
load
domcontentloaded
networkidle0
networkidle2
```

## Browser requirement

HTML capture requires a Chromium-family browser available to Puppeteer.

Set `PUPPETEER_EXECUTABLE_PATH` to choose the browser executable explicitly. Otherwise, Puppeteer's executable resolution is used.

Direct downloads do not require browser rendering.
