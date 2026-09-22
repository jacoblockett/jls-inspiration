#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Database } from "bun:sqlite";

const TRACKS = new Set(["visual", "product"]);
const STAGES = new Set(["discovered", "visited", "captured", "inspected", "accepted", "rejected"]);
const ACTORS = new Set(["researcher", "auditor"]);
const TRACKING_PARAMS = new Set(["gclid", "dclid", "fbclid", "msclkid", "mc_cid", "mc_eid"]);

function now() {
  return new Date().toISOString();
}

function parseOptions(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2).replaceAll("-", "_");
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}`);
    options[key] = value;
  }
  return { positional, options };
}

export function canonicalizeUrl(value) {
  const raw = value.trim();
  const input = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL must use http or https");
  url.hash = "";
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  const sorted = [...url.searchParams.entries()].sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
  url.search = "";
  for (const [key, valuePart] of sorted) url.searchParams.append(key, valuePart);
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

function projectRoot(value) {
  return path.resolve(value ?? process.cwd());
}

function statePaths(root) {
  const state = path.join(root, ".inspiration");
  return {
    root,
    state,
    marker: path.join(state, "project.json"),
    db: path.join(state, "research.db"),
    assets: path.join(state, "assets"),
    work: path.join(state, "work"),
    report: path.join(state, "report.md"),
  };
}

function verifyMarker(marker) {
  if (!existsSync(marker)) throw new Error("Inspiration state is not initialized. Run `inspiration init` first.");
  const value = JSON.parse(readFileSync(marker, "utf8"));
  if (value?.skill !== "inspiration" || value?.schema !== 1) throw new Error(`Invalid Inspiration state marker: ${marker}`);
}

export function openHistory(root, create = false) {
  const paths = statePaths(projectRoot(root));
  if (create) {
    mkdirSync(path.join(paths.assets, "visual"), { recursive: true });
    mkdirSync(path.join(paths.assets, "product"), { recursive: true });
    mkdirSync(paths.work, { recursive: true });
    if (!existsSync(paths.marker)) {
      writeFileSync(paths.marker, `${JSON.stringify({ skill: "inspiration", schema: 1 }, null, 2)}\n`);
    }
  }
  verifyMarker(paths.marker);

  const db = new Database(paths.db, { create: true });
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY,
      track TEXT NOT NULL CHECK(track IN ('visual','product')),
      canonical_url TEXT NOT NULL,
      original_url TEXT NOT NULL,
      domain TEXT NOT NULL,
      discovered_at TEXT,
      visited_at TEXT,
      captured_at TEXT,
      researcher_inspected_at TEXT,
      researcher_verdict TEXT CHECK(researcher_verdict IN ('accepted','rejected') OR researcher_verdict IS NULL),
      researcher_note TEXT,
      auditor_inspected_at TEXT,
      auditor_verdict TEXT CHECK(auditor_verdict IN ('accepted','rejected') OR auditor_verdict IS NULL),
      auditor_note TEXT,
      UNIQUE(track, canonical_url)
    );
    CREATE TABLE IF NOT EXISTS artifacts (
      id INTEGER PRIMARY KEY,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      media_type TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(source_id, sha256)
    );
    CREATE INDEX IF NOT EXISTS sources_domain_idx ON sources(domain);
    CREATE INDEX IF NOT EXISTS artifacts_sha_idx ON artifacts(sha256);
  `);
  return { db, paths };
}

export function initialize(root) {
  const opened = openHistory(root, true);
  opened.db.close();
  return opened.paths;
}

function validateTrack(track) {
  if (!TRACKS.has(track)) throw new Error("--track must be visual or product");
}

function sourceRow(db, track, canonical) {
  return db.query("SELECT * FROM sources WHERE track = ? AND canonical_url = ?").get(track, canonical);
}

function upsertSource(db, track, original, canonical) {
  const url = new URL(canonical);
  db.query(`
    INSERT INTO sources(track, canonical_url, original_url, domain, discovered_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(track, canonical_url) DO UPDATE SET original_url = excluded.original_url
  `).run(track, canonical, original, url.hostname.toLowerCase(), now());
  return sourceRow(db, track, canonical);
}

