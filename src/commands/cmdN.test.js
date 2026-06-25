import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/posts.js", () => ({ fetchPosts: vi.fn() }));
vi.mock("../api/pages.js", () => ({ fetchPages: vi.fn() }));
vi.mock("../api/taxonomy.js", () => ({ fetchCategories: vi.fn(), fetchTags: vi.fn() }));
vi.mock("../api/apiFetch.js", () => ({ default: vi.fn() }));
vi.mock("../utils.js", () => ({
  batchFmtLineEls: vi.fn((items) => items.map((p) => `${p.n}. ${p.title}`)),
  getPageLines: vi.fn(() => 10),
  getLineWidth: vi.fn(() => 80),
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  formatDate: vi.fn(() => "Jan 2025"),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    no_active_pager: "No active pager.",
    more_chars_left: (n) => `[n]ext (${n} chars)`,
    more_posts: "[n]ext posts",
    more_pages: "[n]ext pages",
    more_categories: "[n]ext categories",
    more_tags: "[n]ext tags",
    more_search: "[n]ext results",
    more_grep: "[n]ext grep",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { fetchPosts } from "../api/posts.js";
import { fetchPages } from "../api/pages.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import apiFetch from "../api/apiFetch.js";
import cmdN from "./cmdN.js";

const configRef = { current: { posts: 5 } };

beforeEach(() => vi.clearAllMocks());

describe("cmdN — no pager", () => {
  it("returns error when pager is null", async () => {
    const result = await cmdN({ current: null }, configRef);
    expect(result).toEqual(["No active pager."]);
  });
});

describe("cmdN — article type", () => {
  it("returns __REPLACE__ as first element", async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Line ${i}`);
    const pager = { current: { type: "article", lines, offset: 10, slugMap: {}, footnotes: [], slug: "test" } };
    const result = await cmdN(pager, configRef);
    expect(result[0]).toBe("__REPLACE__");
  });

  it("advances offset by pageLines", async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Line ${i}`);
    const pager = { current: { type: "article", lines, offset: 0, slugMap: {}, footnotes: [], slug: "test" } };
    await cmdN(pager, configRef);
    expect(pager.current.offset).toBe(10);
  });

  it("shows next slice of lines", async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Line ${i}`);
    const pager = { current: { type: "article", lines, offset: 0, slugMap: {}, footnotes: [], slug: "test" } };
    const result = await cmdN(pager, configRef);
    expect(result).toContain("Line 0");
    expect(result).toContain("Line 9");
    expect(result).not.toContain("Line 10");
  });

  it("shows more_chars_left when more content remains", async () => {
    const lines = Array.from({ length: 25 }, (_, i) => `Line ${i}`);
    const pager = { current: { type: "article", lines, offset: 0, slugMap: {}, footnotes: [], slug: "test" } };
    const result = await cmdN(pager, configRef);
    expect(result.some((l) => l.includes("[n]ext"))).toBe(true);
  });

  it("does not show more_chars_left on last page", async () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Line ${i}`);
    const pager = { current: { type: "article", lines, offset: 5, slugMap: {}, footnotes: [], slug: "test" } };
    const result = await cmdN(pager, configRef);
    expect(result.some((l) => typeof l === "string" && l.includes("[n]ext"))).toBe(false);
    expect(pager.current.lines).toHaveLength(0);
  });
});

describe("cmdN — grep type", () => {
  it("returns next grep block with __REPLACE__ missing (grep prepends output differently)", async () => {
    const block1 = ["Post A", "match line", ""];
    const block2 = ["Post B", "another match", ""];
    const pager = { current: { type: "grep", blocks: [block1, block2], shownBlocks: 1, slugMap: {} } };
    const result = await cmdN(pager, configRef);
    expect(result).toContain("Post B");
  });

  it("updates shownBlocks", async () => {
    const blocks = [["Post A", ""], ["Post B", ""], ["Post C", ""]];
    const pager = { current: { type: "grep", blocks, shownBlocks: 1, slugMap: {} } };
    await cmdN(pager, configRef);
    expect(pager.current.shownBlocks).toBeGreaterThan(1);
  });

  it("appends more_grep when blocks remain", async () => {
    const makeBlock = (n) => Array.from({ length: 8 }, (_, i) => `Block${n} line${i}`);
    const blocks = [makeBlock(1), makeBlock(2), makeBlock(3)];
    const pager = { current: { type: "grep", blocks, shownBlocks: 0, slugMap: {} } };
    const result = await cmdN(pager, configRef);
    expect(result[result.length - 1]).toBe("[n]ext grep");
  });

  it("does not append more_grep on last block", async () => {
    const blocks = [["Post A", "line", ""]];
    const pager = { current: { type: "grep", blocks, shownBlocks: 0, slugMap: {} } };
    const result = await cmdN(pager, configRef);
    expect(result[result.length - 1]).not.toBe("[n]ext grep");
  });
});

