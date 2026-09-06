import { t } from "../i18n/index.js";
import { stripHtml, formatDate } from "../utils.js";

/**
 * Per-resource-type behavior shared by `cmdLs.js` (`ls <resource>`) and
 * `cmdN.js` (`n` — fetches and renders the next page of the same resource).
 * `mapItem(item, n)` returns the fields both the slugMap entry (`slug`,
 * `id`, `url`) and the rendered line (`n`, `title`, `date`) are built from.
 * @type {Object<string, {itemsKey:string, mapItem:function(Object,number):{n:number,slug:string,id:number,url:string,title:string,date:string}, noneMsg:string, foundMsg:function(number):string, moreMsg:string}>}
 */
export const RESOURCE_SPECS = {
  posts: {
    itemsKey: "posts",
    mapItem: (p, n) => ({ n, slug: p.slug, id: p.id, url: p.link, title: stripHtml(p.title.rendered), date: formatDate(p.date) }),
    noneMsg: t.ls_no_posts,
    foundMsg: t.ls_posts_found,
    moreMsg: t.more_posts,
  },
  pages: {
    itemsKey: "pages",
    mapItem: (p, n) => ({ n, slug: p.slug, id: p.id, url: p.link, title: stripHtml(p.title.rendered), date: "" }),
    noneMsg: t.ls_no_pages,
    foundMsg: t.ls_pages_found,
    moreMsg: t.more_pages,
  },
  categories: {
    itemsKey: "cats",
    mapItem: (c, n) => ({ n, slug: c.slug, id: c.id, url: c.link, title: stripHtml(c.name), date: "" }),
    noneMsg: t.ls_no_categories,
    foundMsg: t.ls_categories_found,
    moreMsg: t.more_categories,
  },
  tags: {
    itemsKey: "tags",
    mapItem: (tg, n) => ({ n, slug: tg.slug, id: tg.id, url: tg.link, title: stripHtml(tg.name), date: "" }),
    noneMsg: t.ls_no_tags,
    foundMsg: t.ls_tags_found,
    moreMsg: t.more_tags,
  },
};
