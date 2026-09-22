#!/usr/bin/env bun

import { mkdir, mkdtemp, rm, rmdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const { default: puppeteer } = await import("puppeteer");

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const WAIT_UNTIL = ["load", "domcontentloaded", "networkidle0", "networkidle2"];

export function captureHelp(command = "screenshot") {
  const flags = [
    [`--device-scale-factor <n>`, "Screenshot device scale factor (default: 1)"],
    [`--force-download`, "Download the URL response"],
    [`--force-screenshot`, "Render the URL as a screenshot"],
    [`--fullpage`, "Capture the entire page"],
    [`--fullpage-max-height <px>`, "Limit a full-page screenshot height"],
    [`--height, -h <px>`, `Screenshot viewport height (default: ${DEFAULT_HEIGHT})`],
    [`--help`, "Show this help"],
    [`--output, -o <file|dir>`, "Output path or directory (default: current directory)"],
    [`--wait <ms>`, "Extra wait after navigation (default: 1000)"],
    [`--wait-until <event>`, "Navigation completion event (default: domcontentloaded)"],
    [`--width, -w <px>`, `Screenshot viewport width (default: ${DEFAULT_WIDTH})`],
  ];
  const column = Math.max(...flags.map(([flag]) => flag.length)) + 2;
  return [
    "Usage:",
    `  ${command} <url> [flags]`,
    "",
    "Flags:",
    ...flags.map(([flag, description]) => `  ${flag.padEnd(column)}${description}`),
  ].join("\n");
}

export function parseCaptureArgs(argv) {
  const args = { url: undefined };
  const aliases = { h: "height", o: "output", w: "width" };
  const booleans = new Set(["force_download", "force_screenshot", "fullpage", "help"]);

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("-")) {
      if (args.url) throw new Error(`Unexpected argument: ${token}`);
      args.url = token;
      continue;
    }

    const key = aliases[token.slice(1)] ?? token.replace(/^-+/, "").replaceAll("-", "_");
    if (booleans.has(key)) {
      args[key] = true;
      continue;
    }

    const value = argv[++i];
    if (!value || value.startsWith("-")) throw new Error(`Missing value for ${token}`);
    args[key] = value;
  }
  return args;
}

function positiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} must be positive`);
  return number;
}

function nonNegativeNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name} must be non-negative`);
  return number;
}

function screenshotType(output) {
  const extension = path.extname(output).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "jpeg";
  if (extension === ".webp") return "webp";
  return "png";
}

function systemBrowserCandidates() {
  const candidates = [];
  if (process.platform === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean);
    for (const root of roots) {
      candidates.push(
        path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
        path.join(root, "Chromium", "Application", "chrome.exe"),
      );
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      path.join(homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
    );
  } else {
    for (const command of [
      "google-chrome",
      "google-chrome-stable",
      "chromium",
      "chromium-browser",
      "microsoft-edge",
      "microsoft-edge-stable",
    ]) {
      const resolved = globalThis.Bun?.which?.(command);
      if (resolved) candidates.push(resolved);
    }
  }
  return candidates;
}

