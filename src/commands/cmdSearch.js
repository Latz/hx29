import { t } from "../i18n/index.js";
import apiFetch from "../api/apiFetch.js";
import { batchFmtLineEls, getLineWidth, stripHtml, formatDate } from "../utils.js";

/**
 * Searches posts by keyword via the WP REST API full-text search.
 * @param {string[]} args - Search term tokens (joined with spaces).
 * @param {import('react').MutableRefObject<Object|null>} pager - Shared pager state ref; updated with search result state.
 * @param {import('react').MutableRefObject<{font:number,posts:number,theme:string,order:string}>} configRef - User config ref (provides page size).
 * @returns {Promise<string[]>} Formatted result lines.
 */
export default async function cmdSearch(args, pager, configRef) {
  if (!args.length) return [t.search_usage];
  const term = args.join(" ");
  const ps = configRef.current.posts;
  try {
    const res = await apiFetch(`/posts?search=${encodeURIComponent(term)}&per_page=${ps}&_fields=id,slug,title,date,link`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
    const posts = await res.json();
    if (!posts.length) return [t.search_no_results(term)];
    const hasMore = total > ps;
    const slugMap = {};
    posts.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
    pager.current = hasMore ? { type: "search", page: 1, total, slugMap, searchTerm: term } : null;
    const cols = getLineWidth();
    return [
      t.search_found(total, term),
      "",
      ...batchFmtLineEls(posts.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
      ...(hasMore ? ["", t.more_search] : []),
    ];
  } catch (e) {
    return [t.error(e.message)];
  }
}
