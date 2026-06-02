import { t } from "../i18n/index.js";
import { fetchComments } from "../api/comments.js";
import { getLineWidth, wrapLines, stripHtml, formatDate } from "../utils.js";

/**
 * Fetches and displays comments for the post at a given pager slot number.
 * @param {string[]} args - `[n]` where n is the slugMap entry number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {Promise<string[]>} Formatted comment lines or an error message.
 */
export default async function cmdComments(args, pager) {
  const n = parseInt(args[0], 10);
  if (isNaN(n)) return [t.comments_usage];
  const entry = pager.current?.slugMap?.[n];
  if (!entry) return [t.comments_unknown_num(n)];
  const id = typeof entry === "object" ? entry.id : null;
  if (!id) return [t.comments_no_id];
  try {
    const list = await fetchComments(id);
    if (!list.length) return [t.comments_none];
    const cols = getLineWidth();
    const out = [""];
    list.forEach((c, i) => {
      const name = (c.author_name || "anonym").padEnd(16);
      const date = formatDate(c.date);
      out.push(`[${i + 1}] ${name} ${date}`);
      wrapLines(
        stripHtml(c.content.rendered).split("\n").filter((l) => l.trim()),
        cols - 4
      ).forEach((l) => out.push("    " + l));
      out.push("");
    });
    return out;
  } catch (e) {
    return [t.error(e.message)];
  }
}
