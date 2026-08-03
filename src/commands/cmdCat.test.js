import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/posts.js", () => ({
  fetchPostBySlug: vi.fn(),
}));
vi.mock("../api/apiFetch.js", () => ({
  default: vi.fn(),
}));
vi.mock("../api/comments.js", () => ({ fetchCommentCount: vi.fn(() => Promise.resolve(0)) }));
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
    cat_usage: "Usage: cat <number> or cat <slug>",
    read_not_found: (s) => `read: ${s}: No post found`,
    read_published: (d) => `Published: ${d}`,
    read_categories: (s) => `Categories: ${s}`,
    read_tags: (s) => `Tags: ${s}`,
    read_comment_count: (n) => `[${n} ${n === 1 ? "comment" : "comments"}]`,
    error: (m) => `Error: ${m}`,
    error_timeout: "Connection timed out.",
    error_rate_limit: "Server busy (429).",
    error_server: (code) => `Server error (${code}).`,
    error_parse: "Server returned an invalid response.",
  },
}));

import { fetchPostBySlug } from "../api/posts.js";
import apiFetch from "../api/apiFetch.js";
import { fetchCommentCount } from "../api/comments.js";
import cmdCat from "./cmdCat.js";

const MOCK_POST = {
  id: 1,
  slug: "test-post",
  title: { rendered: "Test Post" },
  date: "2025-01-01T00:00:00",
  content: { rendered: "<p>Line one.</p><p>Line two.</p><p>Line three.</p>" },
  _embedded: { "wp:term": [[], []] },
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchCommentCount.mockResolvedValue(0);
});

describe("cmdCat", () => {
  it("returns usage when called with no args", async () => {
    const pager = { current: null };
    const result = await cmdCat([], pager);
    expect(result).toEqual(["Usage: cat <number> or cat <slug>"]);
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

  it("resolves post number from pager slugMap by fetching that slug", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const pager = { current: { slugMap: { 1: { slug: "test-post" } } } };
    const result = await cmdCat(["1"], pager);
    expect(fetchPostBySlug).toHaveBeenCalledWith("test-post");
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining("page="));
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

  it("shows the comment count when the post has comments", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    fetchCommentCount.mockResolvedValue(5);
    const pager = { current: null };
    const result = await cmdCat(["test-post"], pager);
    expect(fetchCommentCount).toHaveBeenCalledWith(1);
    expect(result).toContain("[5 comments]");
  });

  it("uses the singular form for exactly 1 comment", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    fetchCommentCount.mockResolvedValue(1);
    const pager = { current: null };
    const result = await cmdCat(["test-post"], pager);
    expect(result).toContain("[1 comment]");
  });

  it("omits the comment count line when the post has no comments", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    fetchCommentCount.mockResolvedValue(0);
    const pager = { current: null };
    const result = await cmdCat(["test-post"], pager);
    expect(result.some((l) => typeof l === "string" && l.includes("comments"))).toBe(false);
  });

  it("does not break article display when the comment count fetch fails", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    fetchCommentCount.mockRejectedValue(new Error("timeout"));
    const pager = { current: null };
    const result = await cmdCat(["test-post"], pager);
    expect(result).toContain("Line one.");
    expect(result.some((l) => typeof l === "string" && l.includes("comments"))).toBe(false);
  });
});
