import { t } from "./i18n/index.js";
import { CONFIG_DEFAULTS } from "./config.js";

// ─── formatDate ───────────────────────────────────────────────────────────────
/**
 * Formats an ISO date string using the locale defined in the active i18n bundle.
 * @param {string} iso - ISO 8601 date string (e.g. `"2024-03-15T10:00:00"`).
 * @returns {string} Localised short date string (e.g. `"15. März 2024"`).
 */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString(t.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── stripHtml ────────────────────────────────────────────────────────────────
/**
 * Strips HTML tags and decodes HTML entities from a string.
 * Uses a temporary `<textarea>` for entity decoding so it handles all entities correctly.
 * @param {string} html - HTML string to sanitise.
 * @returns {string} Plain text with tags removed and entities decoded, trimmed.
 */
export function stripHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html.replace(/<[^>]*>/g, "");
  return txt.value.trim();
}

// ─── wordWrap ─────────────────────────────────────────────────────────────────
/**
 * Splits a single token at natural break characters (`-`, `/`, `_`) and hard-breaks
 * any remaining segment that exceeds the width limit.
 * @param {string} token - A single word-like token with no spaces.
 * @param {number} width - Maximum character width per segment.
 * @returns {string[]} Token split into width-bounded segments.
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
 * Wraps a single string to a given character width, breaking long tokens with `breakToken`.
 * @param {string} text - Text to wrap (may contain spaces).
 * @param {number} width - Maximum characters per line.
 * @returns {string[]} Array of wrapped lines.
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
 * @param {string[]} rawLines - Lines that may exceed `width`.
 * @param {number} width - Maximum characters per output line.
 * @returns {string[]} Lines all within `width`.
 */
export function wrapLines(rawLines, width) {
  return rawLines.flatMap((l) => (l.length <= width ? [l] : wordWrap(l, width)));
}

// ─── formatting ───────────────────────────────────────────────────────────────
/** Default terminal line width in characters. */
export const LINE_W = 72;
/** Reserved width for the date column. */
export const DATE_W = 12;
/** Reserved width for the row-number column. */
export const NUM_W  = 4;

/**
 * Formats a single list row as a fixed-width string: `  n  title…  date`.
 * @param {number} n - Row number.
 * @param {string} title - Post/page title (truncated if too long).
 * @param {string} date - Pre-formatted date string.
 * @param {number} [cols] - Terminal width; defaults to `LINE_W`.
 * @returns {string} Fixed-width formatted row string.
 */
export function fmtLine(n, title, date, cols) {
  const titleW = (cols || LINE_W) - DATE_W - NUM_W - 2;
  const num = String(n).padStart(NUM_W - 1) + " ";
  const tr = title.length > titleW ? title.slice(0, titleW - 1) + "…" : title;
  return num + tr.padEnd(titleW) + "  " + date;
}

/**
 * Like `fmtLine` but returns an animated-text object with an underlined `link [n]` React suffix.
 * @param {number} n - Row number.
 * @param {string} title - Post/page title.
 * @param {string} date - Pre-formatted date string.
 * @param {number} [cols] - Terminal width; defaults to `LINE_W`.
 * @returns {{__animText: string, __suffix: import('react').ReactElement}} Animated line descriptor.
 */
export function fmtLineEl(n, title, date, cols) {
  return {
    __animText: fmtLine(n, title, date, cols) + "  ",
    __suffix: <span style={{ textDecoration: "underline" }}>{`link [${n}]`}</span>,
  };
}

/**
 * Formats an array of list items as fixed-width strings, auto-sizing the title column
 * to fit the longest title in the batch.
 * @param {Array<{n:number,title:string,date:string}>} items - Items to format.
 * @param {number} [cols] - Terminal width; defaults to `LINE_W`.
 * @returns {string[]} One formatted string per item.
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

/**
 * Parses an HTML body, replacing `<a>` links with underlined React spans and
 * numbered footnotes, then word-wraps the result to `width` characters.
 * @param {string} html - Raw HTML content from the WP REST API.
 * @param {number} width - Terminal character width for word-wrapping.
 * @returns {{lines: Array<string|import('react').ReactElement>, footerLines: string[], footnotes: string[]}}
 *   `lines` — wrapped body content; `footerLines` — footnote URL list; `footnotes` — raw URL array.
 */
