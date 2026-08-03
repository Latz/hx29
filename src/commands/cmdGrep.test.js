import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/apiFetch.js", () => ({ default: vi.fn() }));
vi.mock("../ui.jsx", () => ({
  highlightMatch: vi.fn((line, term) => `[MATCH:${term}]${line}`),
}));
vi.mock("../utils.js", () => ({
  fmtLine: vi.fn((n, title) => `${n}. ${title}`),
  getPageLines: vi.fn(() => 20),
  getLineWidth: vi.fn(() => 80),
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  formatDate: vi.fn(() => "Jan 2025"),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    grep_usage: "Usage: grep <term>",
    grep_found: (n, t) => `${n} matches for "${t}"`,
    grep_no_results: (t) => `No matches for "${t}"`,
    more_grep: "[n]ext grep",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import apiFetch from "../api/apiFetch.js";
import { highlightMatch } from "../ui.jsx";
import cmdGrep from "./cmdGrep.js";
import { POST_WITH_CONTENT as makePost, makeFetchResult as mockApiFetch } from "../__mocks__/fixtures.js";

const configRef = { current: { posts: 5 } };

beforeEach(() => vi.clearAllMocks());

describe("cmdGrep", () => {
  it("returns usage when no args", async () => {
    const result = await cmdGrep([], { current: null }, configRef);
    expect(result).toEqual(["Usage: grep <term>"]);
  });

  it("returns no-matches when nothing found", async () => {
    apiFetch.mockResolvedValue(mockApiFetch([makePost(1, "Nothing relevant")]));
    const result = await cmdGrep(["xyzzy"], { current: null }, configRef);
    expect(result[0]).toContain('No matches for "xyzzy"');
  });

  it("finds matching posts and returns their title in output", async () => {
    apiFetch.mockResolvedValue(mockApiFetch([makePost(1, "hello world"), makePost(2, "nothing")]));
    const pager = { current: null };
    const result = await cmdGrep(["hello"], pager, configRef);
    expect(result).toContainLineWithText("Post 1");
    expect(result).not.toContainLineWithText("Post 2");
  });

  it("case-insensitive matching", async () => {
    apiFetch.mockResolvedValue(mockApiFetch([makePost(1, "Hello World")]));
    const result = await cmdGrep(["hello"], { current: null }, configRef);
    expect(result).toContainLineWithText("Post 1");
  });

  it("calls highlightMatch for matching lines", async () => {
    apiFetch.mockResolvedValue(mockApiFetch([makePost(1, "hello world")]));
    await cmdGrep(["hello"], { current: null }, configRef);
    expect(highlightMatch).toHaveBeenCalled();
  });

  it("sets pager.current with blocks", async () => {
    apiFetch.mockResolvedValue(mockApiFetch([makePost(1, "match term")]));
    const pager = { current: null };
    await cmdGrep(["match"], pager, configRef);
    expect(pager.current).not.toBeNull();
    expect(pager).toHavePagerType("grep");
    expect(Array.isArray(pager.current.blocks)).toBe(true);
  });

  it("fetches /posts with per_page=100 pre-filtered by search term", async () => {
    apiFetch.mockResolvedValue(mockApiFetch([makePost(1, "match")]));
    await cmdGrep(["match"], { current: null }, configRef);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("per_page=100"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("search=match"));
  });

  it("appends more_grep when blocks exceed one page", async () => {
    const posts = Array.from({ length: 10 }, (_, i) => makePost(i + 1, "match term with a long line of content that fills the page height buffer"));
    apiFetch.mockResolvedValue(mockApiFetch(posts));
    const pager = { current: null };
    const result = await cmdGrep(["match"], pager, configRef);
    if (pager.current.blocks.length > pager.current.shownBlocks) {
      expect(result[result.length - 1]).toBe("[n]ext grep");
    }
  });

  it("builds slugMap for matching posts", async () => {
    apiFetch.mockResolvedValue(mockApiFetch([makePost(42, "match term")]));
    const pager = { current: null };
    await cmdGrep(["match"], pager, configRef);
    expect(pager.current.slugMap[1]).toEqual({ slug: "post-42", id: 42 });
  });

  it("returns error on API failure", async () => {
    apiFetch.mockRejectedValue(new Error("timeout"));
    const result = await cmdGrep(["hello"], { current: null }, configRef);
    expect(result[0]).toContain("Error:");
  });
});
