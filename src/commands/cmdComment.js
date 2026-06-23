import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { postComment } from "../api/comments.js";

/**
 * Posts a comment on the post identified by a pager slot number.
 * @param {string[]} args - `[n, ...text]` where n is the slugMap entry number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {Promise<string[]>} Confirmation or error message.
 */
export default async function cmdComment(args, pager) {
  const n = parseInt(args[0], 10);
  if (isNaN(n) || args.length < 2) return [t.comment_usage];
  const text = args.slice(1).join(" ").trim();
  if (!text) return [t.comment_no_text];
  const entry = pager.current?.slugMap?.[n];
  if (!entry) return [t.comment_unknown_num(n)];
  const id = typeof entry === "object" ? entry.id : null;
  if (!id) return [t.comment_no_id];
  try {
    await postComment(id, text);
    return [t.comment_saved];
  } catch (e) {
    return [fmtApiError(e)];
  }
}
