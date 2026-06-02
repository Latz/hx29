import { t } from "../i18n/index.js";
import apiFetch from "../api/apiFetch.js";
import { fmtLine, getPageLines, getLineWidth, stripHtml, formatDate } from "../utils.js";

/**
 * Searches post content client-side with highlighted match context.
 * Fetches up to 100 posts and filters lines containing the search term.
 * @param {string[]} args - Search term tokens (joined with spaces).
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref; updated with grep block state.
 * @returns {Promise<Array<string|import('react').ReactElement>>} Matching lines with highlighted terms, paginated.
 */
export default async function cmdGrep(args, pager) {
  if (!args.length) return [t.grep_usage];
  const term = args.join(" ");
  const termLower = term.toLowerCase();
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const res = await apiFetch(`/posts?per_page=100&_fields=id,slug,title,date,content`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const posts = await res.json();
    const cols = getLineWidth();
    const slugMap = {};
    const blocks = [];
    posts.forEach((p) => {
      const body = stripHtml(p.content.rendered);
      const lines = body.split("\n").filter((l) => l.trim());
      const matchLines = lines
        .filter((line) => line.toLowerCase().includes(termLower))
        .map((line) => {
          const raw = line.slice(0, cols - 4);
          const re = new RegExp(`(${escaped})`, "gi");
          const parts = raw.split(re);
          return (
            <span key={raw}>
              {"    "}
              {parts.map((part, i) =>
                i % 2 === 1
                  ? <span key={i} style={{ background: "var(--fg)", color: "var(--bg)" }}>{part}</span>
                  : part
              )}
            </span>
          );
        });
      if (!matchLines.length) return;
      const n = blocks.length + 1;
      slugMap[n] = { slug: p.slug, id: p.id };
      blocks.push([
        fmtLine(n, stripHtml(p.title.rendered), formatDate(p.date), cols),
        ...matchLines,
        "",
      ]);
    });
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
    return [t.error(e.message)];
  }
}
