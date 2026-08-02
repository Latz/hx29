import wpApiFetch from "@wordpress/api-fetch";
import { WP_API } from "../config.js";

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

/**
 * Builds a `Response`-like object from cached/parsed JSON data so cache hits
 * can be returned through the same interface as a live fetch.
 * @param {*} data - Parsed JSON body.
 * @param {Object<string,string>} [extraHeaders] - Additional response headers to attach.
 * @returns {Response} A `Response` wrapping the given data.
 */
function makeFakeResponse(data, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

/**
 * Runs `wpApiFetch` against a WP v2 path, aborting after `FETCH_TIMEOUT` ms.
 * @param {string} path - API path relative to the WP v2 base URL.
 * @returns {Promise<Response>} The raw (unparsed) fetch response.
 */
function fetchWithTimeout(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  return wpApiFetch({ path, signal: controller.signal, parse: false }).finally(() => clearTimeout(timer));
}

/**
 * Sends an authenticated request to the WordPress REST API via @wordpress/api-fetch
 * (nonce and root-URL middleware configured in config.js).
 * JSON responses are cached for 60 seconds by URL. Requests time out after 8 seconds.
 * Throws ApiError with type "timeout", "rate_limit", or "server" on failure.
 * @param {string} path - API path relative to the WP v2 base URL.
 * @returns {Promise<Response>} Fetch response — callers must check `res.ok`.
 */
export default async function apiFetch(path) {
  const url = `${WP_API}${path}`;
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return makeFakeResponse(hit.data, hit.headers);

  let res;
  try {
    res = await fetchWithTimeout(`/wp/v2${path}`);
  } catch (e) {
    if (e.name === "AbortError") throw new ApiError("timeout", 0);
    throw e;
  }

  if (res.status === 429) throw new ApiError("rate_limit", 429);
  if (!res.ok) throw new ApiError("server", res.status);

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError("parse_error", res.status);
  }
  const headers = {};
  const wpTotal = res.headers.get("X-WP-Total");
  if (wpTotal) headers["X-WP-Total"] = wpTotal;
  const wpTotalPages = res.headers.get("X-WP-TotalPages");
  if (wpTotalPages) headers["X-WP-TotalPages"] = wpTotalPages;
  _cache.set(url, { data, headers, ts: Date.now() });
  return makeFakeResponse(data, headers);
}

/** Clears the client-side API cache (e.g. after a comment is posted). */
export function clearApiCache() {
  _cache.clear();
}
