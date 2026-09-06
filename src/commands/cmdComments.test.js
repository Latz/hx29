import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/comments.js", () => ({ fetchComments: vi.fn() }));
vi.mock("./postLookup.js", () => ({ resolvePost: vi.fn() }));
vi.mock("../utils.js", () => ({
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  formatDate: vi.fn(() => "1. Jan 2025"),
  wrapLines: vi.fn((lines) => lines),
  getLineWidth: vi.fn(() => 80),
}));
vi.mock("../i18n/index.js", () => ({
  t: {
    comments_usage: "Usage: comments <n>",
    comments_unknown_num: (n) => `comments: ${n}: not in list`,
    comments_none: "No comments.",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { fetchComments } from "../api/comments.js";
import { resolvePost } from "./postLookup.js";
import cmdComments from "./cmdComments.js";

const COMMENT = (id, author = "Alice", content = "Great post!") => ({
  id,
  author_name: author,
  date: "2025-01-01T00:00:00",
  content: { rendered: `<p>${content}</p>` },
});

beforeEach(() => vi.clearAllMocks());

describe("cmdComments", () => {
  it("returns usage when no args (NaN)", async () => {
    const result = await cmdComments([], { current: null });
    expect(result[0]).toContain("Usage: comments");
  });

  it("returns unknown_num when the number can't be resolved to any post", async () => {
    resolvePost.mockResolvedValue({ post: null, slug: "5" });
    const pager = { current: { slugMap: {} } };
    const result = await cmdComments(["5"], pager);
    expect(result[0]).toContain("5");
  });

  it("fetches comments for the post resolvePost resolves to", async () => {
    resolvePost.mockResolvedValue({ post: { id: 42 }, slug: "test" });
    fetchComments.mockResolvedValue([COMMENT(1)]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(resolvePost).toHaveBeenCalledWith("1", pager.current.slugMap);
    expect(fetchComments).toHaveBeenCalledWith(42);
    expect(result).toContainLineWithText("Alice");
  });

  it("returns no-comments message on empty array", async () => {
    resolvePost.mockResolvedValue({ post: { id: 42 }, slug: "test" });
    fetchComments.mockResolvedValue([]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result).toContain("No comments.");
  });

  it("includes author and date for each comment", async () => {
    resolvePost.mockResolvedValue({ post: { id: 42 }, slug: "test" });
    fetchComments.mockResolvedValue([COMMENT(1, "Charlie")]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result).toContainLineWithText("Charlie");
  });

  it("includes comment body text", async () => {
    resolvePost.mockResolvedValue({ post: { id: 42 }, slug: "test" });
    fetchComments.mockResolvedValue([COMMENT(1, "Alice", "Awesome article!")]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result).toContainLineWithText("Awesome article!");
  });

  // Live-testing finding: `tree`, `ls categories`, `ls tags`, and `ls pages`
  // all leave a non-post slugMap in the pager. `comments <n>` must resolve
  // via the post-or-fall-back-to-nth-most-recent path (same as cat/read),
  // not trust a category/tag/page id directly and show the wrong comments.
  it("still fetches the right post's comments when the pager's slugMap holds a stale category/tag entry", async () => {
    resolvePost.mockResolvedValue({ post: { id: 4 }, slug: "most-recent-post" });
    fetchComments.mockResolvedValue([COMMENT(1)]);
    const pager = { current: { slugMap: { 1: { slug: "news", id: 2, url: "http://x/category/news/" } } } };
    const result = await cmdComments(["1"], pager);
    expect(fetchComments).toHaveBeenCalledWith(4);
    expect(result).toContainLineWithText("Alice");
  });

  it("returns error on API failure", async () => {
    resolvePost.mockResolvedValue({ post: { id: 42 }, slug: "test" });
    fetchComments.mockRejectedValue(new Error("network fail"));
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result[0]).toContain("Error:");
  });
});
