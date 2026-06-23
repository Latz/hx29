import { WP_API, NONCE } from "../config.js";

const CACHE_TTL = 60_000;
const _cache = new Map();

function makeFakeResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Sends an authenticated request to the WordPress REST API.
 * JSON responses are cached for 60 seconds by URL.
 * @param {string} path - API path relative to the WP v2 base URL (e.g. `/posts?per_page=10`).
 * @returns {Promise<Response>} Fetch response — callers must check `res.ok`.
 */
export default async function apiFetch(path) {
  const url = `${WP_API}${path}`;
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return makeFakeResponse(hit.data);

  const res = await fetch(url, {
    headers: NONCE ? { "X-WP-Nonce": NONCE } : {},
    credentials: "same-origin",
  });
  if (res.ok) {
    const data = await res.json();
    _cache.set(url, { data, ts: Date.now() });
    return makeFakeResponse(data);
  }
  return res;
}

/** Clears the client-side API cache (e.g. after a comment is posted). */
export function clearApiCache() {
  _cache.clear();
}
