import { describe, expect, test } from "bun:test";
import { screenshotExecutable } from "./inspiration.mjs";

describe("runtime layout", () => {
  test("resolves the screenshot arm beside the installed Inspiration CLI", () => {
    expect(screenshotExecutable("/tmp/bin/inspiration", "linux")).toBe("/tmp/bin/screenshot");
    expect(screenshotExecutable("/tmp/bin/inspiration.exe", "win32")).toBe("/tmp/bin/screenshot.exe");
  });
});
