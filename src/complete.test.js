import { describe, it, expect } from "vitest";
import { complete } from "./complete.js";

const noPager = { current: null };
const pagerWithSlugs = {
  current: {
    slugMap: {
      1: { slug: "zero-day-exploit", url: "https://example.com/zero-day" },
      2: { slug: "buffer-overflow",  url: "https://example.com/buffer" },
      3: { slug: "kernel-panic",     url: "https://example.com/kernel" },
    },
  },
};

describe("complete — top-level commands", () => {
  it("returns null for empty input", () => {
    expect(complete("", noPager)).toBeNull();
  });

  it("completes unambiguous prefix", () => {
    expect(complete("his", noPager)).toBe("history");
  });

  it("completes full word that is already a command", () => {
    expect(complete("help", noPager)).toBe("help");
  });

  it("returns null when no command matches", () => {
    expect(complete("xyz", noPager)).toBeNull();
  });

  it("returns null for ambiguous prefix with multiple matches", () => {
    // 'c' matches: cat, cd, clear, comment, comments, config
    expect(complete("c", noPager)).toBeNull();
  });

  it("completes 'se' to 'search' (unambiguous)", () => {
    expect(complete("se", noPager)).toBe("search");
  });

  it("completes 'gr' to 'grep'", () => {
    expect(complete("gr", noPager)).toBe("grep");
  });

  it("completes 'ma' to 'man'", () => {
    expect(complete("ma", noPager)).toBe("man");
  });

  it("returns null for 'r' (ambiguous: r and read both match)", () => {
    expect(complete("r", noPager)).toBeNull();
  });

  it("returns null for 'l' (ambiguous: l, link, ls all match)", () => {
    expect(complete("l", noPager)).toBeNull();
  });

  it("completes 'n' to 'n' (unambiguous single-letter alias)", () => {
    expect(complete("n", noPager)).toBe("n");
  });

  it("returns null for 'm' (ambiguous: m and man both match)", () => {
    expect(complete("m", noPager)).toBeNull();
  });
});

describe("complete — ls subcommands", () => {
  it("returns null for 'ls p' (posts and pages both match)", () => {
    expect(complete("ls p", noPager)).toBeNull();
  });

  it("completes 'ls po' to 'ls posts'", () => {
    expect(complete("ls po", noPager)).toBe("ls posts");
  });

  it("completes 'ls pa' to 'ls pages'", () => {
    expect(complete("ls pa", noPager)).toBe("ls pages");
  });

  it("completes 'ls c' to null (categories/cats ambiguous)", () => {
    expect(complete("ls c", noPager)).toBeNull();
  });

  it("completes 'ls ca' to null (categories/cats still ambiguous)", () => {
    expect(complete("ls ca", noPager)).toBeNull();
  });

  it("returns null for 'ls cat' (cats and categories both match)", () => {
    expect(complete("ls cat", noPager)).toBeNull();
  });

  it("completes 'ls cats' to 'ls cats'", () => {
    expect(complete("ls cats", noPager)).toBe("ls cats");
  });

  it("completes 'ls cate' to 'ls categories'", () => {
    expect(complete("ls cate", noPager)).toBe("ls categories");
  });

  it("completes 'ls t' to 'ls tags'", () => {
    expect(complete("ls t", noPager)).toBe("ls tags");
  });

  it("returns null for unknown ls subcommand prefix", () => {
    expect(complete("ls z", noPager)).toBeNull();
  });
});

describe("complete — slug completion from pager", () => {
  it("completes 'read z' to 'read zero-day-exploit'", () => {
    expect(complete("read z", pagerWithSlugs)).toBe("read zero-day-exploit");
  });

  it("completes 'r b' to 'r buffer-overflow'", () => {
    expect(complete("r b", pagerWithSlugs)).toBe("r buffer-overflow");
  });

  it("completes 'cat k' to 'cat kernel-panic'", () => {
    expect(complete("cat k", pagerWithSlugs)).toBe("cat kernel-panic");
  });

  it("returns null when slug prefix is ambiguous", () => {
    // both 'zero-day-exploit' and 'buffer-overflow' don't share a prefix with 'z' — only zero does
    // let's test real ambiguity: add two slugs starting with 'b'
    const p = {
      current: {
        slugMap: {
          1: { slug: "buffer-overflow" },
          2: { slug: "boot-sequence" },
        },
      },
    };
    expect(complete("read b", p)).toBeNull();
  });

  it("returns null when no slugs match prefix", () => {
    expect(complete("read xyz", pagerWithSlugs)).toBeNull();
  });

  it("ignores slug completion for non-read commands", () => {
    expect(complete("ls z", pagerWithSlugs)).toBeNull();
  });

  it("returns null when pager is empty", () => {
    expect(complete("read z", noPager)).toBeNull();
  });
});

describe("complete — does not complete mid-word", () => {
  it("returns null when input already has a space-terminated second word", () => {
    expect(complete("ls posts ", noPager)).toBeNull();
  });
});
