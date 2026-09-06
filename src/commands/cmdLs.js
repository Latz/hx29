import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchPosts } from "../api/posts.js";
import { fetchPages } from "../api/pages.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import { batchFmtLineEls, getLineWidth, stripHtml } from "../utils.js";
import { RESOURCE_SPECS } from "./resourceSpecs.js";

const FETCH_ALL_CONCURRENCY = 5;

/**
 * Picks the item array out of a fetcher's result, whatever its key is named.
 * @param {{posts?:Array,pages?:Array,cats?:Array,tags?:Array}} result - A single fetcher response.
 * @param {string} itemsKey - The resource's items key (`RESOURCE_SPECS[key].itemsKey`).
 * @returns {Array} The result's item list.
 */
function extractItems(result, itemsKey) {
  return result[itemsKey];
}

/**
 * Exhaustively fetches all pages of a paginated API resource.
 * Fetches page 1 first to discover the total, then fetches remaining pages in
 * concurrency-capped batches (avoids firing dozens of simultaneous requests on large sites).
 * @param {function(page:number, pageSize:number):Promise<Object>} fetcher - API fetch function.
 * @param {string} itemsKey - The resource's items key (`RESOURCE_SPECS[key].itemsKey`).
 * @returns {Promise<{items:Array,total:number}>} All items concatenated with the total count.
 */
async function fetchAllPages(fetcher, itemsKey) {
  const PAGE_SIZE = 100;
  const first = await fetcher(1, PAGE_SIZE);
  const total = first.total;
  const firstItems = extractItems(first, itemsKey);

  const remaining = Math.ceil((total - firstItems.length) / PAGE_SIZE);
  if (remaining <= 0) return { items: firstItems, total };

  const pageNumbers = Array.from({ length: remaining }, (_, i) => i + 2);
  const rest = [];
  for (let i = 0; i < pageNumbers.length; i += FETCH_ALL_CONCURRENCY) {
    const batch = pageNumbers.slice(i, i + FETCH_ALL_CONCURRENCY);
    const results = await Promise.all(batch.map((p) => fetcher(p, PAGE_SIZE)));
    for (const r of results) rest.push(...extractItems(r, itemsKey));
  }
  return { items: [...firstItems, ...rest], total };
}

/**
 * Fetches either every page (`--all`) or just the first page of a resource.
 * @param {function(page:number, pageSize:number):Promise<Object>} fetcher - API fetch function.
 * @param {string} itemsKey - The resource's items key (`RESOURCE_SPECS[key].itemsKey`).
 * @param {boolean} showAll - Whether to fetch all pages.
 * @param {number} ps - Page size for a single-page fetch.
 * @returns {Promise<{items:Array,total:number}>} Items and total count.
 */
async function fetchListItems(fetcher, itemsKey, showAll, ps) {
  if (showAll) return fetchAllPages(fetcher, itemsKey);
  const result = await fetcher(1, ps);
  return { items: extractItems(result, itemsKey), total: result.total };
}

/**
 * Resolves the sort order and category/tag filter for `ls posts` from context + args.
 * @param {string[]} args - Full `ls` argument list (target already consumed at index 0).
 * @param {import('react').RefObject<{category:{id:number}|null,tag:{id:number}|null}>} contextRef - Active taxonomy context.
 * @param {"asc"|"desc"} configOrder - Fallback sort order from user config.
 * @returns {Promise<{order:string,filter:Object}|{error:string[]}>} Resolved order/filter, or an error to return immediately.
 */
async function resolvePostsFilter(args, contextRef, configOrder) {
  const orderArg = args[1]?.toLowerCase();
  const order = orderArg === "asc" || orderArg === "desc" ? orderArg : configOrder;
  const filter = {};
  const ctx = contextRef.current;
  if (ctx.category) filter.category = ctx.category.id;
  if (ctx.tag) filter.tag = ctx.tag.id;

  const tagArg = args.slice(1).find((a) => a !== "asc" && a !== "desc" && !a.startsWith("--"));
  if (!tagArg) return { order, filter };

  try {
    const { tags: allTags } = await fetchTags(1, 100);
    const found = allTags.find((tg) => tg.slug === tagArg || stripHtml(tg.name).toLowerCase() === tagArg.toLowerCase());
    if (!found) return { error: [t.cd_not_found(tagArg)] };
    filter.tag = found.id;
    return { order, filter };
  } catch (e) {
    return { error: [fmtApiError(e)] };
  }
}

