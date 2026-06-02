import { WP_API, NONCE } from "../config.js";

/**
 * Sends an authenticated request to the WordPress REST API.
 * @param {string} path - API path relative to the WP v2 base URL (e.g. `/posts?per_page=10`).
 * @returns {Promise<Response>} Fetch response — callers must check `res.ok`.
 */
export default function apiFetch(path) {
  return fetch(`${WP_API}${path}`, {
    headers: NONCE ? { "X-WP-Nonce": NONCE } : {},
    credentials: "same-origin",
  });
}
