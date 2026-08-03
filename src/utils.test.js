import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  wordWrap,
  wrapLines,
  fmtLine,
  batchFmtLineEls,
  stripHtml,
  loadConfig,
  saveConfig,
  applyConfig,
  pushHistory,
  loadHistory,
  LINE_W,
  DATE_W,
  NUM_W,
} from "./utils.js";

vi.mock("./i18n/index.js", () => ({
  t: { locale: "en-US" },
}));

// ─── wordWrap ────────────────────────────────────────────────────────────────

describe("wordWrap", () => {
  it("returns single line when text fits", () => {
    expect(wordWrap("hello world", 20)).toEqual(["hello world"]);
  });

  it("wraps at word boundary", () => {
    const result = wordWrap("one two three four", 10);
    expect(result.every((l) => l.length <= 10)).toBe(true);
    expect(result.join(" ")).toContain("one");
    expect(result.join(" ")).toContain("four");
  });

  it("hard-breaks token longer than width", () => {
    const long = "a".repeat(20);
    const result = wordWrap(long, 10);
    expect(result.length).toBeGreaterThan(1);
    expect(result.every((l) => l.length <= 10)).toBe(true);
  });

  it("breaks on hyphen when possible", () => {
    const result = wordWrap("super-long-hyphenated-word", 12);
    expect(result.length).toBeGreaterThan(1);
  });

  it("returns empty array for empty string", () => {
    expect(wordWrap("", 80)).toEqual([]);
  });
});

// ─── wrapLines ───────────────────────────────────────────────────────────────

describe("wrapLines", () => {
  it("passes through lines that already fit", () => {
    expect(wrapLines(["short", "also short"], 80)).toEqual(["short", "also short"]);
  });

  it("wraps long lines", () => {
    const long = "word ".repeat(20).trim();
    const result = wrapLines([long], 20);
    expect(result.length).toBeGreaterThan(1);
    expect(result.every((l) => l.length <= 20)).toBe(true);
  });
});

// ─── fmtLine ─────────────────────────────────────────────────────────────────

describe("fmtLine", () => {
  it("produces a string with number, title, and date", () => {
    const line = fmtLine(1, "My Post", "2025-01-01");
    expect(line).toContain("1");
    expect(line).toContain("My Post");
    expect(line).toContain("2025-01-01");
  });

  it("truncates long titles with ellipsis", () => {
    const title = "A".repeat(200);
    const line = fmtLine(1, title, "2025-01-01", 80);
    expect(line.length).toBeLessThanOrEqual(80);
    expect(line).toContain("…");
  });

  it("respects custom cols parameter", () => {
    const line = fmtLine(1, "Short", "2025-01-01", 50);
    expect(line.length).toBeLessThanOrEqual(50);
  });

  it("uses LINE_W default when cols omitted", () => {
    const line = fmtLine(1, "Short", "2025-01-01");
    expect(line.length).toBeLessThanOrEqual(LINE_W);
  });
});

// ─── batchFmtLineEls ─────────────────────────────────────────────────────────

describe("batchFmtLineEls", () => {
  it("returns one string per item", () => {
    const items = [
      { n: 1, title: "Post One", date: "2025-01-01" },
      { n: 2, title: "Post Two", date: "2025-01-02" },
    ];
    const result = batchFmtLineEls(items, 80);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("Post One");
    expect(result[1]).toContain("Post Two");
  });

  it("includes row numbers", () => {
    const items = [{ n: 3, title: "Third", date: "2025-01-03" }];
    const result = batchFmtLineEls(items, 80);
    expect(result[0]).toContain("3");
  });

  it("truncates titles that exceed available width", () => {
    const items = [{ n: 1, title: "X".repeat(200), date: "2025-01-01" }];
    const result = batchFmtLineEls(items, 80);
    expect(result[0]).toContain("…");
  });
});

// ─── stripHtml ───────────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("removes HTML tags", () => {
    expect(stripHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("&amp;")).toBe("&");
    expect(stripHtml("&lt;p&gt;")).toBe("<p>");
  });

  it("decodes named umlaut entities (e.g. from WP category/tag names)", () => {
    expect(stripHtml("tagt&auml;glich")).toBe("tagtäglich");
  });

  it("trims whitespace", () => {
    expect(stripHtml("  <p>  hello  </p>  ")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });
});

// ─── applyConfig ─────────────────────────────────────────────────────────────

describe("applyConfig", () => {
  it("sets --fsize CSS variable", () => {
    applyConfig({ font: 18, theme: "a" });
    expect(document.documentElement.style.getPropertyValue("--fsize")).toBe("18px");
  });

  it("sets data-theme attribute for non-default theme", () => {
    applyConfig({ font: 22, theme: "b" });
    expect(document.documentElement.dataset.theme).toBe("b");
  });

  it("removes data-theme attribute for theme 'a'", () => {
    document.documentElement.dataset.theme = "c";
    applyConfig({ font: 22, theme: "a" });
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("sets data-scroll attribute for smooth scroll", () => {
    applyConfig({ font: 22, theme: "a", scroll: "smooth" });
    expect(document.documentElement.dataset.scroll).toBe("smooth");
  });

  it("removes data-scroll attribute for jump scroll (default)", () => {
    document.documentElement.dataset.scroll = "smooth";
    applyConfig({ font: 22, theme: "a", scroll: "jump" });
    expect(document.documentElement.dataset.scroll).toBeUndefined();
  });
});

// ─── loadConfig / saveConfig ──────────────────────────────────────────────────

describe("loadConfig / saveConfig", () => {
  beforeEach(() => {
    document.cookie = "hx29_config=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("returns defaults when no cookie exists", () => {
    const cfg = loadConfig();
    expect(cfg).toMatchObject({ font: 22, posts: 10, theme: "a", order: "desc" });
  });

  it("round-trips a saved config", () => {
    saveConfig({ font: 16, posts: 5, theme: "b", order: "asc" });
    const cfg = loadConfig();
    expect(cfg).toMatchObject({ font: 16, posts: 5, theme: "b", order: "asc" });
  });

  it("merges saved config with defaults", () => {
    saveConfig({ font: 14 });
    const cfg = loadConfig();
    expect(cfg.posts).toBe(10);
    expect(cfg.font).toBe(14);
  });
});

// ─── loadHistory / pushHistory ────────────────────────────────────────────────

describe("loadHistory / pushHistory", () => {
  beforeEach(() => {
    document.cookie = "hx29_history=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("returns empty array when no cookie exists", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("prepends new commands", () => {
    const ref = { current: [] };
    pushHistory(ref, "ls posts");
    pushHistory(ref, "read 1");
    expect(ref.current[0]).toBe("read 1");
    expect(ref.current[1]).toBe("ls posts");
  });

  it("deduplicates by moving repeated command to front", () => {
    const ref = { current: ["ls posts", "read 1"] };
    pushHistory(ref, "ls posts");
    expect(ref.current[0]).toBe("ls posts");
    expect(ref.current.filter((c) => c === "ls posts")).toHaveLength(1);
  });

  it("caps history at 25 entries", () => {
    const ref = { current: [] };
    for (let i = 0; i < 30; i++) pushHistory(ref, `cmd${i}`);
    expect(ref.current).toHaveLength(25);
  });

  it("persists to cookie and can be loaded back", () => {
    const ref = { current: [] };
    pushHistory(ref, "search foo");
    const loaded = loadHistory();
    expect(loaded).toContain("search foo");
  });
});
