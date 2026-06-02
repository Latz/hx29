import { t } from "../i18n/index.js";
import { fetchPosts } from "../api/posts.js";
import { fetchPages } from "../api/pages.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import apiFetch from "../api/apiFetch.js";
import { batchFmtLineEls, getPageLines, getLineWidth, stripHtml, formatDate } from "../utils.js";

/**
 * Advances the active pager to the next page (bound to `n` and `m` commands).
 * Handles article pagination, grep result blocks, and all list types (posts/pages/categories/tags/search).
 * @param {import('react').MutableRefObject<Object|null>} pager - Shared pager state ref; updated with next-page state.
 * @param {import('react').MutableRefObject<{font:number,posts:number,theme:string,order:string}>} configRef - User config ref (provides page size).
 * @returns {Promise<Array<string|import('react').ReactElement>>} Next page of content lines.
 */
export default async function cmdN(pager, configRef) {
  if (!pager.current) return [t.no_active_pager];
  const { type, page, total, slugMap } = pager.current;

  if (type === "article") {
    const { lines, offset, slugMap: articleSlugMap, footnotes, slug } = pager.current;
    const pageLines = getPageLines();
    const slice = lines.slice(offset, offset + pageLines);
    const nextOffset = offset + pageLines;
    const hasMore = nextOffset < lines.length;
    pager.current = hasMore
      ? { type: "article", lines, offset: nextOffset, slugMap: articleSlugMap, footnotes, slug }
      : { type: "article", lines: [], offset: 0, slugMap: articleSlugMap, footnotes, slug };
    if (hasMore) {
      const charsLeft = lines.slice(nextOffset).reduce((s, l) => s + (typeof l === "string" ? l.length : 0), 0);
      return [...slice, "", t.more_chars_left(charsLeft)];
    }
    return [...slice, ""];
  }

  if (type === "grep") {
    const { blocks, shownBlocks, slugMap: grepSlugMap } = pager.current;
    const pageLines = getPageLines();
    const nextPage = [];
    let newShown = shownBlocks;
    for (let i = shownBlocks; i < blocks.length; i++) {
      if (nextPage.length + blocks[i].length > pageLines) break;
      nextPage.push(...blocks[i]);
      newShown++;
    }
    const remaining = blocks.length - newShown;
    pager.current = { type: "grep", blocks, shownBlocks: newShown, slugMap: grepSlugMap };
    return remaining > 0
      ? [...nextPage, t.more_results_left(remaining)]
      : [...nextPage, ""];
  }

  const ps = configRef.current.posts;
  const nextPage = page + 1;
  const offset = page * ps;
  const cols = getLineWidth();

  try {
    if (type === "search") {
      const { searchTerm } = pager.current;
      const res = await apiFetch(`/posts?search=${encodeURIComponent(searchTerm)}&per_page=${ps}&page=${nextPage}&_fields=id,slug,title,date,link`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fetchedTotal = parseInt(res.headers.get("X-WP-Total") || "0", 10);
      const posts = await res.json();
      const shown = nextPage * ps;
      const hasMore = shown < (total ?? fetchedTotal);
      posts.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
      pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap, searchTerm } : null;
      return [
        ...batchFmtLineEls(posts.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
        ...(hasMore ? ["", t.more_items_left((total ?? fetchedTotal) - shown)] : [""]),
      ];
    }
    if (type === "posts") {
      const ord = pager.current.order || "desc";
      const fil = pager.current.filter || {};
      const { posts, total: fetchedTotal } = await fetchPosts(nextPage, ps, ord, fil);
      const shown = nextPage * ps;
      const hasMore = shown < (total ?? fetchedTotal);
      posts.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
      pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap, order: ord, filter: fil } : null;
      return [
        ...batchFmtLineEls(posts.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
        ...(hasMore ? ["", t.more] : [""]),
      ];
    }
    if (type === "pages") {
      const { pages, total: fetchedTotal } = await fetchPages(nextPage, ps);
      const shown = nextPage * ps;
      const hasMore = shown < (total ?? fetchedTotal);
      pages.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
      pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap } : null;
      return [
        ...batchFmtLineEls(pages.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: "" })), cols),
        ...(hasMore ? ["", t.more] : [""]),
      ];
    }
    if (type === "categories") {
      const { cats, total: fetchedTotal } = await fetchCategories(nextPage, ps);
      const shown = nextPage * ps;
      const hasMore = shown < (total ?? fetchedTotal);
      cats.forEach((c, i) => { slugMap[offset + i + 1] = { slug: c.slug, id: c.id, url: c.link }; });
      pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap } : null;
      return [
        ...batchFmtLineEls(cats.map((c, i) => ({ n: offset + i + 1, title: c.name, date: "" })), cols),
        ...(hasMore ? ["", t.more] : [""]),
      ];
    }
    if (type === "tags") {
      const { tags, total: fetchedTotal } = await fetchTags(nextPage, ps);
      const shown = nextPage * ps;
      const hasMore = shown < (total ?? fetchedTotal);
      tags.forEach((tg, i) => { slugMap[offset + i + 1] = { slug: tg.slug, id: tg.id, url: tg.link }; });
      pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap } : null;
      return [
        ...batchFmtLineEls(tags.map((tg, i) => ({ n: offset + i + 1, title: tg.name, date: "" })), cols),
        ...(hasMore ? ["", t.more] : [""]),
      ];
    }
  } catch (e) {
    return [t.error(e.message)];
  }
  return [];
}
