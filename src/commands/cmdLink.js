import { t } from "../i18n/index.js";

const ALLOWED_PROTOCOLS = ["http:", "https:", "mailto:"];

/**
 * Opens a numbered link from the active pager context in a new tab.
 * Checks article footnotes first, then the slugMap URL.
 * @param {string[]} args - `[n]` where n is the 1-based link number.
 * @param {import('react').RefObject<Object|null>} pager - Shared pager state ref.
 * @returns {string[]} Confirmation or error message.
 */
export default function cmdLink(args, pager) {
  const n = Number.parseInt(args[0], 10);
  if (Number.isNaN(n)) return [t.link_usage];

  const footnotes = pager.current?.footnotes;
  let url = footnotes?.[n - 1] ? footnotes[n - 1] : null;
  if (!url) {
    const entry = pager.current?.slugMap?.[n];
    if (!entry) return [t.link_unknown_num(n)];
    url = typeof entry === "object" ? entry.url : null;
  }
  if (!url) return [t.link_no_url];

  // Footnote URLs are harvested from post content — an admin/editor with
  // unfiltered_html could plant a javascript: link that a synthetic click
  // would execute in this origin (target="_blank" doesn't sandbox that).
  let parsed;
  try {
    parsed = new URL(url, location.href);
  } catch {
    return [t.link_no_url];
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return [t.link_no_url];

  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return [t.link_opening(url)];
}
