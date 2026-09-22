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
const PAGINATION_PARAMS = new Set(["page", "p", "paged", "offset", "start"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_HEX = /^[0-9a-f]{16,}$/i;

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
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

function siteKey(urlValue) {
  const url = new URL(urlValue);
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

export function routeKey(urlValue) {
  const canonical = canonicalizeUrl(urlValue);
  const url = new URL(canonical);
  const rawSegments = url.pathname.split("/").filter(Boolean);
  const segments = rawSegments.map((segment, index) => {
    if (/^\d+$/.test(segment)) {
      const previous = rawSegments[index - 1]?.toLowerCase();
      return ["page", "pages", "p"].includes(previous) ? ":page" : ":id";
    }
    if (UUID.test(segment) || LONG_HEX.test(segment)) return ":id";
    return segment;
  });

  const query = [...url.searchParams.entries()]
    .map(([key, value]) => (
      PAGINATION_PARAMS.has(key.toLowerCase()) && /^\d+$/.test(value)
        ? [key, ":page"]
        : [key, value]
    ))
    .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return `${siteKey(canonical)}${segments.length ? `/${segments.join("/")}` : "/"}${query ? `?${query}` : ""}`;
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
  };
}

function verifyMarker(marker) {
  if (!existsSync(marker)) throw new Error("Inspiration state is not initialized. Run `history init` first.");
  const value = JSON.parse(readFileSync(marker, "utf8"));
  if (value?.skill !== "inspiration" || value?.schema !== 1) throw new Error(`Invalid Inspiration state marker: ${marker}`);
}

export function openHistory(root, create = false) {
  const paths = statePaths(projectRoot(root));
  if (create) {
    mkdirSync(paths.state, { recursive: true });
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
      route_key TEXT NOT NULL,
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
      created_at TEXT NOT NULL,
      researcher_inspected_at TEXT,
      researcher_verdict TEXT CHECK(researcher_verdict IN ('accepted','rejected') OR researcher_verdict IS NULL),
      researcher_note TEXT,
      auditor_inspected_at TEXT,
      auditor_verdict TEXT CHECK(auditor_verdict IN ('accepted','rejected') OR auditor_verdict IS NULL),
      auditor_note TEXT,
      UNIQUE(source_id, sha256)
    );
    CREATE INDEX IF NOT EXISTS sources_domain_idx ON sources(domain);
    CREATE INDEX IF NOT EXISTS sources_route_idx ON sources(route_key);
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

function withArtifacts(db, row) {
  return {
    ...row,
    artifacts: db.query("SELECT * FROM artifacts WHERE source_id = ? ORDER BY id").all(row.id),
  };
}

function upsertSource(db, track, original, canonical) {
  const domain = siteKey(canonical);
  const route = routeKey(canonical);
  db.query(`
    INSERT INTO sources(track, canonical_url, original_url, domain, route_key, discovered_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(track, canonical_url) DO UPDATE SET
      original_url = excluded.original_url,
      domain = excluded.domain,
      route_key = excluded.route_key
  `).run(track, canonical, original, domain, route, now());
  return sourceRow(db, track, canonical);
}

function sha256File(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function attachArtifact(db, sourceId, file) {
  const resolved = path.resolve(file);
  if (!existsSync(resolved)) throw new Error(`Artifact does not exist: ${resolved}`);
  const sha = sha256File(resolved);
  const duplicate = db.query(`
    SELECT a.path, a.sha256, s.track, s.canonical_url
    FROM artifacts a
    JOIN sources s ON s.id = a.source_id
    WHERE a.sha256 = ? AND a.source_id != ?
    ORDER BY a.id
    LIMIT 1
  `).get(sha, sourceId);

  db.query("DELETE FROM artifacts WHERE source_id = ? AND path = ? AND sha256 != ?").run(sourceId, resolved, sha);
  db.query(`
    INSERT INTO artifacts(source_id, path, sha256, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(source_id, sha256) DO UPDATE SET
      path = excluded.path,
      created_at = excluded.created_at
  `).run(sourceId, resolved, sha, now());

  return {
    ...db.query("SELECT * FROM artifacts WHERE source_id = ? AND sha256 = ?").get(sourceId, sha),
    duplicate_of: duplicate ?? null,
  };
}

function artifactRow(db, sourceId, file) {
  return db.query("SELECT * FROM artifacts WHERE source_id = ? AND path = ?").get(sourceId, path.resolve(file));
}

function updateJudgment(db, table, id, stage, actor, note) {
  const stamp = now();
  const prefix = actor === "auditor" ? "auditor" : "researcher";
  if (stage === "inspected") {
    db.query(`UPDATE ${table} SET ${prefix}_inspected_at = ? WHERE id = ?`).run(stamp, id);
  } else {
    db.query(`
      UPDATE ${table}
      SET ${prefix}_inspected_at = COALESCE(${prefix}_inspected_at, ?),
          ${prefix}_verdict = ?,
          ${prefix}_note = ?
      WHERE id = ?
    `).run(stamp, stage, note ?? null, id);
  }
}

export function writeEntry(root, urlValue, { track, stage, actor = "researcher", artifact, note } = {}) {
  validateTrack(track);
  if (!STAGES.has(stage)) throw new Error(`--stage must be one of: ${[...STAGES].join(", ")}`);
  if (!ACTORS.has(actor)) throw new Error("--actor must be researcher or auditor");
  if (actor === "auditor" && !["inspected", "accepted", "rejected"].includes(stage)) {
    throw new Error("auditor stage must be inspected, accepted, or rejected");
  }
  if (stage === "captured" && !artifact) throw new Error("captured stage requires --artifact");
  if (artifact && ["discovered", "visited"].includes(stage)) {
    throw new Error(`${stage} is source-level and does not accept --artifact`);
  }

  const { db } = openHistory(root);
  try {
    const canonical = canonicalizeUrl(urlValue);

    if (artifact && ["inspected", "accepted", "rejected"].includes(stage)) {
      const row = sourceRow(db, track, canonical);
      if (!row) throw new Error(`Source is not registered for ${track}: ${canonical}`);
      const target = artifactRow(db, row.id, artifact);
      if (!target) throw new Error(`Artifact is not registered for this source: ${path.resolve(artifact)}`);
      updateJudgment(db, "artifacts", target.id, stage, actor, note);
      return {
        source: sourceRow(db, track, canonical),
        artifact: artifactRow(db, row.id, artifact),
      };
    }

    const row = upsertSource(db, track, urlValue, canonical);
    const stamp = now();
    let attached = null;
    if (stage === "discovered") {
      db.query("UPDATE sources SET discovered_at = COALESCE(discovered_at, ?) WHERE id = ?").run(stamp, row.id);
    } else if (stage === "visited") {
      db.query("UPDATE sources SET visited_at = ? WHERE id = ?").run(stamp, row.id);
    } else if (stage === "captured") {
      attached = attachArtifact(db, row.id, artifact);
      db.query("UPDATE sources SET captured_at = ? WHERE id = ?").run(stamp, row.id);
    } else {
      updateJudgment(db, "sources", row.id, stage, actor, note);
    }

    return { source: sourceRow(db, track, canonical), artifact: attached };
  } finally {
    db.close();
  }
}

export function getEntry(root, urlValue, track) {
  if (track) validateTrack(track);
  const { db } = openHistory(root);
  try {
    const canonical = canonicalizeUrl(urlValue);
    const domain = siteKey(canonical);
    const route = routeKey(canonical);
    const exactRows = track
      ? [sourceRow(db, track, canonical)].filter(Boolean)
      : db.query("SELECT * FROM sources WHERE canonical_url = ? ORDER BY track").all(canonical);

    const domainRows = track
      ? db.query("SELECT * FROM sources WHERE track = ? AND domain = ? ORDER BY id DESC").all(track, domain)
      : db.query("SELECT * FROM sources WHERE domain = ? ORDER BY id DESC").all(domain);
    const routeRows = domainRows.filter((row) => row.route_key === route && row.canonical_url !== canonical);

    return {
      exact_seen: exactRows.length > 0,
      canonical_url: canonical,
      exact: exactRows.map((row) => withArtifacts(db, row)),
      related: {
        domain,
        domain_seen: domainRows.length > 0,
        domain_entries: domainRows.length,
        route_key: route,
        route_seen: routeRows.length > 0,
        route_entries: routeRows.length,
        route_examples: routeRows.slice(0, 10).map((row) => ({
          track: row.track,
          canonical_url: row.canonical_url,
          visited_at: row.visited_at,
          researcher_verdict: row.researcher_verdict,
          auditor_verdict: row.auditor_verdict,
        })),
      },
    };
  } finally {
    db.close();
  }
}

function normalizedDomain(value) {
  const raw = value.trim();
  return siteKey(canonicalizeUrl(raw.includes("/") ? raw : `https://${raw}`));
}

export function searchEntries(root, query = "", { track, verdict, domain, limit = 100 } = {}) {
  if (track) validateTrack(track);
  const parsedLimit = Number(limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 5000) {
    throw new Error("--limit must be an integer from 1 to 5000");
  }
  if (verdict && !["accepted", "rejected", "pending"].includes(verdict)) {
    throw new Error("--verdict must be accepted, rejected, or pending");
  }

  const { db } = openHistory(root);
  try {
    const clauses = [];
    const params = [];

    if (track) {
      clauses.push("s.track = ?");
      params.push(track);
    }
    if (domain) {
      clauses.push("s.domain = ?");
      params.push(normalizedDomain(domain));
    }
    if (verdict === "pending") {
      clauses.push(`(
        (NOT EXISTS (SELECT 1 FROM artifacts av WHERE av.source_id = s.id) AND s.auditor_verdict IS NULL)
        OR EXISTS (SELECT 1 FROM artifacts av WHERE av.source_id = s.id AND av.auditor_verdict IS NULL)
      )`);
    } else if (verdict) {
      clauses.push(`(
        s.auditor_verdict = ?
        OR EXISTS (SELECT 1 FROM artifacts av WHERE av.source_id = s.id AND av.auditor_verdict = ?)
      )`);
      params.push(verdict, verdict);
    }

    const text = query.trim();
    if (text) {
      const term = `%${text}%`;
      clauses.push(`(
        s.canonical_url LIKE ?
        OR s.original_url LIKE ?
        OR s.domain LIKE ?
        OR s.researcher_note LIKE ?
        OR s.auditor_note LIKE ?
        OR a.path LIKE ?
        OR a.researcher_note LIKE ?
        OR a.auditor_note LIKE ?
      )`);
      params.push(term, term, term, term, term, term, term, term);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.query(`
      SELECT DISTINCT s.*
      FROM sources s
      LEFT JOIN artifacts a ON a.source_id = s.id
      ${where}
      ORDER BY s.id DESC
      LIMIT ?
    `).all(...params, parsedLimit);

    return rows.map((row) => withArtifacts(db, row));
  } finally {
    db.close();
  }
}

export function historyHelp(command = "history") {
  return `Usage:
  ${command} init [--path <project>]
  ${command} get <url> [--track visual|product] [--path <project>]
  ${command} write <url> --track visual|product --stage <stage> [--actor researcher|auditor] [--artifact <file>] [--note <text>] [--path <project>]
  ${command} search [text] [--track visual|product] [--verdict accepted|rejected|pending] [--domain <domain>] [--limit <n>] [--path <project>]`;
}

export async function historyMain(argv = process.argv.slice(2), command = "history") {
  const [subcommand, ...rest] = argv;
  if (!subcommand || subcommand === "--help" || subcommand === "help") {
    console.log(historyHelp(command));
    return;
  }

  const { positional, options } = parseOptions(rest);
  const root = projectRoot(options.path);
  let result;

  if (subcommand === "init") {
    if (positional.length !== 0) throw new Error(`Usage: ${command} init [--path <project>]`);
    result = initialize(root);
  } else if (subcommand === "get") {
    if (positional.length !== 1) throw new Error(`Usage: ${command} get <url>`);
    result = getEntry(root, positional[0], options.track);
  } else if (subcommand === "write") {
    if (positional.length !== 1) throw new Error(`Usage: ${command} write <url> --track ... --stage ...`);
    result = writeEntry(root, positional[0], {
      track: options.track,
      stage: options.stage,
      actor: options.actor ?? "researcher",
      artifact: options.artifact,
      note: options.note,
    });
  } else if (subcommand === "search") {
    result = searchEntries(root, positional.join(" "), {
      track: options.track,
      verdict: options.verdict,
      domain: options.domain,
      limit: options.limit ?? 100,
    });
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