function sha256File(file) {
  const bytes = readFileSync(file);
  return createHash("sha256").update(bytes).digest("hex");
}

function mediaType(file) {
  const ext = path.extname(file).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext)) return "image";
  if ([".mp4", ".webm", ".mov", ".m4v"].includes(ext)) return "video";
  return "other";
}

function attachArtifact(db, sourceId, file) {
  const resolved = path.resolve(file);
  if (!existsSync(resolved)) throw new Error(`Artifact does not exist: ${resolved}`);
  const sha = sha256File(resolved);
  db.query(`
    INSERT INTO artifacts(source_id, path, sha256, media_type, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_id, sha256) DO UPDATE SET path = excluded.path
  `).run(sourceId, resolved, sha, mediaType(resolved), now());
  return { path: resolved, sha256: sha };
}

export function touch(root, urlValue, { track, stage, actor = "researcher", artifact, note } = {}) {
  validateTrack(track);
  if (!STAGES.has(stage)) throw new Error(`--stage must be one of: ${[...STAGES].join(", ")}`);
  if (!ACTORS.has(actor)) throw new Error("--actor must be researcher or auditor");
  if (actor === "auditor" && !["inspected", "accepted", "rejected"].includes(stage)) {
    throw new Error("auditor stage must be inspected, accepted, or rejected");
  }
  if (stage === "captured" && !artifact) throw new Error("captured stage requires --artifact");

  const { db } = openHistory(root);
  try {
    const canonical = canonicalizeUrl(urlValue);
    const row = upsertSource(db, track, urlValue, canonical);
    const stamp = now();
    const updates = [];
    const params = [];

    if (stage === "discovered") updates.push("discovered_at = COALESCE(discovered_at, ?)");
    else if (stage === "visited") updates.push("visited_at = ?");
    else if (stage === "captured") updates.push("captured_at = ?");
    else if (stage === "inspected") updates.push(actor === "auditor" ? "auditor_inspected_at = ?" : "researcher_inspected_at = ?");
    else if (["accepted", "rejected"].includes(stage)) {
      if (actor === "auditor") {
        updates.push("auditor_inspected_at = COALESCE(auditor_inspected_at, ?)", "auditor_verdict = ?", "auditor_note = ?");
        params.push(stamp, stage, note ?? null);
      } else {
        updates.push("researcher_inspected_at = COALESCE(researcher_inspected_at, ?)", "researcher_verdict = ?", "researcher_note = ?");
        params.push(stamp, stage, note ?? null);
      }
    }

    if (!["accepted", "rejected"].includes(stage)) params.push(stamp);
    db.query(`UPDATE sources SET ${updates.join(", ")} WHERE id = ?`).run(...params, row.id);
    const attached = artifact ? attachArtifact(db, row.id, artifact) : null;
    return { source: sourceRow(db, track, canonical), artifact: attached };
  } finally {
    db.close();
  }
}

export function seen(root, urlValue, track) {
  const { db } = openHistory(root);
  try {
    const canonical = canonicalizeUrl(urlValue);
    if (track) {
      validateTrack(track);
      const row = sourceRow(db, track, canonical);
      return { seen: Boolean(row), canonical_url: canonical, entries: row ? [row] : [] };
    }
    const rows = db.query("SELECT * FROM sources WHERE canonical_url = ? ORDER BY track").all(canonical);
    return { seen: rows.length > 0, canonical_url: canonical, entries: rows };
  } finally {
    db.close();
  }
}

export function getEntry(root, urlValue, track) {
  const { db } = openHistory(root);
  try {
    const canonical = canonicalizeUrl(urlValue);
    const rows = track
      ? (validateTrack(track), [sourceRow(db, track, canonical)].filter(Boolean))
      : db.query("SELECT * FROM sources WHERE canonical_url = ? ORDER BY track").all(canonical);
    return rows.map((row) => ({
      ...row,
      artifacts: db.query("SELECT path, sha256, media_type, created_at FROM artifacts WHERE source_id = ? ORDER BY id").all(row.id),
    }));
  } finally {
    db.close();
  }
}