export function parseBodyWithLinks(html, width) {
  const footnotes = [];
  const urlIndex = {};

  const marked = html.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, url, text) => {
      const label = stripHtml(text);
      if (!urlIndex[url]) {
        footnotes.push(url);
        urlIndex[url] = footnotes.length;
      }
      return `«${label}»​${urlIndex[url]}‌`;
    }
  );

  const plain = stripHtml(marked);
  const rawLines = plain.split("\n").filter((l) => l.trim());
  const wrapped = rawLines.flatMap((l) => (l.length <= width ? [l] : wordWrap(l, width)));

  const markerRe = /«([^»]*)»​(\d+)‌/g;
  const lines = wrapped.map((line) => {
    const lineKey = line.slice(0, 40);
    if (!line.includes("«")) return <span key={lineKey}>{line}</span>;
    const parts = [];
    let last = 0;
    let m;
    markerRe.lastIndex = 0;
    while ((m = markerRe.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      parts.push(
        <span key={`${lineKey}-${m[2]}`} style={{ textDecoration: "underline" }}>{m[1]}</span>,
        ` [${m[2]}]`
      );
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <span key={lineKey}>{parts}</span>;
  });

  const footerLines = footnotes.length
    ? (() => {
        const entries = footnotes.map((u, i) => `[${i + 1}] ${u}`);
        const sepW = Math.min(Math.max(...entries.map((e) => e.length)), width);
        return ["", "-".repeat(sepW), ...entries];
      })()
    : [];

  return { lines, footerLines, footnotes };
}

// ─── dom ──────────────────────────────────────────────────────────────────────
/**
 * Calculates how many terminal lines fit in the visible `.react-terminal` element.
 * Falls back to 20 if the element is not yet in the DOM.
 * @returns {number} Number of visible lines (minimum 5).
 */
export function getPageLines() {
  const el = document.querySelector(".react-terminal");
  if (!el) return 20;
  const lineH = Number.parseFloat(getComputedStyle(el).fontSize) * 1.4;
  return Math.max(5, Math.floor(el.clientHeight / lineH) - 3);
}

/**
 * Measures the character width of the `.react-terminal` element by rendering a
 * hidden `M` glyph and dividing. Falls back to `LINE_W` if unmeasurable.
 * @returns {number} Number of monospace characters that fit in one terminal line.
 */
export function getLineWidth() {
  const el = document.querySelector(".react-terminal");
  if (!el) return LINE_W;
  const span = document.createElement("span");
  span.style.cssText =
    "position:absolute;visibility:hidden;font-family:var(--font,monospace);font-size:var(--fsize,22px);white-space:pre";
  span.textContent = "M";
  el.appendChild(span);
  const charW = span.getBoundingClientRect().width;
  span.remove();
  return charW > 0 ? Math.floor(el.clientWidth / charW) : LINE_W;
}

/**
 * Scrolls the `.react-terminal` element to the bottom with a brief opacity flash
 * on the wrapper to simulate a CRT screen-draw effect.
 * @returns {void}
 */
export function scrollTerminal() {
  const el = document.querySelector(".react-terminal");
  if (!el) return;
  const wrapper = document.querySelector(".react-terminal-wrapper");
  if (wrapper) {
    wrapper.style.transition = "opacity 50ms linear";
    wrapper.style.opacity = "0.94";
    setTimeout(() => {
      wrapper.style.transition = "opacity 120ms ease-out";
      wrapper.style.opacity = "1";
    }, 50);
  }
  el.scrollTop = el.scrollHeight;
}

/**
 * With 3% probability, adds the `sync-tear` CSS class to the last terminal line
 * for a brief CRT sync-tear glitch animation, then removes it.
 * @returns {void}
 */
export function maybeSyncTear() {
  if (Math.random() >= 0.03) return;
  const lines = document.querySelectorAll(".react-terminal .react-terminal-line");
  if (!lines.length) return;
  const target = lines[lines.length - 1];
  const duration = 40 + Math.random() * 40;
  target.classList.add("sync-tear");
  target.style.animationDuration = `${duration}ms`;
  setTimeout(() => {
    target.classList.remove("sync-tear");
    target.style.animationDuration = "";
  }, duration + 10);
}

// ─── userConfig ───────────────────────────────────────────────────────────────
/**
 * Loads the user config from the `hx29_config` cookie, merged with defaults.
 * @returns {{font:number,posts:number,theme:string,order:string}} Current config.
 */
export function loadConfig() {
  const c = document.cookie.split("; ").find((r) => r.startsWith("hx29_config="));
  if (!c) return { ...CONFIG_DEFAULTS };
  try {
    return { ...CONFIG_DEFAULTS, ...JSON.parse(decodeURIComponent(c.split("=").slice(1).join("="))) };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

/**
 * Persists the user config to the `hx29_config` cookie (1-year expiry).
 * @param {{font:number,posts:number,theme:string,order:string}} cfg - Config to save.
 * @returns {void}
 */
export function saveConfig(cfg) {
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `hx29_config=${encodeURIComponent(JSON.stringify(cfg))}; expires=${exp}; path=/; SameSite=Lax`;
}

/**
 * Applies config values to the DOM: sets the `--fsize` CSS variable and the
 * `data-theme` attribute on `<html>` (removed for theme `"a"`).
 * @param {{font:number,theme:string}} cfg - Config with at least `font` and `theme`.
 * @returns {void}
 */
export function applyConfig(cfg) {
  document.documentElement.style.setProperty("--fsize", cfg.font + "px");
  if (cfg.theme && cfg.theme !== "a") {
    document.documentElement.dataset.theme = cfg.theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

/**
 * Loads the command history array from the `hx29_history` cookie.
 * @returns {string[]} History entries, most-recent-first. Empty array on missing/corrupt cookie.
 */
export function loadHistory() {
  const c = document.cookie.split("; ").find((r) => r.startsWith("hx29_history="));
  if (!c) return [];
  try {
    return JSON.parse(decodeURIComponent(c.split("=").slice(1).join("=")));
  } catch {
    return [];
  }
}

/**
 * Prepends a command to the history ref, deduplicates, caps at 25 entries, and
 * persists to the `hx29_history` cookie.
 * @param {import('react').RefObject<string[]>} historyRef - Mutable history ref (mutated in place).
 * @param {string} cmd - Command string to record.
 * @returns {void}
 */
export function pushHistory(historyRef, cmd) {
  const h = historyRef.current;
  const idx = h.indexOf(cmd);
  if (idx !== -1) h.splice(idx, 1);
  h.unshift(cmd);
  if (h.length > 25) h.length = 25;
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `hx29_history=${encodeURIComponent(JSON.stringify(h))}; expires=${exp}; path=/; SameSite=Lax`;
}
