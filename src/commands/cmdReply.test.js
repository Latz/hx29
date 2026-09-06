import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/comments.js", () => ({ postComment: vi.fn() }));
vi.mock("../api/apiFetch.js", () => ({ clearApiCache: vi.fn() }));
vi.mock("./postLookup.js", () => ({ resolvePost: vi.fn() }));
vi.mock("../i18n/index.js", () => ({
  t: {
    reply_usage: "Usage: reply <n> <text>",
    reply_no_text: "No comment text provided.",
    reply_unknown_num: (n) => `reply: ${n}: not in list`,
    reply_saved: "Comment posted.",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { postComment } from "../api/comments.js";
import { resolvePost } from "./postLookup.js";
import cmdReply from "./cmdReply.js";

beforeEach(() => vi.clearAllMocks());

describe("cmdReply", () => {
  it("returns usage when args < 2 (NaN + no text)", async () => {
    const result = await cmdReply([], { current: null });
    expect(result[0]).toContain("Usage: reply");
  });

  it("returns usage when n is NaN (non-numeric first arg, no second)", async () => {
    const result = await cmdReply(["hello"], { current: null });
    expect(result[0]).toContain("Usage: reply");
  });

  it("returns no_text when comment body is blank", async () => {
    const result = await cmdReply(["1", ""], { current: null });
    expect(result[0]).toMatch(/[Nn]o comment|[Uu]sage|text/i);
  });

  it("returns unknown_num when the number can't be resolved to any post", async () => {
    resolvePost.mockResolvedValue({ post: null, slug: "5" });
    const pager = { current: { slugMap: {} } };
    const result = await cmdReply(["5", "hello"], pager);
    expect(result[0]).toContain("5");
  });

  it("posts comment for the post resolvePost resolves to", async () => {
    resolvePost.mockResolvedValue({ post: { id: 42 }, slug: "test" });
    postComment.mockResolvedValue({ id: 99 });
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdReply(["1", "Great", "post!"], pager);
    expect(resolvePost).toHaveBeenCalledWith("1", pager.current.slugMap);
    expect(postComment).toHaveBeenCalledWith(42, "Great post!");
    expect(result[0]).toContain("Comment posted");
  });

  it("joins multi-word text args", async () => {
    resolvePost.mockResolvedValue({ post: { id: 7 }, slug: "b" });
    postComment.mockResolvedValue({ id: 1 });
    const pager = { current: { slugMap: { 2: { id: 7, slug: "b" } } } };
    await cmdReply(["2", "Hello", "World"], pager);
    expect(postComment).toHaveBeenCalledWith(7, "Hello World");
  });

  // Live-testing finding: `tree`, `ls categories`, `ls tags`, and `ls pages`
  // all leave a non-post slugMap in the pager. `reply <n>` must resolve via
  // the post-or-fall-back-to-nth-most-recent path (same as cat/read), not
  // trust a category/tag/page id directly and post to the wrong content.
  it("still posts to the right post when the pager's slugMap holds a stale category/tag entry", async () => {
    // resolvePost's own fallback already resolved past the non-post entry —
    // this test only asserts cmdReply uses whatever post resolvePost returns.
    resolvePost.mockResolvedValue({ post: { id: 4 }, slug: "most-recent-post" });
    postComment.mockResolvedValue({ id: 1 });
    const pager = { current: { slugMap: { 1: { slug: "news", id: 2, url: "http://x/category/news/" } } } };
    const result = await cmdReply(["1", "nice"], pager);
    expect(postComment).toHaveBeenCalledWith(4, "nice");
    expect(result[0]).toContain("Comment posted");
  });

  it("returns error on API failure", async () => {
    resolvePost.mockResolvedValue({ post: { id: 42 }, slug: "test" });
    postComment.mockRejectedValue(new Error("Forbidden"));
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdReply(["1", "Hello"], pager);
    expect(result[0]).toContain("Error:");
  });
});
