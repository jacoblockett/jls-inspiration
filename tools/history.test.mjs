import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { canonicalizeUrl, getEntry, initialize, seen, touch } from "./history.mjs";

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
