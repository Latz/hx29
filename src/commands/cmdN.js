import { addQueryArgs } from "@wordpress/url";
import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchPosts } from "../api/posts.js";
import { fetchPages } from "../api/pages.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import apiFetch from "../api/apiFetch.js";
import { batchFmtLineEls, getPageLines, getLineWidth, stripHtml, formatDate } from "../utils.js";
import { RESOURCE_SPECS } from "./resourceSpecs.js";

/**
 * Advances the article pager (already-fetched, locally-paginated lines).
 * @param {import('react').RefObject<Object>} pager - Shared pager state ref.
 * @returns {Array<string|import('react').ReactElement>} Next page of article lines.
 */
function nextArticlePage(pager) {
  const { lines, offset, slugMap, footnotes, slug } = pager.current;
  const pageLines = getPageLines();
  const slice = lines.slice(offset, offset + pageLines);
  const nextOffset = offset + pageLines;
  const hasMore = nextOffset < lines.length;
  pager.current = hasMore
    ? { type: "article", lines, offset: nextOffset, slugMap, footnotes, slug }
    : { type: "article", lines: [], offset: 0, slugMap, footnotes, slug };
  if (hasMore) {
    const charsLeft = lines.slice(nextOffset).reduce((s, l) => s + (typeof l === "string" ? l.length : 0), 0);
    return [...slice, "", t.more_chars_left(charsLeft)];
  }
  return [...slice, ""];
}

/**
 * Advances the grep-results pager (already-fetched, locally-paginated blocks).
 * @param {import('react').RefObject<Object>} pager - Shared pager state ref.
 * @returns {Array<string|import('react').ReactElement>} Next page of grep result lines.
 */
function nextGrepPage(pager) {
  const { blocks, shownBlocks, slugMap } = pager.current;
  const pageLines = getPageLines();
  const nextPage = [];
  let newShown = shownBlocks;
  for (let i = shownBlocks; i < blocks.length; i++) {
    if (nextPage.length + blocks[i].length > pageLines) break;
    nextPage.push(...blocks[i]);
    newShown++;
  }
  const remaining = blocks.length - newShown;
  pager.current = { type: "grep", blocks, shownBlocks: newShown, slugMap };
  return remaining > 0 ? [...nextPage, t.more_grep] : [...nextPage, ""];
}

/**
 * Builds the next-page result lines for a remotely-fetched list pager
 * (search/posts/pages/categories/tags), updating `pager.current` and the slugMap.
 * @param {Object} params
 * @param {string} params.type - Pager type.
 * @param {Array<Object>} params.items - Items fetched for the next page.
 * @param {number} params.fetchedTotal - Total reported by this fetch, used if `total` was unset.
 * @param {import('react').RefObject<Object>} params.pager - Shared pager state ref.
 * @param {number} params.nextPage - The page number just fetched.
 * @param {number} params.offset - slugMap index offset (items already shown before this page).
 * @param {number} params.ps - Page size.
 * @param {number|undefined} params.total - Previously known total, if any.
 * @param {Object} params.extraPagerFields - Extra fields to persist on `pager.current` (order/filter/searchTerm).
 * @param {function(Object, number): {n:number,slug:string,id:number,url:string,title:string,date:string}} params.mapItem - Maps a raw item + slugMap index to its display/slugMap fields.
 * @param {string} params.moreMessage - Localized "more" hint shown when another page remains.
 * @param {number} params.cols - Terminal column width.
 * @returns {Array<string|import('react').ReactElement>} Rendered result lines.
 */
function paginateListResult({ type, items, fetchedTotal, pager, nextPage, offset, ps, total, extraPagerFields, mapItem, moreMessage, cols }) {
  const shown = nextPage * ps;
  const hasMore = shown < (total ?? fetchedTotal);
  const slugMap = pager.current.slugMap;
  const mapped = items.map((item, i) => mapItem(item, offset + i + 1));
  mapped.forEach(({ n, slug, id, url }) => { slugMap[n] = { slug, id, url }; });
  pager.current = hasMore
    ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap, ...extraPagerFields }
    : null;
  return [
    ...batchFmtLineEls(mapped.map(({ n, title, date }) => ({ n, title, date })), cols),
    ...(hasMore ? ["", moreMessage] : [""]),
  ];
}

/**
 * Fetches and paginates the next page of search results.
 * @param {import('react').RefObject<Object>} pager - Shared pager state ref.
 * @param {number} ps - Page size.
 * @param {number} nextPage - The page number to fetch.
 * @param {number} offset - slugMap index offset.
 * @param {number} cols - Terminal column width.
 * @param {number|undefined} total - Previously known total, if any.
 * @returns {Promise<Array<string|import('react').ReactElement>>} Rendered result lines.
 */
