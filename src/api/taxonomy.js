import apiFetch from "./apiFetch.js";

/**
 * Fetches a paginated list of categories (including empty ones).
 * @param {number} [page=1] - Page number (1-based).
 * @param {number} [pageSize=10] - Items per page.
 * @returns {Promise<{cats: Array<{id:number,slug:string,name:string,link:string}>, total: number}>}
 */
export async function fetchCategories(page = 1, pageSize = 10) {
  const res = await apiFetch(`/categories?per_page=${pageSize}&page=${page}&_fields=id,slug,name,link&hide_empty=false`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number.parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const cats = await res.json();
  return { cats, total };
}

/**
 * Fetches a paginated list of tags (including empty ones).
 * @param {number} [page=1] - Page number (1-based).
 * @param {number} [pageSize=10] - Items per page.
 * @returns {Promise<{tags: Array<{id:number,slug:string,name:string,link:string}>, total: number}>}
 */
export async function fetchTags(page = 1, pageSize = 10) {
  const res = await apiFetch(`/tags?per_page=${pageSize}&page=${page}&_fields=id,slug,name,link&hide_empty=false`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number.parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const tags = await res.json();
  return { tags, total };
}
