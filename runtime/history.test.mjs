import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Database } from "bun:sqlite";
import { canonicalizeUrl, getEntry, initialize, listEntries, openHistory, searchEntries, seen, touch } from "./history.mjs";

const roots = [];
function root() {
  const value = mkdtempSync(path.join(tmpdir(), "jls-inspiration-test-"));
  roots.push(value);
  initialize(value);
  return value;
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

describe("history", () => {
  test("canonicalizes common tracking noise without deleting functional query parameters", () => {
    expect(canonicalizeUrl("HTTPS://Example.com/path/?b=2&utm_source=x&a=1#frag"))
      .toBe("https://example.com/path?a=1&b=2");
  });

  test("tracks the same URL independently per research track", () => {
    const project = root();
    touch(project, "example.com/a", { track: "visual", stage: "visited" });
    expect(seen(project, "https://example.com/a", "visual").seen).toBe(true);
    expect(seen(project, "https://example.com/a", "product").seen).toBe(false);
  });

  test("reports cross-source duplicate artifact hashes without collapsing source history", () => {
    const project = root();
    const first = path.join(project, "first.png");
    const second = path.join(project, "second.png");
    writeFileSync(first, "same-image");
    writeFileSync(second, "same-image");
    touch(project, "https://example.com/a", { track: "visual", stage: "captured", artifact: first });
    const duplicate = touch(project, "https://cdn.example.net/b", { track: "product", stage: "captured", artifact: second });
    expect(duplicate.artifact.duplicate_of.canonical_url).toBe("https://example.com/a");
    expect(getEntry(project, "https://example.com/a", "visual")[0].artifacts).toHaveLength(1);
    expect(getEntry(project, "https://cdn.example.net/b", "product")[0].artifacts).toHaveLength(1);
  });

  test("records independent judgments for a specific captured artifact", () => {
    const project = root();
    const artifact = path.join(project, "visual.png");
    writeFileSync(artifact, "visual-evidence");
    touch(project, "https://example.com/reference", { track: "visual", stage: "captured", artifact });
    touch(project, "https://example.com/reference", {
      track: "visual",
      stage: "accepted",
      artifact,
      note: "Hierarchy is visible",
    });
    touch(project, "https://example.com/reference", {
      track: "visual",
      stage: "rejected",
      actor: "auditor",
      artifact,
      note: "Claim overstates what is shown",
    });
    const [entry] = getEntry(project, "https://example.com/reference", "visual");
    expect(entry.researcher_verdict).toBeNull();
    expect(entry.auditor_verdict).toBeNull();
    expect(entry.artifacts[0].researcher_verdict).toBe("accepted");
    expect(entry.artifacts[0].auditor_verdict).toBe("rejected");
  });


  test("replacing bytes at the same artifact path does not retain a stale hash row", () => {
    const project = root();
    const artifact = path.join(project, "capture.png");
    writeFileSync(artifact, "first");
    touch(project, "https://example.com/capture", { track: "visual", stage: "captured", artifact });
    writeFileSync(artifact, "second");
    touch(project, "https://example.com/capture", { track: "visual", stage: "captured", artifact });
    const [entry] = getEntry(project, "https://example.com/capture", "visual");
    expect(entry.artifacts).toHaveLength(1);
  });

  test("list verdict filters include artifact-level auditor judgments", () => {
    const project = root();
    const artifact = path.join(project, "accepted.png");
    writeFileSync(artifact, "accepted");
    touch(project, "https://example.com/accepted", { track: "visual", stage: "captured", artifact });
    touch(project, "https://example.com/accepted", {
      track: "visual",
      stage: "accepted",
      actor: "auditor",
      artifact,
      note: "Visible evidence checks out",
    });
    const entries = listEntries(project, { track: "visual", verdict: "accepted" });
    expect(entries.map((entry) => entry.canonical_url)).toContain("https://example.com/accepted");
    expect(entries[0].artifacts[0].auditor_verdict).toBe("accepted");
  });

  test("search includes artifact notes and paths", () => {
    const project = root();
    const artifact = path.join(project, "hierarchy.png");
    writeFileSync(artifact, "hierarchy");
    touch(project, "https://example.com/hierarchy", { track: "visual", stage: "captured", artifact });
    touch(project, "https://example.com/hierarchy", {
      track: "visual",
      stage: "accepted",
      artifact,
      note: "Distinctive navigation hierarchy",
    });
    expect(searchEntries(project, "Distinctive navigation", "visual")).toHaveLength(1);
    expect(searchEntries(project, "hierarchy.png", "visual")).toHaveLength(1);
  });


  test("failed captures do not claim a capture timestamp", () => {
    const project = root();
    expect(() => touch(project, "https://example.com/missing", {
      track: "visual",
      stage: "captured",
      artifact: path.join(project, "missing.png"),
    })).toThrow();
    const [entry] = getEntry(project, "https://example.com/missing", "visual");
    expect(entry.captured_at).toBeNull();
    expect(entry.artifacts).toHaveLength(0);
  });

  test("opens databases created before artifact verdict columns were added", () => {
    const project = mkdtempSync(path.join(tmpdir(), "jls-inspiration-legacy-"));
    roots.push(project);
    const state = path.join(project, ".inspiration");
    mkdirSync(state, { recursive: true });
    writeFileSync(path.join(state, "project.json"), JSON.stringify({ skill: "inspiration", schema: 1 }));
    const db = new Database(path.join(state, "research.db"), { create: true });
    db.exec(`
      CREATE TABLE sources (
        id INTEGER PRIMARY KEY,
        track TEXT NOT NULL,
        canonical_url TEXT NOT NULL,
        original_url TEXT NOT NULL,
        domain TEXT NOT NULL,
        discovered_at TEXT,
        visited_at TEXT,
        captured_at TEXT,
        researcher_inspected_at TEXT,
        researcher_verdict TEXT,
        researcher_note TEXT,
        auditor_inspected_at TEXT,
        auditor_verdict TEXT,
        auditor_note TEXT,
        UNIQUE(track, canonical_url)
      );
      CREATE TABLE artifacts (
        id INTEGER PRIMARY KEY,
        source_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        media_type TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(source_id, sha256)
      );
    `);
    db.close();
    const opened = openHistory(project);
    const columns = opened.db.query("PRAGMA table_info(artifacts)").all().map((row) => row.name);
    opened.db.close();
    expect(columns).toContain("auditor_verdict");
    expect(columns).toContain("researcher_note");
  });

  test("records artifact hashes and independent researcher/auditor judgments", () => {
    const project = root();
    const artifact = path.join(project, "evidence.png");
    writeFileSync(artifact, "fake-image");
    touch(project, "https://example.com/ui", { track: "visual", stage: "captured", artifact });
    touch(project, "https://example.com/ui", { track: "visual", stage: "accepted", note: "Useful hierarchy" });
    touch(project, "https://example.com/ui", { track: "visual", stage: "rejected", actor: "auditor", note: "Claim is not visible" });
    const [entry] = getEntry(project, "https://example.com/ui", "visual");
    expect(entry.researcher_verdict).toBe("accepted");
    expect(entry.auditor_verdict).toBe("rejected");
    expect(entry.artifacts).toHaveLength(1);
    expect(entry.artifacts[0].sha256).toHaveLength(64);
  });
});
