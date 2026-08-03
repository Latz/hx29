import { addQueryArgs } from "@wordpress/url";
import apiFetch from "./apiFetch.js";

/**
 * Fetches a paginated list of WordPress pages.
 * @param {number} [page=1] - Page number (1-based).
 * @param {number} [pageSize=10] - Items per page.
 * @returns {Promise<{pages: Array<{id:number,slug:string,title:{rendered:string},link:string}>, total: number}>}
 */
export async function fetchPages(page = 1, pageSize = 10) {
  const res = await apiFetch(addQueryArgs("/pages", { per_page: pageSize, page, _fields: "id,slug,title,link" }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number.parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const pages = await res.json();
  return { pages, total };
}
