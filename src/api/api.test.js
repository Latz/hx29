import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./apiFetch.js", () => {
  class ApiError extends Error {
    constructor(type, status) {
      super(type);
      this.type = type;
      this.status = status;
    }
  }
  return { default: vi.fn(), ApiError };
});
vi.mock("../config.js", () => ({
  WP_API: "https://example.com/wp-json/wp/v2",
  NONCE: "",
}));
vi.mock("@wordpress/api-fetch", () => ({
  default: vi.fn(),
}));

import apiFetch from "./apiFetch.js";
import wpApiFetch from "@wordpress/api-fetch";
import { fetchPosts, fetchPostBySlug } from "./posts.js";
import { fetchPages } from "./pages.js";
import { fetchCategories, fetchTags } from "./taxonomy.js";
import { fetchComments, postComment, fetchCommentCount } from "./comments.js";

function makeRes(data, headers = {}) {
  return {
    ok: true,
    headers: { get: (k) => headers[k] ?? null },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("fetchPosts", () => {
  it("calls correct endpoint with defaults", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "0" }));
    await fetchPosts();
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/posts?per_page=10&page=1&orderby=date&order=desc"));
  });

  it("appends category filter", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "0" }));
    await fetchPosts(1, 10, "desc", { category: 5 });
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("&categories=5"));
  });

  it("appends tag filter", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "0" }));
    await fetchPosts(1, 10, "asc", { tag: 7 });
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("&tags=7"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("order=asc"));
  });

  it("returns posts and total", async () => {
    const posts = [{ id: 1, slug: "hello", title: { rendered: "Hello" }, date: "2025-01-01", link: "/" }];
    apiFetch.mockResolvedValue(makeRes(posts, { "X-WP-Total": "1" }));
    const result = await fetchPosts();
    expect(result.posts).toEqual(posts);
    expect(result.total).toBe(1);
  });
});

describe("fetchPostBySlug", () => {
  it("calls correct endpoint with encoded slug", async () => {
    apiFetch.mockResolvedValue(makeRes([{ id: 1 }]));
    await fetchPostBySlug("my post");
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("slug=my%20post"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("_embed=wp%3Aterm"));
  });

  it("returns first post when found", async () => {
    const post = { id: 42, slug: "hello" };
    apiFetch.mockResolvedValue(makeRes([post]));
    const result = await fetchPostBySlug("hello");
    expect(result).toEqual(post);
  });

  it("returns null when no posts found", async () => {
    apiFetch.mockResolvedValue(makeRes([]));
    const result = await fetchPostBySlug("missing");
    expect(result).toBeNull();
  });
});

describe("fetchPages", () => {
  it("calls correct endpoint", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "0" }));
    await fetchPages(2, 5);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/pages?per_page=5&page=2"));
  });

  it("returns pages and total", async () => {
    const pages = [{ id: 1, slug: "about", title: { rendered: "About" }, link: "/" }];
    apiFetch.mockResolvedValue(makeRes(pages, { "X-WP-Total": "1" }));
    const result = await fetchPages();
    expect(result.pages).toEqual(pages);
    expect(result.total).toBe(1);
  });
});

describe("fetchCategories", () => {
  it("calls correct endpoint with hide_empty=false", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "0" }));
    await fetchCategories();
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/categories?"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("hide_empty=false"));
  });

  it("returns cats and total", async () => {
    const cats = [{ id: 1, slug: "tech", name: "Tech", link: "/" }];
    apiFetch.mockResolvedValue(makeRes(cats, { "X-WP-Total": "1" }));
    const result = await fetchCategories();
    expect(result.cats).toEqual(cats);
    expect(result.total).toBe(1);
  });
});

describe("fetchTags", () => {
  it("calls correct endpoint", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "0" }));
    await fetchTags(1, 20);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/tags?per_page=20"));
  });

  it("returns tags and total", async () => {
    const tags = [{ id: 2, slug: "rust", name: "Rust", link: "/" }];
    apiFetch.mockResolvedValue(makeRes(tags, { "X-WP-Total": "1" }));
    const result = await fetchTags();
    expect(result.tags).toEqual(tags);
    expect(result.total).toBe(1);
  });
});

describe("fetchComments", () => {
  it("calls correct endpoint with post id", async () => {
    apiFetch.mockResolvedValue(makeRes([]));
    await fetchComments(99);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/comments?post=99"));
  });

  it("returns comment array", async () => {
    const comments = [{ id: 1, author_name: "Alice", date: "2025-01-01", content: { rendered: "<p>Hi</p>" } }];
    apiFetch.mockResolvedValue(makeRes(comments));
    const result = await fetchComments(1);
    expect(result).toEqual(comments);
  });
});

describe("fetchCommentCount", () => {
  it("calls the comments endpoint with per_page=1", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "0" }));
    await fetchCommentCount(99);
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("/comments?post=99"));
    expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining("per_page=1"));
  });

  it("returns the total from the X-WP-Total header", async () => {
    apiFetch.mockResolvedValue(makeRes([], { "X-WP-Total": "7" }));
    const result = await fetchCommentCount(1);
    expect(result).toBe(7);
  });

  it("returns 0 when the header is missing", async () => {
    apiFetch.mockResolvedValue(makeRes([]));
    const result = await fetchCommentCount(1);
    expect(result).toBe(0);
  });

  it("throws on a non-ok response", async () => {
    apiFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(fetchCommentCount(1)).rejects.toThrow("HTTP 500");
  });
});

describe("postComment", () => {
  it("POSTs to the comments endpoint", async () => {
    wpApiFetch.mockResolvedValue({ id: 1 });
    await postComment(42, "Hello!");
    expect(wpApiFetch).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/wp/v2/comments", method: "POST" })
    );
  });

  it("includes post id and content in body", async () => {
    wpApiFetch.mockResolvedValue({ id: 1 });
    await postComment(42, "Test comment");
    const call = wpApiFetch.mock.calls[0][0];
    expect(call.data.post).toBe(42);
    expect(call.data.content).toBe("Test comment");
  });

  it("throws on rejected request", async () => {
    wpApiFetch.mockRejectedValue({ message: "Forbidden", code: "rest_forbidden" });
    await expect(postComment(1, "hi")).rejects.toThrow("Forbidden");
  });

  // robustness.md Medium #9: postComment bypassed apiFetch.js's timeout
  // layer entirely — a hung POST could block indefinitely with no
  // user-visible timeout.
  it("aborts and rejects with a timeout ApiError after 8s", async () => {
    vi.useFakeTimers();
    wpApiFetch.mockImplementation(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            const err = new Error("The user aborted a request.");
            err.name = "AbortError";
            reject(err);
          });
        })
    );

    const promise = postComment(42, "hi");
    const assertion = expect(promise).rejects.toMatchObject({ type: "timeout" });
    await vi.advanceTimersByTimeAsync(8000);
    await assertion;

    vi.useRealTimers();
  });

  it("passes an AbortSignal through to wpApiFetch", async () => {
    wpApiFetch.mockResolvedValue({ id: 1 });
    await postComment(42, "hi");
    const call = wpApiFetch.mock.calls[0][0];
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });
});
