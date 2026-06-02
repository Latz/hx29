import { WP_API, NONCE } from "../config.js";
import apiFetch from "./apiFetch.js";

/**
 * Fetches comments for a post.
 * @param {number} postId - WordPress post ID.
 * @param {number} [perPage=20] - Maximum number of comments to return.
 * @returns {Promise<Array<{id:number,author_name:string,date:string,content:{rendered:string}}>>}
 */
export async function fetchComments(postId, perPage = 20) {
  const res = await apiFetch(`/comments?post=${postId}&per_page=${perPage}&_fields=id,author_name,date,content`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Posts a new comment on behalf of the current visitor.
 * Author name is read from `window.hx29.uid` at call time, defaulting to `"guest"`.
 * @param {number} postId - WordPress post ID to comment on.
 * @param {string} content - Plain-text comment body.
 * @returns {Promise<Object>} The created comment object returned by the REST API.
 */
export async function postComment(postId, content) {
  const uid = (typeof window !== "undefined" && window.hx29?.uid) || "guest";
  const res = await fetch(`${WP_API}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(NONCE ? { "X-WP-Nonce": NONCE } : {}),
    },
    credentials: "same-origin",
    body: JSON.stringify({ post: postId, author_name: uid, author_email: `${uid}@hx29.local`, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}
