#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { historyMain, initialize } from "./history.mjs";

function help() {
  return [
    "Usage:",
    "  inspiration init [--path <project>]",
    "  inspiration history <command> ...",
    "  inspiration capture <url> [screenshot flags]",
  ].join("\n");
}

function optionPath(argv) {
  const index = argv.indexOf("--path");
  if (index < 0) return process.cwd();
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw new Error("Missing value for --path");
  return value;
}

export function screenshotExecutable(execPath = process.execPath, platform = process.platform) {
  return path.join(path.dirname(execPath), platform === "win32" ? "screenshot.exe" : "screenshot");
}

export function runCapture(argv, execPath = process.execPath) {
  const executable = screenshotExecutable(execPath);
  const result = spawnSync(executable, argv, { stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "help") {
    console.log(help());
    return 0;
  }

  if (command === "init") {
    const root = optionPath(rest);
    console.log(JSON.stringify(initialize(root), null, 2));
    return 0;
  }

  if (command === "history") {
    await historyMain(rest, "inspiration history");
    return 0;
  }

  if (command === "capture") return runCapture(rest);

  throw new Error(`Unknown command: ${command}`);
}

if (import.meta.main) {
  main().then((status) => {
    process.exitCode = status;
  }).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