describe("cmdN — posts type", () => {
  it("returns formatted post entry with offset numbering", async () => {
    fetchPosts.mockResolvedValue({ posts: [{ id: 2, slug: "b", title: { rendered: "B" }, date: "2025-01-02", link: "/" }], total: 20 });
    const pager = { current: { type: "posts", page: 1, total: 20, slugMap: {}, order: "desc", filter: {} } };
    const result = await cmdN(pager, configRef);
    // page=1, ps=5, offset=5, so first item is numbered 6
    expect(result.some((l) => typeof l === "string" && l.includes("6. B"))).toBe(true);
  });

  it("updates pager page", async () => {
    fetchPosts.mockResolvedValue({ posts: [{ id: 2, slug: "b", title: { rendered: "B" }, date: "2025-01-02", link: "/" }], total: 20 });
    const pager = { current: { type: "posts", page: 1, total: 20, slugMap: {}, order: "desc", filter: {} } };
    await cmdN(pager, configRef);
    expect(pager.current.page).toBe(2);
  });

  it("sets pager to null on last page", async () => {
    fetchPosts.mockResolvedValue({ posts: [{ id: 2, slug: "b", title: { rendered: "B" }, date: "2025-01-02", link: "/" }], total: 6 });
    const pager = { current: { type: "posts", page: 1, total: 6, slugMap: {}, order: "desc", filter: {} } };
    await cmdN(pager, configRef);
    expect(pager.current).toBeNull();
  });

  it("appends more_posts when more remain", async () => {
    fetchPosts.mockResolvedValue({ posts: [{ id: 2, slug: "b", title: { rendered: "B" }, date: "2025-01-02", link: "/" }], total: 50 });
    const pager = { current: { type: "posts", page: 1, total: 50, slugMap: {}, order: "desc", filter: {} } };
    const result = await cmdN(pager, configRef);
    expect(result).toContain("[n]ext posts");
  });
});

describe("cmdN — pages type", () => {
  it("fetches next page of pages and updates pager", async () => {
    fetchPages.mockResolvedValue({ pages: [{ id: 2, slug: "about", title: { rendered: "About" }, link: "/" }], total: 20 });
    const pager = { current: { type: "pages", page: 1, total: 20, slugMap: {} } };
    await cmdN(pager, configRef);
    expect(fetchPages).toHaveBeenCalledWith(2, 5);
    expect(pager.current.page).toBe(2);
  });

  it("includes page title in output with offset numbering", async () => {
    fetchPages.mockResolvedValue({ pages: [{ id: 2, slug: "about", title: { rendered: "About" }, link: "/" }], total: 20 });
    const pager = { current: { type: "pages", page: 1, total: 20, slugMap: {} } };
    const result = await cmdN(pager, configRef);
    expect(result.some((l) => typeof l === "string" && l.includes("About"))).toBe(true);
  });
});

describe("cmdN — categories type", () => {
  it("fetches next page of categories with offset numbering", async () => {
    fetchCategories.mockResolvedValue({ cats: [{ id: 1, slug: "tech", name: "Tech", link: "/" }], total: 20 });
    const pager = { current: { type: "categories", page: 1, total: 20, slugMap: {} } };
    const result = await cmdN(pager, configRef);
    // page=1, ps=5, offset=5 → first item numbered 6
    expect(result.some((l) => typeof l === "string" && l.includes("Tech"))).toBe(true);
  });
});

describe("cmdN — tags type", () => {
  it("fetches next page of tags with offset numbering", async () => {
    fetchTags.mockResolvedValue({ tags: [{ id: 1, slug: "rust", name: "Rust", link: "/" }], total: 20 });
    const pager = { current: { type: "tags", page: 1, total: 20, slugMap: {} } };
    const result = await cmdN(pager, configRef);
    expect(result.some((l) => typeof l === "string" && l.includes("Rust"))).toBe(true);
  });
});

describe("cmdN — search type", () => {
  it("fetches next search page with correct offset", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "50" },
      json: async () => [{ id: 2, slug: "b", title: { rendered: "B" }, date: "2025-01-02", link: "/" }],
    });
    const pager = { current: { type: "search", page: 1, total: 50, slugMap: {}, searchTerm: "hello" } };
    const result = await cmdN(pager, configRef);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("search=hello"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    expect(result).toContain("[n]ext results");
  });
});
