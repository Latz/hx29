import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchComments } from "../api/comments.js";
import { resolvePost } from "./postLookup.js";
import { getLineWidth, wrapLines, stripHtml, formatDate } from "../utils.js";

/**
 * Fetches and displays comments for the post at a given pager slot number.
 * The slugMap entry at that number isn't always a post — `tree`, `ls
 * categories`, `ls tags`, and `ls pages` all reuse the same pager shape for
 * their own `link <n>` support — so the number is resolved the same
 * post-or-fall-back-to-nth-most-recent way `cat`/`read` do, rather than
 * trusting a possibly non-post id directly.
 * @param {string[]} args - `[n]` where n is the slugMap entry number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {Promise<string[]>} Formatted comment lines or an error message.
 */
export default async function cmdComments(args, pager) {
  const n = Number.parseInt(args[0], 10);
  if (Number.isNaN(n)) return [t.comments_usage];
  try {
    const { post } = await resolvePost(args[0], pager.current?.slugMap || {});
    if (!post) return [t.comments_unknown_num(n)];
    const list = await fetchComments(post.id);
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
    return [fmtApiError(e)];
  }
}
