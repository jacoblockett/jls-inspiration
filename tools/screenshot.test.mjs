import { describe, expect, test } from "bun:test";
import { captureHelp, parseCaptureArgs } from "./screenshot.mjs";

describe("capture CLI", () => {
  test("parses the provided screenshot tool flags through the Inspiration wrapper", () => {
    expect(parseCaptureArgs([
      "https://example.com",
      "--fullpage",
      "--width", "1440",
      "-h", "900",
      "-o", "capture.png",
    ])).toEqual({
      url: "https://example.com",
      fullpage: true,
      width: "1440",
      height: "900",
      output: "capture.png",
    });
  });

  test("renders wrapper-specific usage text", () => {
    const help = captureHelp("inspiration capture");
    expect(help).toContain("inspiration capture <url> [flags]");
    expect(help).toContain("--force-download");
    expect(help).toContain("--force-screenshot");
  });
});
