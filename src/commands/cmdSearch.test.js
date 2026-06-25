import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/apiFetch.js", () => ({ default: vi.fn() }));
vi.mock("../utils.js", () => ({
  batchFmtLineEls: vi.fn((items) => items.map((p) => `${p.n}. ${p.title}`)),
  getLineWidth: vi.fn(() => 80),
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  formatDate: vi.fn(() => "Jan 2025"),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    search_usage: "Usage: search <term>",
    search_found: (n, t) => `${n} results for "${t}"`,
    search_no_results: (t) => `No results for "${t}"`,
    more_search: "[n]ext results",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import apiFetch from "../api/apiFetch.js";
import cmdSearch from "./cmdSearch.js";

const configRef = { current: { posts: 5 } };

function mockRes(posts, total) {
  return {
    ok: true,
    headers: { get: () => String(total) },
    json: async () => posts,
  };
}

const POST = (n) => ({
  id: n, slug: `post-${n}`,
  title: { rendered: `Post ${n}` },
  date: "2025-01-01", link: "/",
  excerpt: { rendered: `<p>Excerpt ${n}</p>` },
});

beforeEach(() => vi.clearAllMocks());

describe("cmdSearch", () => {
  it("returns usage when no args", async () => {
    const result = await cmdSearch([], { current: null }, configRef);
    expect(result).toEqual(["Usage: search <term>"]);
  });

  it("joins multi-word args into a single search term", async () => {
    apiFetch.mockResolvedValue(mockRes([], 0));
    await cmdSearch(["hello", "world"], { current: null }, configRef);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("search=hello%20world"));
  });

  it("returns no-results message when empty", async () => {
    apiFetch.mockResolvedValue(mockRes([], 0));
    const result = await cmdSearch(["missing"], { current: null }, configRef);
    expect(result[0]).toContain('No results for "missing"');
  });

  it("returns formatted results", async () => {
    apiFetch.mockResolvedValue(mockRes([POST(1)], 1));
    const result = await cmdSearch(["hello"], { current: null }, configRef);
    expect(result.some((l) => l.includes('results for "hello"'))).toBe(true);
    expect(result).toContain("1. Post 1");
  });

  it("includes excerpt in output", async () => {
    apiFetch.mockResolvedValue(mockRes([POST(1)], 1));
    const result = await cmdSearch(["hello"], { current: null }, configRef);
    expect(result.some((l) => l.includes("Excerpt 1"))).toBe(true);
  });

  it("sets pager state when more results exist", async () => {
    apiFetch.mockResolvedValue(mockRes([POST(1), POST(2), POST(3), POST(4), POST(5)], 20));
    const pager = { current: null };
    const result = await cmdSearch(["hello"], pager, configRef);
    expect(pager.current).not.toBeNull();
    expect(pager.current.type).toBe("search");
    expect(pager.current.searchTerm).toBe("hello");
    expect(result).toContain("[n]ext results");
  });

  it("does not set pager when all results fit", async () => {
    apiFetch.mockResolvedValue(mockRes([POST(1)], 1));
    const pager = { current: null };
    await cmdSearch(["hello"], pager, configRef);
    expect(pager.current).toBeNull();
  });

  it("builds slugMap for results", async () => {
    apiFetch.mockResolvedValue(mockRes([POST(1), POST(2)], 2));
    const pager = { current: null };
    await cmdSearch(["hello"], pager, configRef);
    expect(pager.current).toBeNull(); // fits on one page
  });

  it("returns error on API failure", async () => {
    apiFetch.mockRejectedValue(new Error("network error"));
    const result = await cmdSearch(["hello"], { current: null }, configRef);
    expect(result[0]).toContain("Error:");
  });
});
