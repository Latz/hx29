import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchPostBySlug } from "../api/posts.js";
import apiFetch from "../api/apiFetch.js";
import { parseBodyWithLinks, getLineWidth, stripHtml, formatDate, wordWrap } from "../utils.js";

/**
 * Dumps a post's full content without pagination.
 * Same lookup logic as `read`, but never truncates — the entire article is returned at once.
 * @param {string[]} args - `[slug|n]` — a post slug or 1-based list number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated so `link N` works after `cat`.
 * @returns {Promise<string[]>} All article lines.
 */
export default async function cmdCat(args, pager) {
  let slug = args[0];
  if (!slug) return [t.cat_usage];

  const num = parseInt(slug, 10);
  const savedSlugMap = pager.current?.slugMap || {};
  if (!isNaN(num) && savedSlugMap[num]) {
    const entry = savedSlugMap[num];
    slug = typeof entry === "object" ? entry.slug : entry;
  }

  try {
    let post = isNaN(num) ? await fetchPostBySlug(slug) : null;
    if (!post && !isNaN(num)) {
      const res = await apiFetch(`/posts?per_page=1&page=${num}&orderby=date&order=desc&_embed=wp:term`);
      if (res.ok) {
        const posts = await res.json();
        if (posts.length) post = posts[0];
      }
    }
    if (!post) return [t.read_not_found(slug)];

    const cols = getLineWidth();
    const { lines: bodyLines, footerLines, footnotes } = parseBodyWithLinks(post.content.rendered, cols);
    const titleLines = wordWrap(stripHtml(post.title.rendered), cols);
    const dateLine = t.read_published(formatDate(post.date));

    const terms = post._embedded?.["wp:term"] ?? [];
    const catNames = (terms[0] ?? []).map((term) => term.name).filter(Boolean);
    const tagNames = (terms[1] ?? []).map((term) => term.name).filter(Boolean);
    const catLine = catNames.length ? t.read_categories(catNames.join(", ")) : null;
    const tagLine = tagNames.length ? t.read_tags(tagNames.join(", ")) : null;

    let metaLines;
    if (catLine && tagLine) {
      const combined = `${catLine}  ${tagLine}`;
      const baseW = Math.max(...titleLines.map((l) => l.length), dateLine.length);
      metaLines = combined.length <= baseW ? [combined] : [catLine, tagLine];
    } else {
      metaLines = [catLine, tagLine].filter(Boolean);
    }

    const headerW = Math.max(...titleLines.map((l) => l.length), dateLine.length, ...metaLines.map((l) => l.length));
    const allLines = [
      "-".repeat(headerW),
      ...titleLines,
      dateLine,
      ...metaLines,
      "-".repeat(headerW),
      "",
      ...bodyLines,
      ...footerLines,
      "",
    ];

    pager.current = { type: "article", lines: [], offset: 0, slugMap: savedSlugMap, footnotes, slug };

    return allLines;
  } catch (e) {
    return [fmtApiError(e)];
  }
}
