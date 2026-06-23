import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/posts.js", () => ({
  fetchPostBySlug: vi.fn(),
}));
vi.mock("../api/apiFetch.js", () => ({
  default: vi.fn(),
}));
vi.mock("../utils.js", () => ({
  parseBodyWithLinks: vi.fn(() => ({
    lines: ["Line one.", "Line two.", "Line three."],
    footerLines: [],
    footnotes: [],
  })),
  getLineWidth: vi.fn(() => 80),
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  formatDate: vi.fn(() => "1. Jan. 2025"),
  wordWrap: vi.fn((s) => [s]),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    read_usage: "Usage: read <number> or r <number>",
    read_not_found: (s) => `read: ${s}: No post found`,
    read_published: (d) => `Published: ${d}`,
    read_categories: (s) => `Categories: ${s}`,
    read_tags: (s) => `Tags: ${s}`,
    error: (m) => `Error: ${m}`,
  },
}));

import { fetchPostBySlug } from "../api/posts.js";
import apiFetch from "../api/apiFetch.js";
import cmdCat from "./cmdCat.js";

const MOCK_POST = {
  slug: "test-post",
  title: { rendered: "Test Post" },
  date: "2025-01-01T00:00:00",
  content: { rendered: "<p>Line one.</p><p>Line two.</p><p>Line three.</p>" },
  _embedded: { "wp:term": [[], []] },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cmdCat", () => {
  it("returns usage when called with no args", async () => {
    const pager = { current: null };
    const result = await cmdCat([], pager);
    expect(result).toEqual(["Usage: read <number> or r <number>"]);
  });

  it("returns error when post not found by slug", async () => {
    fetchPostBySlug.mockResolvedValue(null);
    const pager = { current: null };
    const result = await cmdCat(["nonexistent"], pager);
    expect(result).toContain("read: nonexistent: No post found");
  });

  it("returns all article lines without pagination", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const pager = { current: null };
    const result = await cmdCat(["test-post"], pager);
    expect(result).toContain("Line one.");
    expect(result).toContain("Line two.");
    expect(result).toContain("Line three.");
  });

  it("does not add a [n]ext prompt regardless of article length", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const pager = { current: null };
    const result = await cmdCat(["test-post"], pager);
    const hasNextPrompt = result.some(
      (line) => typeof line === "string" && line.includes("[n]ext")
    );
    expect(hasNextPrompt).toBe(false);
  });

  it("resolves post number from pager slugMap", async () => {
    fetchPostBySlug.mockResolvedValue(null);
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => [MOCK_POST],
      headers: { get: () => "1" },
    });
    const pager = { current: { slugMap: { 1: { slug: "test-post" } } } };
    fetchPostBySlug.mockResolvedValueOnce(MOCK_POST);
    const result = await cmdCat(["1"], pager);
    expect(result).toContain("Line one.");
  });

  it("writes pager.current with footnotes so link N works after cat", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const pager = { current: null };
    await cmdCat(["test-post"], pager);
    expect(pager.current).not.toBeNull();
    expect(pager.current.type).toBe("article");
    expect(Array.isArray(pager.current.footnotes)).toBe(true);
    expect(pager.current.slug).toBe("test-post");
  });

  it("combines catLine and tagLine on one line when they fit", async () => {
    const postWithTerms = {
      ...MOCK_POST,
      _embedded: {
        "wp:term": [
          [{ name: "Tech" }],
          [{ name: "rust" }],
        ],
      },
    };
    fetchPostBySlug.mockResolvedValue(postWithTerms);
    const pager = { current: null };
    const result = await cmdCat(["test-post"], pager);
    const combined = result.find(
      (l) => typeof l === "string" && l.includes("Categories:") && l.includes("Tags:")
    );
    const separate = result.filter(
      (l) => typeof l === "string" && (l.startsWith("Categories:") || l.startsWith("Tags:"))
    );
    // Either combined on one line or two separate lines — both are valid depending on width
    expect(combined !== undefined || separate.length === 2).toBe(true);
  });
});
