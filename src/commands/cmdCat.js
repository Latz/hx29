import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { parseBodyWithLinks, getLineWidth, formatDate } from "../utils.js";
import { resolvePost } from "./postLookup.js";
import { buildArticleHeader } from "./articleHeader.js";

/**
 * Dumps a post's full content without pagination.
 * Same lookup logic as `read`, but never truncates — the entire article is returned at once.
 * @param {string[]} args - `[slug|n]` — a post slug or 1-based list number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated so `link N` works after `cat`.
 * @returns {Promise<string[]>} All article lines.
 */
export default async function cmdCat(args, pager) {
  const slugArg = args[0];
  if (!slugArg) return [t.cat_usage];

  const savedSlugMap = pager.current?.slugMap || {};

  try {
    const { post, slug } = await resolvePost(slugArg, savedSlugMap);
    if (!post) return [t.read_not_found(slug)];

    const cols = getLineWidth();
    const { lines: bodyLines, footerLines, footnotes } = parseBodyWithLinks(post.content.rendered, cols);
    const dateLine = t.read_published(formatDate(post.date));
    const { headerLines } = buildArticleHeader(post, dateLine, cols);

    const allLines = [...headerLines, "", ...bodyLines, ...footerLines, ""];

    pager.current = { type: "article", lines: [], offset: 0, slugMap: savedSlugMap, footnotes, slug };

    return allLines;
  } catch (e) {
    return [fmtApiError(e)];
  }
}