export function listEntries(root, { track, verdict, limit = 200 } = {}) {
  if (track) validateTrack(track);
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 5000) throw new Error("--limit must be an integer from 1 to 5000");
  const { db } = openHistory(root);
  try {
    const clauses = [];
    const params = [];
    if (track) { clauses.push("track = ?"); params.push(track); }
    if (verdict) {
      if (!["accepted", "rejected", "pending"].includes(verdict)) throw new Error("--verdict must be accepted, rejected, or pending");
      if (verdict === "pending") clauses.push("auditor_verdict IS NULL");
      else { clauses.push("auditor_verdict = ?"); params.push(verdict); }
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return db.query(`SELECT * FROM sources ${where} ORDER BY id DESC LIMIT ?`).all(...params, parsedLimit);
  } finally {
    db.close();
  }
}

export function searchEntries(root, query, track, limit = 100) {
  if (track) validateTrack(track);
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 5000) throw new Error("--limit must be an integer from 1 to 5000");
  const { db } = openHistory(root);
  try {
    const term = `%${query}%`;
    if (track) {
      return db.query(`
        SELECT * FROM sources
        WHERE track = ? AND (canonical_url LIKE ? OR original_url LIKE ? OR domain LIKE ? OR researcher_note LIKE ? OR auditor_note LIKE ?)
        ORDER BY id DESC LIMIT ?
      `).all(track, term, term, term, term, term, parsedLimit);
    }
    return db.query(`
      SELECT * FROM sources
      WHERE canonical_url LIKE ? OR original_url LIKE ? OR domain LIKE ? OR researcher_note LIKE ? OR auditor_note LIKE ?
      ORDER BY id DESC LIMIT ?
    `).all(term, term, term, term, term, parsedLimit);
  } finally {
    db.close();
  }
}

export function historyHelp(command = "inspiration history") {
  return `Usage:\n  ${command} seen <url> [--track visual|product] [--path <project>]\n  ${command} touch <url> --track visual|product --stage <stage> [--actor researcher|auditor] [--artifact <file>] [--note <text>] [--path <project>]\n  ${command} get <url> [--track visual|product] [--path <project>]\n  ${command} list [--track visual|product] [--verdict accepted|rejected|pending] [--limit <n>] [--path <project>]\n  ${command} search <text> [--track visual|product] [--limit <n>] [--path <project>]`;
}

export async function historyMain(argv = process.argv.slice(2), command = "inspiration history") {
  const [subcommand, ...rest] = argv;
  if (!subcommand || subcommand === "--help" || subcommand === "help") {
    console.log(historyHelp(command));
    return;
  }
  const { positional, options } = parseOptions(rest);
  const root = projectRoot(options.path);
  let result;

  if (subcommand === "seen") {
    if (positional.length !== 1) throw new Error(`Usage: ${command} seen <url>`);
    result = seen(root, positional[0], options.track);
  } else if (subcommand === "touch") {
    if (positional.length !== 1) throw new Error(`Usage: ${command} touch <url> --track ... --stage ...`);
    result = touch(root, positional[0], {
      track: options.track,
      stage: options.stage,
      actor: options.actor ?? "researcher",
      artifact: options.artifact,
      note: options.note,
    });
  } else if (subcommand === "get") {
    if (positional.length !== 1) throw new Error(`Usage: ${command} get <url>`);
    result = getEntry(root, positional[0], options.track);
  } else if (subcommand === "list") {
    if (positional.length !== 0) throw new Error(`Usage: ${command} list [flags]`);
    result = listEntries(root, { track: options.track, verdict: options.verdict, limit: options.limit ?? 200 });
  } else if (subcommand === "search") {
    if (positional.length < 1) throw new Error(`Usage: ${command} search <text>`);
    result = searchEntries(root, positional.join(" "), options.track, options.limit ?? 100);
  } else {
    throw new Error(`Unknown history command: ${subcommand}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) {
  historyMain().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
