import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchPostBySlug } from "../api/posts.js";
import apiFetch from "../api/apiFetch.js";
import { parseBodyWithLinks, getPageLines, getLineWidth, stripHtml, formatDate, wordWrap } from "../utils.js";

/**
 * Reads and displays a post by slug or ordinal number.
 * Looks up the slug from the pager slugMap first; falls back to ordinal API fetch.
 * Paginates long articles via the pager and renders hyperlinks as footnotes.
 * @param {string[]} args - `[slug|n]` — a post slug or 1-based list number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated with article pagination state.
 * @returns {Promise<Array<string|import('react').ReactElement>>} Article lines, possibly truncated with a "more" prompt.
 */
export default async function cmdRead(args, pager) {
  let slug = args[0];
  if (!slug) return [t.read_usage];

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
    const wordCount = stripHtml(post.content.rendered).trim().split(/\s+/).length;
    const readMins = Math.max(1, Math.round(wordCount / 200));
    const dateLine = t.read_published(formatDate(post.date)) + `  (~${readMins} min read)`;

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

    const pageLines = getPageLines();
    const hasMore = allLines.length > pageLines;
    const slice = allLines.slice(0, pageLines);
    pager.current = hasMore
      ? { type: "article", lines: allLines, offset: pageLines, slugMap: savedSlugMap, footnotes, slug }
      : { type: "article", lines: [], offset: 0, slugMap: savedSlugMap, footnotes, slug };

    if (hasMore) {
      const charsLeft = allLines.slice(pageLines).reduce((s, l) => s + (typeof l === "string" ? l.length : 0), 0);
      return [...slice, "", t.more_chars_left(charsLeft)];
    }
    return [...slice];
  } catch (e) {
    return [fmtApiError(e)];
  }
}
