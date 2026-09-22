import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  canonicalizeUrl,
  getEntry,
  historyHelp,
  initialize,
  routeKey,
  searchEntries,
  writeEntry,
} from "./history.mjs";

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
  test("exposes only the consolidated CLI surface", () => {
    const help = historyHelp();
    expect(help).toContain("history init");
    expect(help).toContain("history get");
    expect(help).toContain("history write");
    expect(help).toContain("history search");
    expect(help).not.toContain("history seen");
    expect(help).not.toContain("history touch");
    expect(help).not.toContain("history list");
  });

  test("init creates only history-owned state", () => {
    const project = root();
    const state = path.join(project, ".inspiration");
    expect(Bun.file(path.join(state, "project.json")).size).toBeGreaterThan(0);
    expect(Bun.file(path.join(state, "research.db")).size).toBeGreaterThan(0);
  });

  test("canonicalizes tracking noise without collapsing functional URLs", () => {
    expect(canonicalizeUrl("HTTPS://Example.com/path/?b=2&utm_source=x&a=1#frag"))
      .toBe("https://example.com/path?b=2&a=1");
    expect(canonicalizeUrl("example.com/post/123"))
      .toBe("https://example.com/post/123");
  });

  test("groups obvious enumerated routes without claiming exact matches", () => {
    const project = root();
    writeEntry(project, "https://duolingo.com/blog/page/1", { track: "visual", stage: "visited" });
    writeEntry(project, "https://duolingo.com/blog/page/2", { track: "visual", stage: "visited" });

    const result = getEntry(project, "https://duolingo.com/blog/page/3", "visual");
    expect(result.exact_seen).toBe(false);
    expect(result.related.domain_seen).toBe(true);
    expect(result.related.route_seen).toBe(true);
    expect(result.related.route_entries).toBe(2);
  });

  test("groups numeric resource IDs as a route family", () => {
    expect(routeKey("https://duolingo.com/post/123"))
      .toBe(routeKey("https://duolingo.com/post/456"));
  });

  test("recognizes a previously visited site without conflating a different page", () => {
    const project = root();
    writeEntry(project, "https://duolingo.com", { track: "product", stage: "visited" });

    const result = getEntry(project, "https://www.duolingo.com/post/123", "product");
    expect(result.exact_seen).toBe(false);
    expect(result.related.domain).toBe("duolingo.com");
    expect(result.related.domain_seen).toBe(true);
    expect(result.related.route_seen).toBe(false);
  });

  test("get replaces the old seen check and returns exact history when present", () => {
    const project = root();
    writeEntry(project, "https://example.com/a", { track: "visual", stage: "visited" });

    const result = getEntry(project, "https://example.com/a", "visual");
    expect(result.exact_seen).toBe(true);
    expect(result.exact).toHaveLength(1);
    expect(result.exact[0].visited_at).not.toBeNull();
  });

  test("write records duplicate artifact hashes across sources", () => {
    const project = root();
    const first = path.join(project, "first.png");
    const second = path.join(project, "second.png");
    writeFileSync(first, "same-image");
    writeFileSync(second, "same-image");

    writeEntry(project, "https://example.com/a", {
      track: "visual",
      stage: "captured",
      artifact: first,
    });
    const duplicate = writeEntry(project, "https://cdn.example.net/b", {
      track: "product",
      stage: "captured",
      artifact: second,
    });

    expect(duplicate.artifact.duplicate_of.canonical_url).toBe("https://example.com/a");
  });

  test("write keeps researcher and auditor artifact judgments independent", () => {
    const project = root();
    const artifact = path.join(project, "visual.png");
    writeFileSync(artifact, "visual-evidence");

    writeEntry(project, "https://example.com/reference", {
      track: "visual",
      stage: "captured",
      artifact,
    });
    writeEntry(project, "https://example.com/reference", {
      track: "visual",
      stage: "accepted",
      artifact,
      note: "Hierarchy is visible",
    });
    writeEntry(project, "https://example.com/reference", {
      track: "visual",
      stage: "rejected",
      actor: "auditor",
      artifact,
      note: "Claim overstates what is shown",
    });

    const result = getEntry(project, "https://example.com/reference", "visual");
    const saved = result.exact[0].artifacts[0];
    expect(saved.researcher_verdict).toBe("accepted");
    expect(saved.auditor_verdict).toBe("rejected");
  });

  test("search without text replaces list and supports filters plus limits", () => {
    const project = root();
    writeEntry(project, "https://duolingo.com/a", { track: "visual", stage: "visited" });
    writeEntry(project, "https://duolingo.com/b", { track: "product", stage: "visited" });
    writeEntry(project, "https://example.com/c", { track: "visual", stage: "visited" });

    expect(searchEntries(project, "", { domain: "duolingo.com", limit: 10 })).toHaveLength(2);
    expect(searchEntries(project, "", { track: "visual", limit: 1 })).toHaveLength(1);
  });

  test("search finds source and artifact notes", () => {
    const project = root();
    const artifact = path.join(project, "hierarchy.png");
    writeFileSync(artifact, "hierarchy");

    writeEntry(project, "https://example.com/hierarchy", {
      track: "visual",
      stage: "captured",
      artifact,
    });
    writeEntry(project, "https://example.com/hierarchy", {
      track: "visual",
      stage: "accepted",
      artifact,
      note: "Distinctive navigation hierarchy",
    });

    expect(searchEntries(project, "Distinctive navigation", { track: "visual" })).toHaveLength(1);
    expect(searchEntries(project, "hierarchy.png", { track: "visual" })).toHaveLength(1);
  });

  test("overwriting an artifact path replaces its stale hash record", () => {
    const project = root();
    const artifact = path.join(project, "capture.png");
    writeFileSync(artifact, "first");
    writeEntry(project, "https://example.com/capture", {
      track: "visual",
      stage: "captured",
      artifact,
    });

    writeFileSync(artifact, "second");
    writeEntry(project, "https://example.com/capture", {
      track: "visual",
      stage: "captured",
      artifact,
    });

    const result = getEntry(project, "https://example.com/capture", "visual");
    expect(result.exact[0].artifacts).toHaveLength(1);
  });

  test("failed captures do not claim a capture timestamp", () => {
    const project = root();
    expect(() => writeEntry(project, "https://example.com/missing", {
      track: "visual",
      stage: "captured",
      artifact: path.join(project, "missing.png"),
    })).toThrow();

    const result = getEntry(project, "https://example.com/missing", "visual");
    expect(result.exact_seen).toBe(true);
    expect(result.exact[0].captured_at).toBeNull();
    expect(result.exact[0].artifacts).toHaveLength(0);
  });
});
