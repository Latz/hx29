import { t } from "./i18n/index.js";

/** Default terminal line width in characters. */
export const LINE_W = 72;
/** Reserved width for the date column. */
export const DATE_W = 12;
/** Reserved width for the row-number column. */
export const NUM_W  = 4;

/**
 * Formats an ISO date string using the locale defined in the active i18n bundle.
 * @param {string} iso - ISO 8601 date string.
 * @returns {string} Localised short date string.
 */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(t.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Strips HTML tags and decodes HTML entities from a string.
 * @param {string} html - HTML string to sanitise.
 * @returns {string} Plain text, trimmed.
 */
export function stripHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html.replace(/<[^>]*>/g, "");
  return txt.value.trim();
}

/**
 * Splits a single token at natural break characters and hard-breaks oversized segments.
 * @param {string} token
 * @param {number} width
 * @returns {string[]}
 */
function breakToken(token, width) {
  const parts = token.split(/([-/_])/);
  const segments = [];
  let current = "";
  for (const part of parts) {
    if ((current + part).length <= width) {
      current += part;
    } else {
      if (current) segments.push(current);
      current = part;
    }
  }
  if (current) segments.push(current);
  const result = [];
  for (const seg of segments) {
    let s = seg;
    while (s.length > width) {
      result.push(s.slice(0, width - 1) + "-");
      s = s.slice(width - 1);
    }
    if (s) result.push(s);
  }
  return result;
}

/**
 * Wraps a string to a given character width.
 * @param {string} text
 * @param {number} width
 * @returns {string[]}
 */
export function wordWrap(text, width) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const tokens = word.length > width ? breakToken(word, width) : [word];
    for (const token of tokens) {
      if (!current) {
        current = token;
      } else if (current.length + 1 + token.length <= width) {
        current += " " + token;
      } else {
        lines.push(current);
        current = token;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Wraps an array of strings, passing lines that already fit through unchanged.
 * @param {string[]} rawLines
 * @param {number} width
 * @returns {string[]}
 */
export function wrapLines(rawLines, width) {
  return rawLines.flatMap((l) => (l.length <= width ? [l] : wordWrap(l, width)));
}

/**
 * Formats a single list row: `  n  title…  date`.
 * @param {number} n
 * @param {string} title
 * @param {string} date
 * @param {number} [cols]
 * @returns {string}
 */
export function fmtLine(n, title, date, cols) {
  const titleW = (cols || LINE_W) - DATE_W - NUM_W - 2;
  const num = String(n).padStart(NUM_W - 1) + " ";
  const tr = title.length > titleW ? title.slice(0, titleW - 1) + "…" : title;
  return num + tr.padEnd(titleW) + "  " + date;
}

/**
 * Formats an array of list items as fixed-width strings.
 * @param {Array<{n:number,title:string,date:string}>} items
 * @param {number} [cols]
 * @returns {string[]}
 */
export function batchFmtLineEls(items, cols) {
  const maxLen = Math.max(...items.map((it) => it.title.length));
  const cap = (cols || LINE_W) - NUM_W - DATE_W - 5;
  const titleW = Math.min(maxLen, cap) + 5;
  return items.map(({ n, title, date }) => {
    const num = String(n).padStart(NUM_W - 1) + " ";
    const tr = title.length > titleW - 5 ? title.slice(0, titleW - 6) + "…" : title;
    return num + tr.padEnd(titleW) + date;
  });
}
