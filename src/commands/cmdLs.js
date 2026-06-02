import { t } from "../i18n/index.js";
import { fetchPosts } from "../api/posts.js";
import { fetchPages } from "../api/pages.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import { batchFmtLineEls, getLineWidth, stripHtml, formatDate } from "../utils.js";

/**
 * Exhaustively fetches all pages of a paginated API resource.
 * @param {function(page:number, pageSize:number):Promise<{posts?:Array,pages?:Array,cats?:Array,tags?:Array,total:number}>} fetcher - API fetch function.
 * @returns {Promise<{items:Array,total:number}>} All items concatenated with the total count.
 */
async function fetchAllPages(fetcher) {
  let page = 1, all = [], total = 0;
  do {
    const res = await fetcher(page, 100);
    const items = res.posts ?? res.pages ?? res.cats ?? res.tags;
    total = res.total;
    all = all.concat(items);
    page++;
  } while (all.length < total);
  return { items: all, total };
}

/**
 * Lists posts, pages, categories, or tags in a paginated table.
 * Respects the active taxonomy context from `contextRef` when listing posts.
 * @param {string[]} args - `[target?, ...flags]` where target is posts|pages|categories|cats|tags.
 * @param {import('react').MutableRefObject<Object|null>} pager - Shared pager state ref; updated with the new listing.
 * @param {import('react').MutableRefObject<{font:number,posts:number,theme:string,order:string}>} configRef - User config ref.
 * @param {import('react').MutableRefObject<{type:string|null,id:number|null,name:string|null}>} contextRef - Active taxonomy context ref.
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

  if (!target || target === "posts") {
    const orderArg = args[1]?.toLowerCase();
    const order = orderArg === "asc" || orderArg === "desc" ? orderArg : configRef.current.order;
    const filter = {};
    const ctx = contextRef.current;
    if (ctx.type === "category") filter.category = ctx.id;
    if (ctx.type === "tag")      filter.tag      = ctx.id;
    const tagArg = args.slice(1).find((a) => a !== "asc" && a !== "desc" && !a.startsWith("--"));
    if (tagArg) {
      try {
        const { tags: allTags } = await fetchTags(1, 100);
        const found = allTags.find((tg) => tg.slug === tagArg || tg.name.toLowerCase() === tagArg.toLowerCase());
        if (found) filter.tag = found.id;
        else return [t.cd_not_found(tagArg)];
      } catch (e) { return [t.error(e.message)]; }
    }
    try {
      let posts, total;
      if (showAll) {
        const r = await fetchAllPages((p, s) => fetchPosts(p, s, order, filter));
        posts = r.items; total = r.total;
      } else {
        ({ posts, total } = await fetchPosts(1, ps, order, filter));
      }
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
      return [t.error(e.message)];
    }
  }

  if (target === "pages") {
    try {
      let pages, total;
      if (showAll) {
        const r = await fetchAllPages((p, s) => fetchPages(p, s));
        pages = r.items; total = r.total;
      } else {
        ({ pages, total } = await fetchPages(1, ps));
      }
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
      return [t.error(e.message)];
    }
  }

  if (target === "categories" || target === "cats") {
    try {
      let cats, total;
      if (showAll) {
        const r = await fetchAllPages((p, s) => fetchCategories(p, s));
        cats = r.items; total = r.total;
      } else {
        ({ cats, total } = await fetchCategories(1, ps));
      }
      if (!cats.length) return [t.ls_no_categories];
      const hasMore = !showAll && total > ps;
      const slugMap = {};
      cats.forEach((c, i) => { slugMap[i + 1] = { slug: c.slug, id: c.id, url: c.link }; });
      pager.current = { type: "categories", page: 1, total, slugMap };
      return [
        t.ls_categories_found(total),
        "",
        ...batchFmtLineEls(cats.map((c, i) => ({ n: i + 1, title: c.name, date: "" })), cols),
        ...(hasMore ? ["", t.more_categories] : []),
      ];
    } catch (e) {
      return [t.error(e.message)];
    }
  }

  if (target === "tags") {
    try {
      let tags, total;
      if (showAll) {
        const r = await fetchAllPages((p, s) => fetchTags(p, s));
        tags = r.items; total = r.total;
      } else {
        ({ tags, total } = await fetchTags(1, ps));
      }
      if (!tags.length) return [t.ls_no_tags];
      const hasMore = !showAll && total > ps;
      const slugMap = {};
      tags.forEach((tg, i) => { slugMap[i + 1] = { slug: tg.slug, id: tg.id, url: tg.link }; });
      pager.current = { type: "tags", page: 1, total, slugMap };
      return [
        t.ls_tags_found(total),
        "",
        ...batchFmtLineEls(tags.map((tg, i) => ({ n: i + 1, title: tg.name, date: "" })), cols),
        ...(hasMore ? ["", t.more_tags] : []),
      ];
    } catch (e) {
      return [t.error(e.message)];
    }
  }

  return [t.ls_not_found(target)];
}
