import { fmtLine, stripHtml, wordWrap } from "./format.js";

/**
 * Renders a line with highlighted match terms in inverse video.
 * @param {string} line - Raw text line.
 * @param {string} term - Search term to highlight.
 * @param {number} cols - Max display width.
 * @returns {import('react').ReactElement} Span with highlighted segments.
 */
export function highlightMatch(line, term, cols) {
  const raw = line.slice(0, cols - 4);
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const re = new RegExp(`(${escaped})`, "gi");
  const parts = raw.split(re);
  return (
    <span key={raw}>
      {"    "}
      {parts.map((part, i) =>
        i % 2 === 1
          ? <span key={`${part}-${i}`} className="hx29-highlight">{part}</span>
          : part
      )}
    </span>
  );
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
    __suffix: <span className="hx29-underline">{`link [${n}]`}</span>,
  };
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

  // Linear-time: a single bounded capture group between two fixed delimiters,
  // no nested/overlapping quantifiers — not susceptible to catastrophic backtracking.
  const markerRe = /«([^»]*)»​(\d+)‌/g; // NOSONAR javascript:S8786

  // Deliberately polymorphic: returns the plain string unchanged when a line has no
  // link markers (so it's typed out character-by-character by the caller), or a
  // <span> when it does (rendered statically). Downstream code branches on this.
  const lines = wrapped.map((line) => { // NOSONAR javascript:S3800
    const lineKey = line.slice(0, 40);
    if (!line.includes("«")) return line;
    const parts = [];
    let last = 0;
    let m;
    markerRe.lastIndex = 0;
    while ((m = markerRe.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      parts.push(
        <span key={`${lineKey}-${m[2]}`} className="hx29-underline">{m[1]}</span>,
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
