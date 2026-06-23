import { WP_API, NONCE } from "../config.js";

const CACHE_TTL = 60_000;
const FETCH_TIMEOUT = 8_000;
const _cache = new Map();

export class ApiError extends Error {
  constructor(type, status) {
    super(type);
    this.type = type;   // "timeout" | "rate_limit" | "server"
    this.status = status;
  }
}

function makeFakeResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchWithTimeout(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Sends an authenticated request to the WordPress REST API.
 * JSON responses are cached for 60 seconds by URL. Requests time out after 8 seconds.
 * Throws ApiError with type "timeout", "rate_limit", or "server" on failure.
 * @param {string} path - API path relative to the WP v2 base URL.
 * @returns {Promise<Response>} Fetch response — callers must check `res.ok`.
 */
export default async function apiFetch(path) {
  const url = `${WP_API}${path}`;
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return makeFakeResponse(hit.data);

  let res;
  try {
    res = await fetchWithTimeout(url, {
      headers: NONCE ? { "X-WP-Nonce": NONCE } : {},
      credentials: "same-origin",
    });
  } catch (e) {
    if (e.name === "AbortError") throw new ApiError("timeout", 0);
    throw e;
  }

  if (res.status === 429) throw new ApiError("rate_limit", 429);
  if (!res.ok) throw new ApiError("server", res.status);

  const data = await res.json();
  _cache.set(url, { data, ts: Date.now() });
  return makeFakeResponse(data);
}

/** Clears the client-side API cache (e.g. after a comment is posted). */
export function clearApiCache() {
  _cache.clear();
}
