import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { parseBodyWithLinks, getPageLines, getLineWidth, formatDate, stripHtml } from "../utils.js";
import { resolvePost } from "./postLookup.js";
import { buildArticleHeader } from "./articleHeader.js";
import { fetchCommentCount } from "../api/comments.js";

/**
 * Estimates reading time in whole minutes at ~200 words per minute.
 * @param {string} html - Rendered post HTML content.
 * @returns {number} Estimated minutes to read, minimum 1.
 */
function estimateReadMinutes(html) {
  const wordCount = stripHtml(html).trim().split(/\s+/).length;
  return Math.max(1, Math.round(wordCount / 200));
}

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
    const { post, slug } = await resolvePost(slugArg, savedSlugMap);
    if (!post) return [t.read_not_found(slug)];

    const commentCountPromise = fetchCommentCount(post.id).catch(() => 0);

    const cols = getLineWidth();
    const { lines: bodyLines, footerLines, footnotes } = parseBodyWithLinks(post.content.rendered, cols);
    const readMins = estimateReadMinutes(post.content.rendered);
    const dateLine = t.read_published(formatDate(post.date)) + `  (~${readMins} min read)`;
    const { headerLines } = buildArticleHeader(post, dateLine, cols);

    const commentCount = await commentCountPromise;
    const commentLines = commentCount > 0 ? [t.read_comment_count(commentCount)] : [];

    const allLines = [...headerLines, "", ...bodyLines, ...footerLines, ...commentLines, ""];

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
