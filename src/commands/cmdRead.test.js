import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/posts.js", () => ({ fetchPostBySlug: vi.fn() }));
vi.mock("../api/apiFetch.js", () => ({ default: vi.fn() }));
vi.mock("../utils.js", () => ({
  parseBodyWithLinks: vi.fn(() => ({ lines: Array.from({ length: 5 }, (_, i) => `Body line ${i + 1}`), footerLines: [], footnotes: [] })),
  getPageLines: vi.fn(() => 100),
  getLineWidth: vi.fn(() => 80),
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  formatDate: vi.fn(() => "1. Jan. 2025"),
  wordWrap: vi.fn((s) => [s]),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    read_usage: "Usage: read <slug|n>",
    read_not_found: (s) => `read: ${s}: not found`,
    read_published: (d) => `Published: ${d}`,
    read_categories: (s) => `Categories: ${s}`,
    read_tags: (s) => `Tags: ${s}`,
    more_chars_left: (n) => `[n]ext (${n} chars remaining)`,
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { fetchPostBySlug } from "../api/posts.js";
import apiFetch from "../api/apiFetch.js";
import { getPageLines, parseBodyWithLinks } from "../utils.js";
import cmdRead from "./cmdRead.js";

const MOCK_POST = {
  slug: "hello-world",
  title: { rendered: "Hello World" },
  date: "2025-01-01T00:00:00",
  content: { rendered: "<p>Body content here.</p>" },
  _embedded: { "wp:term": [[], []] },
};

beforeEach(() => {
  vi.clearAllMocks();
  getPageLines.mockReturnValue(100);
});

describe("cmdRead", () => {
  it("returns usage when called with no args", async () => {
    const result = await cmdRead([], { current: null });
    expect(result).toEqual(["Usage: read <slug|n>"]);
  });

  it("fetches post by slug and returns header + body lines", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const pager = { current: null };
    const result = await cmdRead(["hello-world"], pager);
    expect(result.some((l) => typeof l === "string" && l.includes("Hello World"))).toBe(true);
    expect(result.some((l) => typeof l === "string" && l.includes("Body line 1"))).toBe(true);
  });

  it("returns not-found error when post is missing", async () => {
    fetchPostBySlug.mockResolvedValue(null);
    const result = await cmdRead(["missing-slug"], { current: null });
    expect(result[0]).toContain("not found");
  });

  it("fetches by ordinal number when not in slugMap", async () => {
    fetchPostBySlug.mockResolvedValue(null);
    apiFetch.mockResolvedValue({ ok: true, json: async () => [MOCK_POST], headers: { get: () => null } });
    const pager = { current: null };
    await cmdRead(["3"], pager);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=3"));
  });

  it("resolves number from pager slugMap and fetches via apiFetch ordinal", async () => {
    // slugMap resolves slug var but ordinal fetch still goes through apiFetch
    apiFetch.mockResolvedValue({ ok: true, json: async () => [MOCK_POST], headers: { get: () => null } });
    const pager = { current: { slugMap: { 1: { slug: "hello-world" } } } };
    await cmdRead(["1"], pager);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=1"));
  });

  it("sets pager.current with hasMore=false for short posts", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const pager = { current: null };
    await cmdRead(["hello-world"], pager);
    expect(pager.current.type).toBe("article");
    expect(pager.current.lines).toHaveLength(0);
    expect(pager.current.offset).toBe(0);
  });

  it("sets pager.current with hasMore=true and returns more_chars_left for long posts", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    getPageLines.mockReturnValue(3);
    const pager = { current: null };
    const result = await cmdRead(["hello-world"], pager);
    expect(pager.current.lines.length).toBeGreaterThan(0);
    expect(result.some((l) => typeof l === "string" && l.includes("[n]ext"))).toBe(true);
  });

  it("more_chars_left shows a real number, not NaN", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    getPageLines.mockReturnValue(3);
    const pager = { current: null };
    const result = await cmdRead(["hello-world"], pager);
    const moreLine = result.find((l) => typeof l === "string" && l.includes("[n]ext"));
    expect(moreLine).toBeDefined();
    expect(moreLine).not.toContain("NaN");
  });

  it("preserves slugMap from prior pager state", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const pager = { current: { slugMap: { 1: { slug: "other" } } } };
    await cmdRead(["hello-world"], pager);
    expect(pager.current.slugMap).toEqual({ 1: { slug: "other" } });
  });

  it("includes read time estimate in date line", async () => {
    fetchPostBySlug.mockResolvedValue({ ...MOCK_POST, content: { rendered: "word ".repeat(400) } });
    const pager = { current: null };
    const result = await cmdRead(["hello-world"], pager);
    expect(result.some((l) => typeof l === "string" && l.includes("min read"))).toBe(true);
  });

  it("returns error string on API exception", async () => {
    fetchPostBySlug.mockRejectedValue(new Error("network fail"));
    const result = await cmdRead(["bad"], { current: null });
    expect(result[0]).toContain("Error:");
  });

  it("shows category and tag lines when post has terms", async () => {
    const post = { ...MOCK_POST, _embedded: { "wp:term": [[{ name: "Tech" }], [{ name: "rust" }]] } };
    fetchPostBySlug.mockResolvedValue(post);
    const result = await cmdRead(["hello-world"], { current: null });
    const text = result.filter((l) => typeof l === "string").join("\n");
    expect(text).toMatch(/Tech|rust/);
  });
});