async function nextSearchPage(pager, ps, nextPage, offset, cols, total) {
  const { searchTerm } = pager.current;
  const res = await apiFetch(addQueryArgs("/posts", { search: searchTerm, per_page: ps, page: nextPage, _fields: "id,slug,title,date,link" }));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const fetchedTotal = Number.parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const posts = await res.json();
  return paginateListResult({
    type: "search", items: posts, fetchedTotal, pager, nextPage, offset, ps, total,
    extraPagerFields: { searchTerm },
    mapItem: (p, n) => ({ n, slug: p.slug, id: p.id, url: p.link, title: stripHtml(p.title.rendered), date: formatDate(p.date) }),
    moreMessage: t.more_search, cols,
  });
}

/**
 * Fetches and paginates the next page of posts (the one resource with its
 * own extra order/filter args, so it keeps a thin wrapper rather than going
 * through `nextResourcePage` directly).
 * @param {import('react').RefObject<Object>} pager - Shared pager state ref.
 * @param {number} ps - Page size.
 * @param {number} nextPage - The page number to fetch.
 * @param {number} offset - slugMap index offset.
 * @param {number} cols - Terminal column width.
 * @param {number|undefined} total - Previously known total, if any.
 * @returns {Promise<Array<string|import('react').ReactElement>>} Rendered result lines.
 */
async function nextPostsPage(pager, ps, nextPage, offset, cols, total) {
  const ord = pager.current.order || "desc";
  const fil = pager.current.filter || {};
  const { posts, total: fetchedTotal } = await fetchPosts(nextPage, ps, ord, fil);
  return paginateListResult({
    type: "posts", items: posts, fetchedTotal, pager, nextPage, offset, ps, total,
    extraPagerFields: { order: ord, filter: fil },
    mapItem: RESOURCE_SPECS.posts.mapItem,
    moreMessage: t.more_posts, cols,
  });
}

/**
 * Fetches and paginates the next page of a plain resource (pages, categories,
 * or tags — no extra args beyond page/pageSize), driven by its `RESOURCE_SPECS` entry.
 * @param {string} key - `RESOURCE_SPECS` key (`"pages"|"categories"|"tags"`).
 * @param {function(page:number, pageSize:number):Promise<Object>} fetcher - API fetch function for this resource.
 * @param {import('react').RefObject<Object>} pager - Shared pager state ref.
 * @param {number} ps - Page size.
 * @param {number} nextPage - The page number to fetch.
 * @param {number} offset - slugMap index offset.
 * @param {number} cols - Terminal column width.
 * @param {number|undefined} total - Previously known total, if any.
 * @returns {Promise<Array<string|import('react').ReactElement>>} Rendered result lines.
 */
async function nextResourcePage(key, fetcher, pager, ps, nextPage, offset, cols, total) {
  const spec = RESOURCE_SPECS[key];
  const result = await fetcher(nextPage, ps);
  const items = result[spec.itemsKey];
  return paginateListResult({
    type: key, items, fetchedTotal: result.total, pager, nextPage, offset, ps, total,
    extraPagerFields: {},
    mapItem: spec.mapItem,
    moreMessage: spec.moreMsg, cols,
  });
}

const LIST_HANDLERS = {
  search: nextSearchPage,
  posts: nextPostsPage,
  pages: (pager, ps, nextPage, offset, cols, total) => nextResourcePage("pages", fetchPages, pager, ps, nextPage, offset, cols, total),
  categories: (pager, ps, nextPage, offset, cols, total) => nextResourcePage("categories", fetchCategories, pager, ps, nextPage, offset, cols, total),
  tags: (pager, ps, nextPage, offset, cols, total) => nextResourcePage("tags", fetchTags, pager, ps, nextPage, offset, cols, total),
};

/**
 * Advances the active pager to the next page (bound to `n` and `m` commands).
 * Handles article pagination, grep result blocks, and all list types (posts/pages/categories/tags/search).
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated with next-page state.
 * @param {import('react').RefObject<{font:number,posts:number,theme:string,order:string}>} configRef - User config ref (provides page size).
 * @returns {Promise<Array<string|import('react').ReactElement>>} Next page of content lines.
 */
export default async function cmdN(pager, configRef) {
  if (!pager.current) return [t.no_active_pager];
  const { type, page, total } = pager.current;

  if (type === "article") return nextArticlePage(pager);
  if (type === "grep") return nextGrepPage(pager);

  const handler = LIST_HANDLERS[type];
  if (!handler) return [];

  const ps = configRef.current.posts;
  const nextPage = page + 1;
  const offset = page * ps;
  const cols = getLineWidth();

  try {
    return await handler(pager, ps, nextPage, offset, cols, total);
  } catch (e) {
    return [fmtApiError(e)];
  }
}