/**
 * Fetches and renders the first page of a resource listing (posts, pages,
 * categories, or tags), driven by its `RESOURCE_SPECS` entry.
 * @param {string} key - `RESOURCE_SPECS` key (`"posts"|"pages"|"categories"|"tags"`).
 * @param {function(page:number, pageSize:number):Promise<Object>} fetcher - API fetch function for this resource.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @param {boolean} showAll - Whether `--all` was passed.
 * @param {number} ps - Page size.
 * @param {number} cols - Terminal column width.
 * @param {Object} [options]
 * @param {Object} [options.extraPagerFields] - Extra fields to persist on `pager.current` (e.g. posts' `order`/`filter`).
 * @param {string[]} [options.extraFooterLines] - Extra lines inserted after the listing, before the "more" hint (e.g. posts' sort hint).
 * @returns {Promise<string[]>} Formatted listing lines.
 */
async function listResource(key, fetcher, pager, showAll, ps, cols, { extraPagerFields = {}, extraFooterLines = [] } = {}) {
  const spec = RESOURCE_SPECS[key];
  try {
    const { items, total } = await fetchListItems(fetcher, spec.itemsKey, showAll, ps);
    if (!items.length) return [spec.noneMsg];
    const hasMore = !showAll && total > ps;
    const mapped = items.map((item, i) => spec.mapItem(item, i + 1));
    const slugMap = {};
    mapped.forEach(({ n, slug, id, url }) => { slugMap[n] = { slug, id, url }; });
    pager.current = { type: key, page: 1, total, slugMap, ...extraPagerFields };
    return [
      spec.foundMsg(total),
      "",
      ...batchFmtLineEls(mapped.map(({ n, title, date }) => ({ n, title, date })), cols),
      ...extraFooterLines,
      ...(hasMore ? ["", spec.moreMsg] : []),
    ];
  } catch (e) {
    return [fmtApiError(e)];
  }
}

/**
 * Lists posts, respecting the active taxonomy context and any order/tag args.
 * @param {string[]} args - `ls` arguments.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @param {boolean} showAll - Whether `--all` was passed.
 * @param {number} ps - Page size.
 * @param {number} cols - Terminal column width.
 * @param {import('react').RefObject<{category:Object|null,tag:Object|null}>} contextRef - Active taxonomy context.
 * @param {"asc"|"desc"} configOrder - Fallback sort order from user config.
 * @returns {Promise<string[]>} Formatted listing lines.
 */
async function listPosts(args, pager, showAll, ps, cols, contextRef, configOrder) {
  const resolved = await resolvePostsFilter(args, contextRef, configOrder);
  if (resolved.error) return resolved.error;
  const { order, filter } = resolved;

  const sortHint = order === "asc" ? t.ls_sort_hint_asc : t.ls_sort_hint_desc;
  return listResource("posts", (p, s) => fetchPosts(p, s, order, filter), pager, showAll, ps, cols, {
    extraPagerFields: { order, filter },
    extraFooterLines: ["", sortHint],
  });
}

/**
 * Lists posts, pages, categories, or tags in a paginated table.
 * Respects the active taxonomy context from `contextRef` when listing posts.
 * @param {string[]} args - `[target?, ...flags]` where target is posts|pages|categories|cats|tags.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated with the new listing.
 * @param {import('react').RefObject<{font:number,posts:number,theme:string,order:string}>} configRef - User config ref.
 * @param {import('react').RefObject<{category:Object|null,tag:Object|null}>} contextRef - Active taxonomy context ref.
 * @returns {Promise<string[]>} Formatted listing lines.
 */
export default async function cmdLs(args, pager, configRef, contextRef) {
  pager.current = null;
  const showAll = args.includes("--all");
  const ps = showAll ? 100 : configRef.current.posts;
  const cols = getLineWidth();
  const target = args[0]?.toLowerCase();

  if (args.includes("--help")) {
    const key = target === "cats" ? "categories" : target;
    return t.ls_help[key] ?? t.man_pages.ls;
  }

  if (!target || target === "posts") return listPosts(args, pager, showAll, ps, cols, contextRef, configRef.current.order);
  if (target === "pages") return listResource("pages", (p, s) => fetchPages(p, s), pager, showAll, ps, cols);
  if (target === "categories" || target === "cats") return listResource("categories", (p, s) => fetchCategories(p, s), pager, showAll, ps, cols);
  if (target === "tags") return listResource("tags", (p, s) => fetchTags(p, s), pager, showAll, ps, cols);

  return [t.ls_not_found(target)];
}
