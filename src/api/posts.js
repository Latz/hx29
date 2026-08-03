import { addQueryArgs } from "@wordpress/url";
import apiFetch from "./apiFetch.js";

/**
 * Fetches a paginated list of WordPress posts.
 * @param {number} [page=1] - Page number (1-based).
 * @param {number} [pageSize=10] - Items per page.
 * @param {"asc"|"desc"} [order="desc"] - Date sort direction.
 * @param {{category?: number, tag?: number}} [filter={}] - Optional taxonomy filters.
 * @returns {Promise<{posts: Array<{id:number,slug:string,title:{rendered:string},date:string,link:string}>, total: number}>}
 */
export async function fetchPosts(page = 1, pageSize = 10, order = "desc", filter = {}) {
  const url = addQueryArgs("/posts", {
    per_page: pageSize,
    page,
    orderby: "date",
    order,
    _fields: "id,slug,title,date,link",
    ...(filter.category ? { categories: filter.category } : {}),
    ...(filter.tag ? { tags: filter.tag } : {}),
  });
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number.parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const posts = await res.json();
  return { posts, total };
}

/**
 * Fetches a single post by slug, embedding taxonomy terms.
 * @param {string} slug - Post slug.
 * @returns {Promise<Object|null>} Full post object with `_embedded["wp:term"]`, or null if not found.
 */
export async function fetchPostBySlug(slug) {
  const res = await apiFetch(addQueryArgs("/posts", { slug, _embed: "wp:term" }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const posts = await res.json();
  if (!posts.length) return null;
  return posts[0];
}
