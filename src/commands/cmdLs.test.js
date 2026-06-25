import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/posts.js", () => ({ fetchPosts: vi.fn() }));
vi.mock("../api/pages.js", () => ({ fetchPages: vi.fn() }));
vi.mock("../api/taxonomy.js", () => ({ fetchCategories: vi.fn(), fetchTags: vi.fn() }));
vi.mock("../utils.js", () => ({
  batchFmtLineEls: vi.fn((items) => items.map((p) => `${p.n}. ${p.title}`)),
  getLineWidth: vi.fn(() => 80),
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  formatDate: vi.fn(() => "Jan 2025"),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    ls_posts_found: (n) => `${n} posts found`,
    ls_pages_found: (n) => `${n} pages found`,
    ls_categories_found: (n) => `${n} categories found`,
    ls_tags_found: (n) => `${n} tags found`,
    ls_no_posts: "No posts found.",
    ls_no_pages: "No pages found.",
    ls_no_categories: "No categories found.",
    ls_no_tags: "No tags found.",
    ls_not_found: (t) => `ls: unknown target: ${t}`,
    ls_sort_hint_asc: "Sorted: oldest first",
    ls_sort_hint_desc: "Sorted: newest first",
    more_posts: "[n]ext posts",
    more_pages: "[n]ext pages",
    more_categories: "[n]ext categories",
    more_tags: "[n]ext tags",
    cd_not_found: (s) => `cd: not found: ${s}`,
    ls_help: {},
    man_pages: { ls: ["ls help text"] },
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { fetchPosts } from "../api/posts.js";
import { fetchPages } from "../api/pages.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import cmdLs from "./cmdLs.js";

const POST = (n) => ({ id: n, slug: `post-${n}`, title: { rendered: `Post ${n}` }, date: "2025-01-01", link: "/" });
const PAGE = (n) => ({ id: n, slug: `page-${n}`, title: { rendered: `Page ${n}` }, link: "/" });
const CAT  = (n) => ({ id: n, slug: `cat-${n}`,  name: `Cat ${n}`,  link: "/" });
const TAG  = (n) => ({ id: n, slug: `tag-${n}`,  name: `Tag ${n}`,  link: "/" });

const configRef  = { current: { posts: 5, order: "desc" } };
const contextRef = { current: { type: null, id: null, name: null } };

beforeEach(() => {
  vi.clearAllMocks();
  contextRef.current = { type: null, id: null, name: null };
});

describe("cmdLs — posts", () => {
  it("lists posts with no args", async () => {
    fetchPosts.mockResolvedValue({ posts: [POST(1)], total: 1 });
    const pager = { current: null };
    const result = await cmdLs([], pager, configRef, contextRef);
    expect(result.some((l) => l.includes("1 posts found"))).toBe(true);
    expect(result).toContain("1. Post 1");
  });

  it("lists posts with explicit 'posts' arg", async () => {
    fetchPosts.mockResolvedValue({ posts: [POST(1)], total: 1 });
    const pager = { current: null };
    await cmdLs(["posts"], pager, configRef, contextRef);
    expect(fetchPosts).toHaveBeenCalled();
  });

  it("sets pager type to posts", async () => {
    fetchPosts.mockResolvedValue({ posts: [POST(1)], total: 1 });
    const pager = { current: null };
    await cmdLs([], pager, configRef, contextRef);
    expect(pager.current.type).toBe("posts");
  });

  it("shows more_posts indicator when total > page size", async () => {
    fetchPosts.mockResolvedValue({ posts: Array.from({ length: 5 }, (_, i) => POST(i + 1)), total: 20 });
    const pager = { current: null };
    const result = await cmdLs([], pager, configRef, contextRef);
    expect(result).toContain("[n]ext posts");
  });

  it("does not show more_posts when all loaded", async () => {
    fetchPosts.mockResolvedValue({ posts: [POST(1)], total: 1 });
    const pager = { current: null };
    const result = await cmdLs([], pager, configRef, contextRef);
    expect(result).not.toContain("[n]ext posts");
  });

  it("returns no-posts message on empty result", async () => {
    fetchPosts.mockResolvedValue({ posts: [], total: 0 });
    const result = await cmdLs([], { current: null }, configRef, contextRef);
    expect(result).toEqual(["No posts found."]);
  });

  it("passes asc order argument", async () => {
    fetchPosts.mockResolvedValue({ posts: [POST(1)], total: 1 });
    await cmdLs(["posts", "asc"], { current: null }, configRef, contextRef);
    expect(fetchPosts).toHaveBeenCalledWith(1, 5, "asc", {});
  });

  it("applies category context filter", async () => {
    contextRef.current = { type: "category", id: 3, name: "Tech" };
    fetchPosts.mockResolvedValue({ posts: [POST(1)], total: 1 });
    await cmdLs([], { current: null }, configRef, contextRef);
    expect(fetchPosts).toHaveBeenCalledWith(1, 5, "desc", { category: 3 });
  });

  it("applies tag context filter", async () => {
    contextRef.current = { type: "tag", id: 7, name: "rust" };
    fetchPosts.mockResolvedValue({ posts: [POST(1)], total: 1 });
    await cmdLs([], { current: null }, configRef, contextRef);
    expect(fetchPosts).toHaveBeenCalledWith(1, 5, "desc", { tag: 7 });
  });
});

describe("cmdLs — pages", () => {
  it("lists pages", async () => {
    fetchPages.mockResolvedValue({ pages: [PAGE(1)], total: 1 });
    const pager = { current: null };
    const result = await cmdLs(["pages"], pager, configRef, contextRef);
    expect(result.some((l) => l.includes("1 pages found"))).toBe(true);
    expect(pager.current.type).toBe("pages");
  });

  it("returns no-pages message on empty", async () => {
    fetchPages.mockResolvedValue({ pages: [], total: 0 });
    const result = await cmdLs(["pages"], { current: null }, configRef, contextRef);
    expect(result).toEqual(["No pages found."]);
  });
});

describe("cmdLs — categories", () => {
  it("lists categories with 'categories' arg", async () => {
    fetchCategories.mockResolvedValue({ cats: [CAT(1)], total: 1 });
    const pager = { current: null };
    const result = await cmdLs(["categories"], pager, configRef, contextRef);
    expect(result.some((l) => l.includes("1 categories found"))).toBe(true);
    expect(pager.current.type).toBe("categories");
  });

  it("lists categories with 'cats' alias", async () => {
    fetchCategories.mockResolvedValue({ cats: [CAT(1)], total: 1 });
    const pager = { current: null };
    await cmdLs(["cats"], pager, configRef, contextRef);
    expect(fetchCategories).toHaveBeenCalled();
  });
});

describe("cmdLs — tags", () => {
  it("lists tags", async () => {
    fetchTags.mockResolvedValue({ tags: [TAG(1)], total: 1 });
    const pager = { current: null };
    const result = await cmdLs(["tags"], pager, configRef, contextRef);
    expect(result.some((l) => l.includes("1 tags found"))).toBe(true);
    expect(pager.current.type).toBe("tags");
  });
});

describe("cmdLs — --all flag", () => {
  it("fetches all pages when 'posts --all' passed", async () => {
    // fetchAllPages uses page size 100; 102 total → 2 calls
    fetchPosts
      .mockResolvedValueOnce({ posts: Array.from({ length: 100 }, (_, i) => POST(i + 1)), total: 102 })
      .mockResolvedValueOnce({ posts: [POST(101), POST(102)], total: 102 });
    const pager = { current: null };
    const result = await cmdLs(["posts", "--all"], pager, configRef, contextRef);
    expect(fetchPosts).toHaveBeenCalledTimes(2);
    expect(fetchPosts).toHaveBeenCalledWith(1, 100, "desc", {});
    expect(result.some((l) => l.includes("102 posts found"))).toBe(true);
  });

  it("fetches only once when all items fit in first page", async () => {
    fetchPosts.mockResolvedValueOnce({ posts: [POST(1), POST(2), POST(3)], total: 3 });
    const pager = { current: null };
    const result = await cmdLs(["posts", "--all"], pager, configRef, contextRef);
    expect(fetchPosts).toHaveBeenCalledTimes(1);
    expect(result.some((l) => l.includes("3 posts found"))).toBe(true);
  });
});

describe("cmdLs — unknown target", () => {
  it("returns error for unknown target", async () => {
    const result = await cmdLs(["foobar"], { current: null }, configRef, contextRef);
    expect(result[0]).toContain("ls: unknown target: foobar");
  });
});
