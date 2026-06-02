import { t } from "../i18n/index.js";

/**
 * Opens a numbered link from the active pager context in a new tab.
 * Checks article footnotes first, then the slugMap URL.
 * @param {string[]} args - `[n]` where n is the 1-based link number.
 * @param {import('react').MutableRefObject<Object|null>} pager - Shared pager state ref.
 * @returns {string[]} Confirmation or error message.
 */
export default function cmdLink(args, pager) {
  const n = parseInt(args[0], 10);
  if (isNaN(n)) return [t.link_usage];

  const footnotes = pager.current?.footnotes;
  let url = footnotes && footnotes[n - 1] ? footnotes[n - 1] : null;
  if (!url) {
    const entry = pager.current?.slugMap?.[n];
    if (!entry) return [t.link_unknown_num(n)];
    url = typeof entry === "object" ? entry.url : null;
  }
  if (!url) return [t.link_no_url];

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return [t.link_opening(url)];
}
