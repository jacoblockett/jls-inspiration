#!/usr/bin/env bun

import path from "node:path";
import process from "node:process";
import { captureMain } from "./screenshot.mjs";
import { historyMain, initialize, openHistory } from "./history.mjs";

function help() {
  return `Usage:\n  inspiration init [--path <project>]\n  inspiration status [--path <project>]\n  inspiration capture <url> [flags]\n  inspiration history <command> [args]\n\nCommands:\n  init      Initialize .inspiration durable research state\n  status    Report Inspiration state paths and source counts\n  capture   Screenshot HTML or download a direct media URL\n  history   Query and update durable research history`;
}

function parsePath(argv) {
  let root = process.cwd();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== "--path") throw new Error(`Unexpected argument: ${argv[i]}`);
    const value = argv[++i];
    if (!value) throw new Error("Missing value for --path");
    root = path.resolve(value);
  }
  return root;
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command || command === "--help" || command === "help") {
    console.log(help());
    return;
  }
  if (command === "capture") return captureMain(rest, "inspiration capture");
  if (command === "history") return historyMain(rest, "inspiration history");
  if (command === "init") {
    const paths = initialize(parsePath(rest));
    console.log(JSON.stringify({ initialized: true, state: paths.state, database: paths.db, report: paths.report }, null, 2));
    return;
  }
  if (command === "status") {
    const root = parsePath(rest);
    const { db, paths } = openHistory(root);
    try {
      const visual = db.query("SELECT COUNT(*) AS count FROM sources WHERE track = 'visual'").get().count;
      const product = db.query("SELECT COUNT(*) AS count FROM sources WHERE track = 'product'").get().count;
      const artifacts = db.query("SELECT COUNT(*) AS count FROM artifacts").get().count;
      console.log(JSON.stringify({ state: paths.state, database: paths.db, report: paths.report, visual, product, artifacts }, null, 2));
    } finally {
      db.close();
    }
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
