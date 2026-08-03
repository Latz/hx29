import { t } from "../i18n/index.js";
import { wordWrap, stripHtml } from "../utils.js";

/**
 * Picks the category/tag meta line(s): combined onto one line if it fits the
 * header width, otherwise split across two lines.
 * @param {string|null} catLine - Formatted categories line, or null if none.
 * @param {string|null} tagLine - Formatted tags line, or null if none.
 * @param {number} baseW - Header width computed from title/date lines alone.
 * @returns {string[]} Meta line(s) to render.
 */
function buildMetaLines(catLine, tagLine, baseW) {
  if (catLine && tagLine) {
    const combined = `${catLine}  ${tagLine}`;
    return combined.length <= baseW ? [combined] : [catLine, tagLine];
  }
  return [catLine, tagLine].filter(Boolean);
}

/**
 * Builds the boxed header (rule/title/date/meta/rule) for a rendered post.
 * @param {{title:{rendered:string}, _embedded?:Object}} post - WP post object.
 * @param {string} dateLine - Pre-formatted date line (may include extra text like read time).
 * @param {number} cols - Terminal column width.
 * @returns {{titleLines:string[], headerLines:string[]}} Wrapped title lines and the full boxed header.
 */
export function buildArticleHeader(post, dateLine, cols) {
  const titleLines = wordWrap(stripHtml(post.title.rendered), cols);

  const terms = post._embedded?.["wp:term"] ?? [];
  const catNames = (terms[0] ?? []).map((term) => stripHtml(term.name)).filter(Boolean);
  const tagNames = (terms[1] ?? []).map((term) => stripHtml(term.name)).filter(Boolean);
  const catLine = catNames.length ? t.read_categories(catNames.join(", ")) : null;
  const tagLine = tagNames.length ? t.read_tags(tagNames.join(", ")) : null;

  const baseW = Math.max(...titleLines.map((l) => l.length), dateLine.length);
  const metaLines = buildMetaLines(catLine, tagLine, baseW);
  const headerW = Math.max(baseW, ...metaLines.map((l) => l.length));

  return {
    titleLines,
    headerLines: ["-".repeat(headerW), ...titleLines, dateLine, ...metaLines, "-".repeat(headerW)],
  };
}