export function browserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (!existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      throw new Error(`PUPPETEER_EXECUTABLE_PATH does not exist: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    }
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  for (const channel of ["chrome", undefined]) {
    try {
      const candidate = channel ? puppeteer.executablePath(channel) : puppeteer.executablePath();
      if (candidate && existsSync(candidate)) return candidate;
    } catch {}
  }

  for (const candidate of systemBrowserCandidates()) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  throw new Error(
    "No Chromium-family browser was found. Install Chrome/Chromium/Edge or set PUPPETEER_EXECUTABLE_PATH.",
  );
}

export async function inspectUrl(url) {
  const value = url.trim();
  const candidates = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
    ? [value]
    : [`https://${value}`, `http://${value}`];

  for (const candidate of candidates) {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL must use http or https");

    let response;
    try {
      response = await fetch(parsed.href, { method: "HEAD", redirect: "follow" });
    } catch {}

    if (!response || response.status === 405 || !response.headers.get("content-type")) {
      try {
        response = await fetch(parsed.href, {
          headers: { Range: "bytes=0-0" },
          redirect: "follow",
        });
        await response.body?.cancel();
      } catch {
        response = undefined;
      }
    }
    if (!response) continue;

    const resolvedUrl = response.url || parsed.href;
    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
    const disposition = response.headers.get("content-disposition")?.toLowerCase() ?? "";
    const isHtml = contentType === "text/html" || contentType === "application/xhtml+xml";
    const downloadable = disposition.includes("attachment") || Boolean(contentType && !isHtml && !contentType.startsWith("text/"));
    return { downloadable, contentType, url: resolvedUrl };
  }

  throw new Error(`Unable to reach ${value}`);
}

function defaultDownloadName(url) {
  const filename = path.basename(new URL(url).pathname);
  return filename && filename !== "." ? filename : "download";
}

function resolveOutput(destination, url, downloadable) {
  const location = path.resolve(destination ?? process.cwd());
  const isDirectory = !destination || (existsSync(location) && statSync(location).isDirectory());
  if (!isDirectory) return location;
  return path.join(location, downloadable ? defaultDownloadName(url) : "screenshot.png");
}

async function download(url, output) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  if (globalThis.Bun) await Bun.write(output, response);
  else await writeFile(output, Buffer.from(await response.arrayBuffer()));
}

async function screenshot(url, output, args) {
  const width = Math.round(positiveNumber(args.width ?? DEFAULT_WIDTH, "--width"));
  const height = Math.round(positiveNumber(args.height ?? DEFAULT_HEIGHT, "--height"));
  const deviceScaleFactor = positiveNumber(args.device_scale_factor ?? 1, "--device-scale-factor");
  const wait = nonNegativeNumber(args.wait ?? 1000, "--wait");
  const waitUntil = args.wait_until ?? "domcontentloaded";
  const maxHeight = args.fullpage_max_height === undefined
    ? undefined
    : Math.round(positiveNumber(args.fullpage_max_height, "--fullpage-max-height"));
  if (!WAIT_UNTIL.includes(waitUntil)) throw new Error(`--wait-until must be one of: ${WAIT_UNTIL.join(", ")}`);

  const executablePath = browserExecutable();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "jls-inspiration-screenshot-"));
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      userDataDir,
      ignoreHTTPSErrors: true,
      args: ["--disable-dev-shm-usage", "--disable-gpu", "--no-sandbox", "--ignore-certificate-errors"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor });
    await page.goto(url, { waitUntil, timeout: 30_000 });
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));

    const options = { path: output, type: screenshotType(output), fullPage: Boolean(args.fullpage) };
    if (args.fullpage && maxHeight !== undefined) {
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      options.fullPage = false;
      options.clip = {
        x: 0,
        y: 0,
        width: Math.max(width, size.width),
        height: Math.min(size.height, maxHeight),
      };
    }
    await page.screenshot(options);
  } finally {
    if (browser) await browser.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
}

export async function capture(argv, command = "screenshot") {
  const args = parseCaptureArgs(argv);
  if (args.help) return { help: captureHelp(command) };
  if (!args.url) throw new Error(`Usage: ${command} <url> [flags]`);
  if (args.force_download && args.force_screenshot) throw new Error("--force-download and --force-screenshot are mutually exclusive");

  const inspection = await inspectUrl(args.url);
  const shouldDownload = args.force_download || (!args.force_screenshot && inspection.downloadable);
  const output = resolveOutput(args.output, inspection.url, shouldDownload);
  await rmdir(path.join(path.dirname(output), ".screenshot-profiles")).catch(() => {});
  await mkdir(path.dirname(output), { recursive: true });

  if (shouldDownload) await download(inspection.url, output);
  else await screenshot(inspection.url, output, args);
  return { output, mode: shouldDownload ? "download" : "screenshot", url: inspection.url, contentType: inspection.contentType ?? null };
}

export async function captureMain(argv = process.argv.slice(2), command = "screenshot") {
  const result = await capture(argv, command);
  if (result.help) console.log(result.help);
  else console.log(JSON.stringify(result));
}

if (import.meta.main) {
  captureMain().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
