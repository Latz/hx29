import { addQueryArgs } from "@wordpress/url";
import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import apiFetch from "../api/apiFetch.js";
import { fmtLine, getPageLines, getLineWidth, stripHtml, formatDate } from "../utils.js";
import { highlightMatch } from "../ui.jsx";

const GREP_YIELD_CHUNK = 10;

/**
 * Searches post content with highlighted match context. Pre-filters candidate posts
 * server-side via WP's `search` REST parameter (like `cmdSearch`), then scans just those
 * posts' content client-side to find and highlight the specific matching lines — avoiding
 * fetching and scanning every post's full body up front.
 * Yields to the main thread every `GREP_YIELD_CHUNK` posts so a large scan
 * doesn't block input/animations for the whole duration.
 * @param {string[]} args - Search term tokens (joined with spaces).
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated with grep block state.
 * @returns {Promise<Array<string|import('react').ReactElement>>} Matching lines with highlighted terms, paginated.
 */
export default async function cmdGrep(args, pager) {
  if (!args.length) return [t.grep_usage];
  const term = args.join(" ");
  const termLower = term.toLowerCase();
  try {
    const res = await apiFetch(addQueryArgs("/posts", { search: term, per_page: 100, _fields: "id,slug,title,date,content" }));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const posts = await res.json();
    const cols = getLineWidth();
    const slugMap = {};
    const blocks = [];
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const body = stripHtml(p.content.rendered);
      const lines = body.split("\n").filter((l) => l.trim());
      const matchLines = lines
        .filter((line) => line.toLowerCase().includes(termLower))
        .map((line) => highlightMatch(line, term, cols));
      if (matchLines.length) {
        const n = blocks.length + 1;
        slugMap[n] = { slug: p.slug, id: p.id };
        blocks.push([
          fmtLine(n, stripHtml(p.title.rendered), formatDate(p.date), cols),
          ...matchLines,
          "",
        ]);
      }
      if (i % GREP_YIELD_CHUNK === GREP_YIELD_CHUNK - 1) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    if (!blocks.length) return [t.grep_no_results(term)];
    const pageLines = getPageLines();
    const firstPage = [];
    let shownBlocks = 0;
    for (const block of blocks) {
      if (firstPage.length + block.length > pageLines) break;
      firstPage.push(...block);
      shownBlocks++;
    }
    const remainingBlocks = blocks.length - shownBlocks;
    pager.current = { type: "grep", blocks, shownBlocks, slugMap };
    const header = [t.grep_found(blocks.length, term), ""];
    if (remainingBlocks > 0) {
      return [...header, ...firstPage, t.more_grep];
    }
    pager.current = { type: "grep", blocks: [], shownBlocks: blocks.length, slugMap };
    return [...header, ...firstPage];
  } catch (e) {
    return [fmtApiError(e)];
  }
}
