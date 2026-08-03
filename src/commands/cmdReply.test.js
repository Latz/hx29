import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/comments.js", () => ({ postComment: vi.fn() }));
vi.mock("../i18n/index.js", () => ({
  t: {
    reply_usage: "Usage: reply <n> <text>",
    reply_no_text: "No comment text provided.",
    reply_unknown_num: (n) => `reply: ${n}: not in list`,
    reply_no_id: "reply: no post id",
    reply_saved: "Comment posted.",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { postComment } from "../api/comments.js";
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
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdReply(["1", ""], pager);
    expect(result[0]).toMatch(/[Nn]o comment|[Uu]sage|text/i);
  });

  it("returns unknown_num when n not in slugMap", async () => {
    const pager = { current: { slugMap: {} } };
    const result = await cmdReply(["5", "hello"], pager);
    expect(result[0]).toContain("5");
  });

  it("returns no_id when entry has no id", async () => {
    const pager = { current: { slugMap: { 1: { slug: "test" } } } };
    const result = await cmdReply(["1", "hello"], pager);
    expect(result[0]).toContain("no post id");
  });

  it("posts comment for numbered post from slugMap", async () => {
    postComment.mockResolvedValue({ id: 99 });
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdReply(["1", "Great", "post!"], pager);
    expect(postComment).toHaveBeenCalledWith(42, "Great post!");
    expect(result[0]).toContain("Comment posted");
  });

  it("joins multi-word text args", async () => {
    postComment.mockResolvedValue({ id: 1 });
    const pager = { current: { slugMap: { 2: { id: 7, slug: "b" } } } };
    await cmdReply(["2", "Hello", "World"], pager);
    expect(postComment).toHaveBeenCalledWith(7, "Hello World");
  });

  it("returns error on API failure", async () => {
    postComment.mockRejectedValue(new Error("Forbidden"));
    const pager = { current: { slugMap: { 1: { id: 42, slug: "test" } } } };
    const result = await cmdReply(["1", "Hello"], pager);
    expect(result[0]).toContain("Error:");
  });
});
