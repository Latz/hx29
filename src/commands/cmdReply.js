import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { postComment } from "../api/comments.js";
import { clearApiCache } from "../api/apiFetch.js";
import { resolvePost } from "./postLookup.js";

/**
 * Posts a comment (reply) on the post identified by a pager slot number, then clears
 * the API cache so a subsequent `comments` listing reflects the new comment.
 * The slugMap entry at that number isn't always a post — `tree`, `ls
 * categories`, `ls tags`, and `ls pages` all reuse the same pager shape for
 * their own `link <n>` support — so the number is resolved the same
 * post-or-fall-back-to-nth-most-recent way `cat`/`read` do, rather than
 * trusting a possibly non-post id directly and posting to the wrong post.
 * @param {string[]} args - `[n, ...text]` where n is the slugMap entry number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {Promise<string[]>} Confirmation or error message.
 */
export default async function cmdReply(args, pager) {
  const n = Number.parseInt(args[0], 10);
  if (Number.isNaN(n) || args.length < 2) return [t.reply_usage];
  const text = args.slice(1).join(" ").trim();
  if (!text) return [t.reply_no_text];
  try {
    const { post } = await resolvePost(args[0], pager.current?.slugMap || {});
    if (!post) return [t.reply_unknown_num(n)];
    await postComment(post.id, text);
    clearApiCache();
    return [t.reply_saved];
  } catch (e) {
    return [fmtApiError(e)];
  }
}
