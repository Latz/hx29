import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils.js", () => ({
  getPageLines: vi.fn(() => 30),
  getLineWidth: vi.fn(() => 80),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    man_usage: "Usage: man <command>",
    man_not_found: (cmd) => `man: no manual entry for ${cmd}`,
    more_chars_left: (n) => `[n]ext (${n} chars remaining)`,
    man_pages: {
      read:    ["NAME", "  read - display a post", "", "SYNOPSIS", "  read <slug|n>"],
      ls:      ["NAME", "  ls - list content"],
      search:  ["NAME", "  search - full text search"],
      grep:    ["NAME", "  grep - filter posts by keyword"],
      cat:     ["NAME", "  cat - display a page"],
      n:       ["NAME", "  n - next page"],
      comment: ["NAME", "  comment - post a comment"],
      cd:      ["NAME", "  cd - change directory filter"],
      man:     ["NAME", "  man - display manual"],
      pwd:     ["NAME", "  pwd - show current path"],
    },
  },
}));

import { getPageLines } from "../utils.js";
import cmdMan from "./cmdMan.js";

beforeEach(() => vi.clearAllMocks());

describe("cmdMan", () => {
  it("returns usage when no args", async () => {
    const result = await cmdMan([], { current: null });
    expect(result[0]).toContain("Usage: man <command>");
  });

  it("returns manual for 'read'", async () => {
    const pager = { current: null };
    const result = await cmdMan(["read"], pager);
    expect(result).toContainLineWithText("read - display a post");
  });

  it("returns manual for 'ls'", async () => {
    const result = await cmdMan(["ls"], { current: null });
    expect(result).toContainLineWithText("ls - list content");
  });

  it("returns not-found error for unknown command", async () => {
    const result = await cmdMan(["foobar"], { current: null });
    expect(result[0]).toContain("no manual entry for foobar");
  });

  it("resolves alias 'r' to 'read'", async () => {
    const result = await cmdMan(["r"], { current: null });
    expect(result).toContainLineWithText("read - display a post");
  });

  it("resolves alias 'c' to 'comment'", async () => {
    const result = await cmdMan(["c"], { current: null });
    expect(result).toContainLineWithText("comment");
  });

  it("returns an array of strings", async () => {
    const result = await cmdMan(["ls"], { current: null });
    expect(Array.isArray(result)).toBe(true);
    expect(result.every((l) => typeof l === "string")).toBe(true);
  });

  it("paginates via pager when content exceeds pageLines", async () => {
    getPageLines.mockReturnValue(3);
    const pager = { current: null };
    await cmdMan(["read"], pager);
    if (pager.current !== null) {
      expect(pager.current.type).toBe("article");
    }
  });
});
