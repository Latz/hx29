import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/comments.js", () => ({ postComment: vi.fn() }));
vi.mock("../i18n/index.js", () => ({
  t: {
    comment_usage: "Usage: comment <n> <text>",
    comment_no_text: "No comment text provided.",
    comment_unknown_num: (n) => `comment: ${n}: not in list`,
    comment_no_id: "comment: no post id",
    comment_saved: "Comment posted.",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { postComment } from "../api/comments.js";
import cmdComment from "./cmdComment.js";

beforeEach(() => vi.clearAllMocks());

describe("cmdComment", () => {
  it("returns usage when args < 2 (NaN + no text)", async () => {
    const result = await cmdComment([], { current: null });
    expect(result[0]).toContain("Usage: comment");
  });

  it("returns usage when n is NaN (non-numeric first arg, no second)", async () => {
    const result = await cmdComment(["hello"], { current: null });
    expect(result[0]).toContain("Usage: comment");
  });

  it("returns no_text when comment body is blank", async () => {
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdComment(["1", ""], pager);
    expect(result[0]).toMatch(/[Nn]o comment|[Uu]sage|text/i);
  });

  it("returns unknown_num when n not in slugMap", async () => {
    const pager = { current: { slugMap: {} } };
    const result = await cmdComment(["5", "hello"], pager);
    expect(result[0]).toContain("5");
  });

  it("returns no_id when entry has no id", async () => {
    const pager = { current: { slugMap: { 1: { slug: "test" } } } };
    const result = await cmdComment(["1", "hello"], pager);
    expect(result[0]).toContain("no post id");
  });

  it("posts comment for numbered post from slugMap", async () => {
    postComment.mockResolvedValue({ id: 99 });
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdComment(["1", "Great", "post!"], pager);
    expect(postComment).toHaveBeenCalledWith(42, "Great post!");
    expect(result[0]).toContain("Comment posted");
  });

  it("joins multi-word text args", async () => {
    postComment.mockResolvedValue({ id: 1 });
    const pager = { current: { slugMap: { 2: { id: 7, slug: "b" } } } };
    await cmdComment(["2", "Hello", "World"], pager);
    expect(postComment).toHaveBeenCalledWith(7, "Hello World");
  });

  it("returns error on API failure", async () => {
    postComment.mockRejectedValue(new Error("Forbidden"));
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdComment(["1", "Hello"], pager);
    expect(result[0]).toContain("Error:");
  });
});
