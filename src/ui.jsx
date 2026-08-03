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

// Linear-time: a single bounded capture group between two fixed delimiters,
// no nested/overlapping quantifiers — not susceptible to catastrophic backtracking.
const LINK_MARKER_RE = /«([^»]*)»​(\d+)‌/g; // NOSONAR javascript:S8786

// Private-use-area sentinels (never present in real content, not control/escape
// codes, survive stripHtml's DOMParser pass as plain text) marking the extent
// of a heading line so it can be rendered as an underlined <span> — pure HTML/CSS,
// no terminal escape sequences involved.
const HEADING_OPEN = "\uE000";
const HEADING_CLOSE = "\uE001";
const HEADING_LINE_RE = /^\uE000([\s\S]*)\uE001$/;

// Sentinels marking the extent of a <blockquote> so its lines can be prefixed
// with " | " (quote-block visual convention), surrounded by blank lines.
const QUOTE_OPEN = "\uE002";
const QUOTE_CLOSE = "\uE003";
const QUOTE_PREFIX = " | ";

/**
 * Splits text containing `«label»​N‌` link markers into a React children array,
 * rendering each marked label as plain text followed by its `[n]` ref. Links
 * are never underlined — underline is reserved for h1–h6 headings.
 * @param {string} text - Text possibly containing link markers.
 * @returns {Array<string>} React children parts.
 */
function buildLinkParts(text) {
  const parts = [];
  let last = 0;
  let m;
  LINK_MARKER_RE.lastIndex = 0;
  while ((m = LINK_MARKER_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(`${m[1]} [${m[2]}]`);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/**
 * Parses an HTML body, replacing `<a>` links with plain text + numbered
 * footnotes and `<h1>`–`<h6>` headings with underlined React spans (underline
 * is reserved for headings only), then word-wraps the result to `width` characters.
 * A blank line is inserted before every heading except one that opens the content.
 * `<blockquote>` content is prefixed with " | " per line, surrounded by blank lines.
 * @param {string} html - Raw HTML content from the WP REST API.
 * @param {number} width - Terminal character width for word-wrapping.
 * @returns {{lines: Array<string|import('react').ReactElement>, footerLines: string[], footnotes: string[]}}
 *   `lines` — wrapped body content; `footerLines` — footnote URL list; `footnotes` — raw URL array.
 */
export function parseBodyWithLinks(html, width) {
  const footnotes = [];
  const urlIndex = {};

  const quoteMarked = html.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, inner) => `${QUOTE_OPEN}${inner}${QUOTE_CLOSE}`
  );

  const headingMarked = quoteMarked.replace(
    /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi,
    (_, inner) => `${HEADING_OPEN}${inner}${HEADING_CLOSE}`
  );

  const marked = headingMarked.replace(
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

  /**
   * Word-wraps a plain-text (non-quote) segment, marking any h1–h6 heading
   * lines it contains and preceding them with a blank line.
   * @param {string} segment - Text between quote blocks (or the whole body).
   * @param {boolean} isDocumentStart - Whether `segment` opens the article body.
   * @returns {string[]} Wrapped/marked lines.
   */
  function wrapPlainSegment(segment, isDocumentStart) {
    const rawLines = segment.split("\n").filter((l) => l.trim());
    return rawLines.flatMap((l, idx) => {
      const headingMatch = HEADING_LINE_RE.exec(l);
      if (headingMatch) {
        const text = headingMatch[1];
        const headingLines = text.length <= width ? [text] : wordWrap(text, width);
        const markedLines = headingLines.map((h) => `${HEADING_OPEN}${h}${HEADING_CLOSE}`);
        return isDocumentStart && idx === 0 ? markedLines : ["", ...markedLines];
      }
      return l.length <= width ? [l] : wordWrap(l, width);
    });
  }

  /**
   * Word-wraps a `<blockquote>` inner text, prefixing every resulting line with " | ".
   * @param {string} inner - Raw text captured between the quote sentinels.
   * @returns {string[]} `" | "`-prefixed, wrapped quote lines.
   */
  function wrapQuoteSegment(inner) {
    const quoteWidth = Math.max(1, width - QUOTE_PREFIX.length);
    const rawLines = inner.split("\n").filter((l) => l.trim());
    return rawLines.flatMap((l) => {
      const resolved = l.replace(LINK_MARKER_RE, (_, label, num) => `${label} [${num}]`);
      const wrappedLines = resolved.length <= quoteWidth ? [resolved] : wordWrap(resolved, quoteWidth);
      return wrappedLines.map((w) => `${QUOTE_PREFIX}${w}`);
    });
  }

  const QUOTE_SPAN_RE = new RegExp(`${QUOTE_OPEN}([\\s\\S]*?)${QUOTE_CLOSE}`, "g");
  const wrapped = [];
  let lastIndex = 0;
  let qm;
  while ((qm = QUOTE_SPAN_RE.exec(plain)) !== null) {
    if (qm.index > lastIndex) wrapped.push(...wrapPlainSegment(plain.slice(lastIndex, qm.index), lastIndex === 0));
    if (wrapped.length && wrapped[wrapped.length - 1] !== "") wrapped.push("");
    wrapped.push(...wrapQuoteSegment(qm[1]));
    wrapped.push("");
    lastIndex = qm.index + qm[0].length;
  }
  if (lastIndex < plain.length) wrapped.push(...wrapPlainSegment(plain.slice(lastIndex), lastIndex === 0));
  else if (wrapped.length && wrapped[wrapped.length - 1] === "") wrapped.pop();

  // A heading immediately after a quote block would otherwise get a doubled blank
  // line (the quote's trailing blank plus the heading's own leading blank).
  const dedupedWrapped = wrapped.filter((l, i) => l !== "" || wrapped[i - 1] !== "");

  // Deliberately polymorphic: returns the plain string unchanged when a line has no
  // link/heading markers (so it's typed out character-by-character by the caller), or an
  // animated-text descriptor when it does — typed out the same as any other line,
  // with the styled <span> swapped in only once typing completes (__final).
  const lines = dedupedWrapped.map((line) => { // NOSONAR javascript:S3800
    const lineKey = line.slice(0, 40);
    const headingMatch = HEADING_LINE_RE.exec(line);
    if (headingMatch) {
      const text = headingMatch[1];
      return {
        __animText: text.replace(LINK_MARKER_RE, (_, label, num) => `${label} [${num}]`),
        __final: <span key={lineKey} className="hx29-underline">{buildLinkParts(text)}</span>,
      };
    }
    if (!line.includes("«")) return line;
    return {
      __animText: line.replace(LINK_MARKER_RE, (_, label, num) => `${label} [${num}]`),
      __final: <span key={lineKey}>{buildLinkParts(line)}</span>,
    };
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
