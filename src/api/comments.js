import wpApiFetch from "@wordpress/api-fetch";
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
  try {
    return await wpApiFetch({
      path: "/wp/v2/comments",
      method: "POST",
      data: { post: postId, author_name: uid, author_email: `${uid}@hx29.local`, content },
    });
  } catch (err) {
    throw new Error(err.message || `HTTP ${err.code || "error"}`);
  }
}
