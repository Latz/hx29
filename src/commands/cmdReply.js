import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { postComment } from "../api/comments.js";
import { clearApiCache } from "../api/apiFetch.js";

/**
 * Posts a comment (reply) on the post identified by a pager slot number, then clears
 * the API cache so a subsequent `comments` listing reflects the new comment.
 * @param {string[]} args - `[n, ...text]` where n is the slugMap entry number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {Promise<string[]>} Confirmation or error message.
 */
export default async function cmdReply(args, pager) {
  const n = Number.parseInt(args[0], 10);
  if (Number.isNaN(n) || args.length < 2) return [t.reply_usage];
  const text = args.slice(1).join(" ").trim();
  if (!text) return [t.reply_no_text];
  const entry = pager.current?.slugMap?.[n];
  if (!entry) return [t.reply_unknown_num(n)];
  const id = typeof entry === "object" ? entry.id : null;
  if (!id) return [t.reply_no_id];
  try {
    await postComment(id, text);
    clearApiCache();
    return [t.reply_saved];
  } catch (e) {
    return [fmtApiError(e)];
  }
}
