import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchCategories } from "../api/taxonomy.js";
import { getPageLines, stripHtml } from "../utils.js";

/**
 * Groups categories by parent id (`0` for top-level categories).
 * @param {Array<{id:number,parent:number}>} cats - Flat category list.
 * @returns {Map<number, Array>} Parent id to its direct children.
 */
function groupByParent(cats) {
  const byParent = new Map();
  cats.forEach((c) => {
    const p = c.parent || 0;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(c);
  });
  return byParent;
}

/**
 * Recursively renders a category branch with Unix `tree`-style box-drawing connectors,
 * numbering each line depth-first and recording it in `slugMap` for `link <n>`.
 * @param {Map<number, Array>} byParent - Parent id to children, from `groupByParent`.
 * @param {number} parentId - Id of the branch to render (`0` for the root).
 * @param {string} prefix - Accumulated indent/connector prefix for this depth.
 * @param {Object<number, {slug:string,id:number,url:string}>} slugMap - Mutated in place.
 * @param {{n: number}} counter - Mutable shared counter for line numbering.
 * @returns {string[]} Rendered lines for this branch and all its descendants.
 */
function renderBranch(byParent, parentId, prefix, slugMap, counter) {
  const children = byParent.get(parentId) || [];
  const lines = [];
  children.forEach((cat, i) => {
    const isLast = i === children.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const n = ++counter.n;
    slugMap[n] = { slug: cat.slug, id: cat.id, url: cat.link };
    lines.push(`${prefix}${connector}${n}. ${stripHtml(cat.name)} (${cat.count})`);
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    lines.push(...renderBranch(byParent, cat.id, childPrefix, slugMap, counter));
  });
  return lines;
}

/**
 * Shows all categories as a nested hierarchy (tags have no parent/child relationship
 * in WordPress, so this is categories-only). Paginates via the pager if the rendered
 * tree is longer than one screen; `link <n>` opens a category's archive page.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {Promise<string[]>} Rendered tree lines, possibly truncated with a "more" prompt.
 */
export default async function cmdTree(pager) {
  try {
    const { cats } = await fetchCategories(1, 100);
    if (!cats.length) return [t.tree_no_categories];

    const byParent = groupByParent(cats);
    const slugMap = {};
    const lines = renderBranch(byParent, 0, "", slugMap, { n: 0 });

    const pageLines = getPageLines();
    if (lines.length <= pageLines) {
      pager.current = { type: "article", lines: [], offset: 0, slugMap, footnotes: [], slug: null };
      return lines;
    }
    const charsLeft = lines.slice(pageLines).reduce((s, l) => s + l.length, 0);
    pager.current = { type: "article", lines, offset: pageLines, slugMap, footnotes: [], slug: null };
    return [...lines.slice(0, pageLines), "", t.more_chars_left(charsLeft)];
  } catch (e) {
    return [fmtApiError(e)];
  }
}
