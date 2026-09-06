import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { getPageLines } from "../utils.js";
import { loadArticle } from "./loadArticle.js";

/**
 * Reads and displays a post by slug or ordinal number.
 * Looks up the slug from the pager slugMap first; falls back to ordinal API fetch.
 * Paginates long articles via the pager and renders hyperlinks as footnotes.
 * @param {string[]} args - `[slug|n]` — a post slug or 1-based list number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated with article pagination state.
 * @returns {Promise<Array<string|import('react').ReactElement>>} Article lines, possibly truncated with a "more" prompt.
 */
export default async function cmdRead(args, pager) {
  const slugArg = args[0];
  if (!slugArg) return [t.read_usage];

  const savedSlugMap = pager.current?.slugMap || {};

  try {
    const { post, slug, allLines, footnotes } = await loadArticle(slugArg, savedSlugMap, { readingTime: true });
    if (!post) return [t.read_not_found(slug)];

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
