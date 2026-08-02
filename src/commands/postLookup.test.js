import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/posts.js", () => ({
  fetchPostBySlug: vi.fn(),
}));
vi.mock("../api/apiFetch.js", () => ({
  default: vi.fn(),
}));

import { fetchPostBySlug } from "../api/posts.js";
import apiFetch from "../api/apiFetch.js";
import { resolvePost } from "./postLookup.js";

const MOCK_POST = { slug: "test-post", title: { rendered: "Test Post" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolvePost", () => {
  it("resolves by slug via fetchPostBySlug when arg is not numeric", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const { post, slug } = await resolvePost("test-post", {});
    expect(fetchPostBySlug).toHaveBeenCalledWith("test-post");
    expect(apiFetch).not.toHaveBeenCalled();
    expect(post).toBe(MOCK_POST);
    expect(slug).toBe("test-post");
  });

  it("resolves the display slug from the pager slugMap for a numeric ordinal and fetches by that slug", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const { post, slug } = await resolvePost("1", { 1: { slug: "test-post" } });
    expect(fetchPostBySlug).toHaveBeenCalledWith("test-post");
    expect(apiFetch).not.toHaveBeenCalled();
    expect(post).toBe(MOCK_POST);
    expect(slug).toBe("test-post");
  });

  it("resolves the display slug from a plain-string slugMap entry and fetches by that slug", async () => {
    fetchPostBySlug.mockResolvedValue(MOCK_POST);
    const { slug } = await resolvePost("1", { 1: "test-post" });
    expect(fetchPostBySlug).toHaveBeenCalledWith("test-post");
    expect(slug).toBe("test-post");
  });

  it("falls back to the nth-most-recent-post API fetch when the ordinal isn't in slugMap", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => [MOCK_POST],
    });
    const { post, slug } = await resolvePost("3", {});
    expect(fetchPostBySlug).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("page=3"));
    expect(post).toBe(MOCK_POST);
    expect(slug).toBe("3");
  });

  it("returns a null post when the ordinal-fallback fetch response is not ok", async () => {
    apiFetch.mockResolvedValue({ ok: false });
    const { post } = await resolvePost("3", {});
    expect(post).toBeNull();
  });

  it("returns a null post when the ordinal-fallback fetch returns no posts", async () => {
    apiFetch.mockResolvedValue({ ok: true, json: async () => [] });
    const { post } = await resolvePost("3", {});
    expect(post).toBeNull();
  });

  it("returns a null post when the slug isn't found", async () => {
    fetchPostBySlug.mockResolvedValue(null);
    const { post } = await resolvePost("nonexistent", {});
    expect(post).toBeNull();
  });
});
