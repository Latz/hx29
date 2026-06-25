import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/comments.js", () => ({ fetchComments: vi.fn() }));
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
    comments_no_id: "comments: no post id",
    comments_none: "No comments.",
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { fetchComments } from "../api/comments.js";
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

  it("returns unknown_num when n is not in slugMap", async () => {
    const pager = { current: { slugMap: {} } };
    const result = await cmdComments(["5"], pager);
    expect(result[0]).toContain("5");
  });

  it("returns no_id when slugMap entry has no id", async () => {
    const pager = { current: { slugMap: { 1: { slug: "test" } } } };
    const result = await cmdComments(["1"], pager);
    expect(result[0]).toContain("no post id");
  });

  it("fetches comments for post from pager slugMap", async () => {
    fetchComments.mockResolvedValue([COMMENT(1)]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(fetchComments).toHaveBeenCalledWith(42);
    expect(result).toContainLineWithText("Alice");
  });

  it("returns no-comments message on empty array", async () => {
    fetchComments.mockResolvedValue([]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result).toContain("No comments.");
  });

  it("includes author and date for each comment", async () => {
    fetchComments.mockResolvedValue([COMMENT(1, "Charlie")]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result).toContainLineWithText("Charlie");
  });

  it("includes comment body text", async () => {
    fetchComments.mockResolvedValue([COMMENT(1, "Alice", "Awesome article!")]);
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result).toContainLineWithText("Awesome article!");
  });

  it("returns error on API failure", async () => {
    fetchComments.mockRejectedValue(new Error("network fail"));
    const pager = { current: { slugMap: { 1: { slug: "test", id: 42 } } } };
    const result = await cmdComments(["1"], pager);
    expect(result[0]).toContain("Error:");
  });
});
