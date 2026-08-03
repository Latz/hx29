import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchPosts } from "../api/posts.js";
import { fetchPages } from "../api/pages.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import { batchFmtLineEls, getLineWidth, stripHtml, formatDate } from "../utils.js";

const FETCH_ALL_CONCURRENCY = 5;

/**
 * Picks the item array out of a fetcher's result, whatever its key is named.
 * @param {{posts?:Array,pages?:Array,cats?:Array,tags?:Array}} result - A single fetcher response.
 * @returns {Array} The result's item list.
 */
function extractItems(result) {
  return result.posts ?? result.pages ?? result.cats ?? result.tags;
}

/**
 * Exhaustively fetches all pages of a paginated API resource.
 * Fetches page 1 first to discover the total, then fetches remaining pages in
 * concurrency-capped batches (avoids firing dozens of simultaneous requests on large sites).
 * @param {function(page:number, pageSize:number):Promise<{posts?:Array,pages?:Array,cats?:Array,tags?:Array,total:number}>} fetcher - API fetch function.
 * @returns {Promise<{items:Array,total:number}>} All items concatenated with the total count.
 */
async function fetchAllPages(fetcher) {
  const PAGE_SIZE = 100;
  const first = await fetcher(1, PAGE_SIZE);
  const total = first.total;
  const firstItems = extractItems(first);

  const remaining = Math.ceil((total - firstItems.length) / PAGE_SIZE);
  if (remaining <= 0) return { items: firstItems, total };

  const pageNumbers = Array.from({ length: remaining }, (_, i) => i + 2);
  const rest = [];
  for (let i = 0; i < pageNumbers.length; i += FETCH_ALL_CONCURRENCY) {
    const batch = pageNumbers.slice(i, i + FETCH_ALL_CONCURRENCY);
    const results = await Promise.all(batch.map((p) => fetcher(p, PAGE_SIZE)));
    for (const r of results) rest.push(...extractItems(r));
  }
  return { items: [...firstItems, ...rest], total };
}

/**
 * Fetches either every page (`--all`) or just the first page of a resource.
 * @param {function(page:number, pageSize:number):Promise<Object>} fetcher - API fetch function.
 * @param {boolean} showAll - Whether to fetch all pages.
 * @param {number} ps - Page size for a single-page fetch.
 * @returns {Promise<{items:Array,total:number}>} Items and total count.
 */
async function fetchListItems(fetcher, showAll, ps) {
  if (showAll) return fetchAllPages(fetcher);
  const result = await fetcher(1, ps);
  return { items: extractItems(result), total: result.total };
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

  try {
    const { items: posts, total } = await fetchListItems((p, s) => fetchPosts(p, s, order, filter), showAll, ps);
    if (!posts.length) return [t.ls_no_posts];
    const hasMore = !showAll && total > ps;
    const slugMap = {};
    posts.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
    pager.current = { type: "posts", page: 1, total, slugMap, order, filter };
    const sortHint = order === "asc" ? t.ls_sort_hint_asc : t.ls_sort_hint_desc;
    return [
      t.ls_posts_found(total),
      "",
      ...batchFmtLineEls(posts.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
      "",
      sortHint,
      ...(hasMore ? ["", t.more_posts] : []),
    ];
  } catch (e) {
    return [fmtApiError(e)];
  }
}

/**
 * Lists pages.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @param {boolean} showAll - Whether `--all` was passed.
 * @param {number} ps - Page size.
 * @param {number} cols - Terminal column width.
 * @returns {Promise<string[]>} Formatted listing lines.
 */
async function listPages(pager, showAll, ps, cols) {
  try {
    const { items: pages, total } = await fetchListItems((p, s) => fetchPages(p, s), showAll, ps);
    if (!pages.length) return [t.ls_no_pages];
    const hasMore = !showAll && total > ps;
    const slugMap = {};
    pages.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
    pager.current = { type: "pages", page: 1, total, slugMap };
    return [
      t.ls_pages_found(total),
      "",
      ...batchFmtLineEls(pages.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: "" })), cols),
      ...(hasMore ? ["", t.more_pages] : []),
    ];
  } catch (e) {
    return [fmtApiError(e)];
  }
}

/**
 * Lists categories.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @param {boolean} showAll - Whether `--all` was passed.
 * @param {number} ps - Page size.
 * @param {number} cols - Terminal column width.
 * @returns {Promise<string[]>} Formatted listing lines.
 */
async function listCategories(pager, showAll, ps, cols) {
  try {
    const { items: cats, total } = await fetchListItems((p, s) => fetchCategories(p, s), showAll, ps);
    if (!cats.length) return [t.ls_no_categories];
    const hasMore = !showAll && total > ps;
    const slugMap = {};
    cats.forEach((c, i) => { slugMap[i + 1] = { slug: c.slug, id: c.id, url: c.link }; });
    pager.current = { type: "categories", page: 1, total, slugMap };
    return [
      t.ls_categories_found(total),
      "",
      ...batchFmtLineEls(cats.map((c, i) => ({ n: i + 1, title: stripHtml(c.name), date: "" })), cols),
      ...(hasMore ? ["", t.more_categories] : []),
    ];
  } catch (e) {
    return [fmtApiError(e)];
  }
}

/**
 * Lists tags.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @param {boolean} showAll - Whether `--all` was passed.
 * @param {number} ps - Page size.
 * @param {number} cols - Terminal column width.
 * @returns {Promise<string[]>} Formatted listing lines.
 */
async function listTags(pager, showAll, ps, cols) {
  try {
    const { items: tags, total } = await fetchListItems((p, s) => fetchTags(p, s), showAll, ps);
    if (!tags.length) return [t.ls_no_tags];
    const hasMore = !showAll && total > ps;
    const slugMap = {};
    tags.forEach((tg, i) => { slugMap[i + 1] = { slug: tg.slug, id: tg.id, url: tg.link }; });
    pager.current = { type: "tags", page: 1, total, slugMap };
    return [
      t.ls_tags_found(total),
      "",
      ...batchFmtLineEls(tags.map((tg, i) => ({ n: i + 1, title: stripHtml(tg.name), date: "" })), cols),
      ...(hasMore ? ["", t.more_tags] : []),
    ];
  } catch (e) {
    return [fmtApiError(e)];
  }
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
  if (target === "pages") return listPages(pager, showAll, ps, cols);
  if (target === "categories" || target === "cats") return listCategories(pager, showAll, ps, cols);
  if (target === "tags") return listTags(pager, showAll, ps, cols);

  return [t.ls_not_found(target)];
}
