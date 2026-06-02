import { t } from "../i18n/index.js";
import { getPageLines } from "../utils.js";

const MAN_PAGES = t.man_pages;
const ALIASES = { r: "read", l: "link", link: "link", c: "comment" };

/**
 * Displays a man page for the given topic, paginating via the pager if needed.
 * @param {string[]} args - `[topic]` to look up (aliases r→read, l/link→link, c→comment).
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {string[]} Man page lines, possibly truncated with a "more" prompt.
 */
export default function cmdMan(args, pager) {
  const topic = args[0]?.toLowerCase();
  if (!topic) return [
    t.man_usage,
    t.man_available + Object.keys(MAN_PAGES).join(", "),
  ];
  const resolved = ALIASES[topic] ?? topic;
  const page = MAN_PAGES[resolved];
  if (!page) return [
    t.man_not_found(topic),
    t.man_available_list + Object.keys(MAN_PAGES).join(", "),
  ];
  const pageLines = getPageLines();
  if (page.length <= pageLines) return page;
  const charsLeft = page.slice(pageLines).reduce((s, l) => s + l.length, 0);
  pager.current = {
    type: "article",
    lines: page,
    offset: pageLines,
    slugMap: pager.current?.slugMap ?? {},
    footnotes: [],
    slug: null,
  };
  return [...page.slice(0, pageLines), "", t.more_chars_left(charsLeft)];
}
