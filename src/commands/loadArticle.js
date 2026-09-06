import { t } from "../i18n/index.js";
import { parseBodyWithLinks, getLineWidth, formatDate, stripHtml } from "../utils.js";
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
 * Resolves and fully renders a post's article body — the shared lookup/render
 * pipeline behind both `cat` (dumps `allLines` whole) and `read` (paginates
 * `allLines` via the pager). Looks up the slug from the pager slugMap first;
 * falls back to ordinal API fetch.
 * @param {string} slugArg - A post slug or 1-based list number.
 * @param {Object<number, string|{slug:string}>} savedSlugMap - Pager slugMap from the previous listing, if any.
 * @param {{readingTime?: boolean}} [options] - `readingTime`: append a `(~N min read)` estimate to the date line.
 * @returns {Promise<{post: Object|null, slug: string, allLines?: Array<string|import('react').ReactElement>, footnotes?: string[]}>}
 *   `post` is null (with no other fields) when nothing was found.
 */
export async function loadArticle(slugArg, savedSlugMap, { readingTime = false } = {}) {
  const { post, slug } = await resolvePost(slugArg, savedSlugMap);
  if (!post) return { post: null, slug };

  const commentCountPromise = fetchCommentCount(post.id).catch(() => 0);

  const cols = getLineWidth();
  const { lines: bodyLines, footerLines, footnotes } = parseBodyWithLinks(post.content.rendered, cols);
  let dateLine = t.read_published(formatDate(post.date));
  if (readingTime) dateLine += `  (~${estimateReadMinutes(post.content.rendered)} min read)`;
  const { headerLines } = buildArticleHeader(post, dateLine, cols);

  const commentCount = await commentCountPromise;
  const commentLines = commentCount > 0 ? [t.read_comment_count(commentCount)] : [];

  return {
    post,
    slug,
    footnotes,
    allLines: [...headerLines, "", ...bodyLines, ...footerLines, ...commentLines, ""],
  };
}
