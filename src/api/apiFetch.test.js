import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../config.js", () => ({
  WP_API: "https://example.com/wp-json/wp/v2",
  NONCE: "",
}));
vi.mock("@wordpress/api-fetch", () => ({
  default: vi.fn(),
}));

import wpApiFetch from "@wordpress/api-fetch";
import apiFetch, { ApiError, clearApiCache } from "./apiFetch.js";

function makeResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

beforeEach(() => {
  clearApiCache();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("apiFetch", () => {
  it("fetches and returns data on cache miss", async () => {
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 1 }]));
    const res = await apiFetch("/posts");
    const data = await res.json();
    expect(data).toEqual([{ id: 1 }]);
    expect(wpApiFetch).toHaveBeenCalledTimes(1);
  });

  it("returns cached data on cache hit without fetching again", async () => {
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 1 }]));
    await apiFetch("/posts");
    await apiFetch("/posts");
    expect(wpApiFetch).toHaveBeenCalledTimes(1);
  });

  it("refetches after cache TTL expires", async () => {
    vi.useFakeTimers();
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 1 }]));
    await apiFetch("/posts-ttl");
    vi.advanceTimersByTime(61_000);
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 2 }]));
    const res = await apiFetch("/posts-ttl");
    const data = await res.json();
    expect(data).toEqual([{ id: 2 }]);
    expect(wpApiFetch).toHaveBeenCalledTimes(2);
  });

  it("preserves X-WP-Total header through cache", async () => {
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 1 }], 200, { "X-WP-Total": "42" }));
    await apiFetch("/posts-total");
    const res = await apiFetch("/posts-total");
    expect(res.headers.get("X-WP-Total")).toBe("42");
  });

  it("preserves X-WP-TotalPages header through cache", async () => {
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 1 }], 200, { "X-WP-TotalPages": "5" }));
    await apiFetch("/posts-pages");
    const res = await apiFetch("/posts-pages");
    expect(res.headers.get("X-WP-TotalPages")).toBe("5");
  });

  it("throws ApiError('rate_limit') on 429", async () => {
    wpApiFetch.mockResolvedValue(new Response("", { status: 429 }));
    await expect(apiFetch("/posts-429")).rejects.toThrow(ApiError);
    await expect(apiFetch("/posts-429b")).rejects.toMatchObject({ type: "rate_limit" });
  });

  it("throws ApiError('server') on 5xx", async () => {
    wpApiFetch.mockResolvedValue(new Response("", { status: 500 }));
    await expect(apiFetch("/posts-500")).rejects.toMatchObject({ type: "server", status: 500 });
  });

  it("throws ApiError('parse_error') on invalid JSON", async () => {
    wpApiFetch.mockResolvedValue(new Response("not json", { status: 200 }));
    await expect(apiFetch("/posts-bad-json")).rejects.toMatchObject({ type: "parse_error" });
  });

  it("throws ApiError('timeout') when fetch is aborted", async () => {
    wpApiFetch.mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await expect(apiFetch("/posts-timeout")).rejects.toMatchObject({ type: "timeout" });
  });

  it("clearApiCache forces fresh fetch", async () => {
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 1 }]));
    await apiFetch("/posts-clear");
    clearApiCache();
    wpApiFetch.mockResolvedValue(makeResponse([{ id: 99 }]));
    const res = await apiFetch("/posts-clear");
    const data = await res.json();
    expect(data).toEqual([{ id: 99 }]);
    expect(wpApiFetch).toHaveBeenCalledTimes(2);
  });
});
