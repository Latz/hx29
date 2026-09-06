import { stripHtml, wordWrap } from "./format.js";

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

// Sentinels marking <li> items: LI_BULLET for unordered ("* "), LI_NUM_OPEN
// for ordered (immediately followed by its literal "N." before the item text).
const LI_BULLET = "\uE004";
const LI_NUM_OPEN = "\uE005";
const LI_CLOSE = "\uE006";
const LI_BULLET_RE = /^\uE004([\s\S]*)\uE006$/;
const LI_NUM_RE = /^\uE005(\d+)\.([\s\S]*)\uE006$/;
const LIST_INDENT = "  ";

// Sentinels marking the extent of a <pre><code> block so its lines can be
// prefixed with ":> " (REPL/console-style "this is code" convention), surrounded
// by blank lines. Distinct from QUOTE_PREFIX/LIST_INDENT so code is visually
// distinguishable from quotes and lists.
const CODE_OPEN = "";
const CODE_CLOSE = "";
const CODE_PREFIX = ":> ";
const CODE_INDENT = "  ";

// Sentinels marking the extent of a wp-block-pullquote figure. PULLQUOTE_CITE_SEP
// separates the quote body from an optional <cite> within the same marked span.
// Rendered as a dashed-border box, distinguishing it from a plain <blockquote>'s " | ".
const PULLQUOTE_OPEN = "";
const PULLQUOTE_CITE_SEP = "";
const PULLQUOTE_CLOSE = "";
const PULLQUOTE_INDENT = "  ";

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
 * `<li>` items are indented and prefixed with "* " (unordered) or "N. " (ordered),
 * with hanging-indented wrapped continuation lines, surrounded by blank lines.
 * `<pre><code>` blocks are indented and prefixed with ":> " per line (internal
 * blank lines preserved), surrounded by blank lines.
 * `wp-block-pullquote` figures are rendered as a dashed-border box (sized to
 * the longest quote/citation line plus a 2-space margin per side, not the
 * full terminal width) with an indented body and an optional right-aligned
 * "-- Author" citation line.
 * @param {string} html - Raw HTML content from the WP REST API.
 * @param {number} width - Terminal character width for word-wrapping.
 * @returns {{lines: Array<string|import('react').ReactElement>, footerLines: string[], footnotes: string[]}}
 *   `lines` — wrapped body content; `footerLines` — footnote URL list; `footnotes` — raw URL array.
 */
export function parseBodyWithLinks(html, width) {
  const footnotes = [];
  // No Object.prototype, so a URL like "constructor" or "toString" can't
  // read a truthy inherited value off the plain-object guard below.
  const urlIndex = Object.create(null);

  // Marked first, before the plain <blockquote> pass, so its nested
  // <blockquote> isn't also caught by that regex.
  const pullquoteMarked = html.replace(
    /<figure[^>]*class="[^"]*wp-block-pullquote[^"]*"[^>]*>\s*<blockquote[^>]*>([\s\S]*?)(?:<cite[^>]*>([\s\S]*?)<\/cite>)?<\/blockquote>\s*<\/figure>/gi,
    (_, body, citation) => `${PULLQUOTE_OPEN}${body}${PULLQUOTE_CITE_SEP}${citation ?? ""}${PULLQUOTE_CLOSE}`
  );

  const codeMarked = pullquoteMarked.replace(
    /<pre[^>]*>(?:<code[^>]*>)?([\s\S]*?)(?:<\/code>)?<\/pre>/gi,
    (_, inner) => `${CODE_OPEN}${inner}${CODE_CLOSE}`
  );

  const quoteMarked = codeMarked.replace(
    /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
    (_, inner) => `${QUOTE_OPEN}${inner}${QUOTE_CLOSE}`
  );

  // A leading "\n" is prepended to every marked item because real WP list
  // markup has no whitespace between adjacent <li> tags, so stripHtml's
  // textContent-style extraction would otherwise merge all items onto one line.
  const olMarked = quoteMarked.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let n = 0;
    return inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_2, item) => `\n${LI_NUM_OPEN}${++n}.${item}${LI_CLOSE}`);
  });

  const listMarked = olMarked.replace(
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, inner) => inner.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_2, item) => `\n${LI_BULLET}${item}${LI_CLOSE}`)
  );

  const headingMarked = listMarked.replace(
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
   * lines it contains (preceded by a blank line) and rendering any `<li>`
   * lines with a `"* "` (unordered) or `"N. "` (ordered) prefix, hanging-indenting
   * wrapped continuation lines and surrounding the run of list items with blank lines.
   * @param {string} segment - Text between quote blocks (or the whole body).
   * @param {boolean} isDocumentStart - Whether `segment` opens the article body.
   * @returns {string[]} Wrapped/marked lines.
   */
  function wrapPlainSegment(segment, isDocumentStart) {
    const rawLines = segment.split("\n").filter((l) => l.trim());
    const out = [];
    let prevWasListItem = false;
    rawLines.forEach((l, idx) => {
      const headingMatch = HEADING_LINE_RE.exec(l);
      if (headingMatch) {
        const text = headingMatch[1];
        const headingLines = text.length <= width ? [text] : wordWrap(text, width);
        const markedLines = headingLines.map((h) => `${HEADING_OPEN}${h}${HEADING_CLOSE}`);
        if (isDocumentStart && idx === 0) out.push(...markedLines);
        else out.push("", ...markedLines);
        prevWasListItem = false;
        return;
      }

      const bulletMatch = LI_BULLET_RE.exec(l);
      const numMatch = bulletMatch ? null : LI_NUM_RE.exec(l);
      if (bulletMatch || numMatch) {
        if (!prevWasListItem && !(isDocumentStart && idx === 0)) out.push("");
        const marker = bulletMatch ? "* " : `${numMatch[1]}. `;
        const text = bulletMatch ? bulletMatch[1] : numMatch[2];
        const itemWidth = Math.max(1, width - LIST_INDENT.length - marker.length);
        const wrappedLines = text.length <= itemWidth ? [text] : wordWrap(text, itemWidth);
        const continuationIndent = LIST_INDENT + " ".repeat(marker.length);
        out.push(
          LIST_INDENT + marker + wrappedLines[0],
          ...wrappedLines.slice(1).map((w) => continuationIndent + w)
        );
        prevWasListItem = true;
        return;
      }

      if (prevWasListItem) out.push("");
      prevWasListItem = false;
      out.push(...(l.length <= width ? [l] : wordWrap(l, width)));
    });
    return out;
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

  /**
   * Splits a `<pre><code>` inner text into lines, preserving internal blank
   * lines (meaningful in code) while trimming exactly one leading/trailing
   * blank line (an artifact of `<code>\n...\n</code>` markup), and prefixes
   * every non-blank resulting line with an indent + ":> ".
   * @param {string} inner - Raw text captured between the code sentinels.
   * @returns {string[]} Indented, ":> "-prefixed code lines, blank lines preserved bare.
   */
  function wrapCodeSegment(inner) {
    let rawLines = inner.split("\n");
    if (rawLines.length && rawLines[0].trim() === "") rawLines = rawLines.slice(1);
    if (rawLines.length && rawLines[rawLines.length - 1].trim() === "") rawLines = rawLines.slice(0, -1);
    const codeWidth = Math.max(1, width - CODE_INDENT.length - CODE_PREFIX.length);
    return rawLines.flatMap((l) => {
      if (l.trim() === "") return [""];
      const resolved = l.replace(LINK_MARKER_RE, (_, label, num) => `${label} [${num}]`);
      const wrappedLines = resolved.length <= codeWidth ? [resolved] : wordWrap(resolved, codeWidth);
      return wrappedLines.map((w) => `${CODE_INDENT}${CODE_PREFIX}${w}`);
    });
  }

  /**
   * Word-wraps a wp-block-pullquote's body + optional citation into a
   * dashed-border box sized to the longest content line plus a 2-space margin
   * on each side (not the full terminal width), right-aligning "-- Author".
   * @param {string} spanInner - Raw text between the pullquote sentinels
   *   (`body${PULLQUOTE_CITE_SEP}citation`).
   * @returns {string[]} Border, indented body lines, border, optional citation line.
   */
  function wrapPullquoteSegment(spanInner) {
    const [body, citation] = spanInner.split(PULLQUOTE_CITE_SEP);
    const maxContentWidth = Math.max(1, width - 2 * PULLQUOTE_INDENT.length);
    const bodyLines = body
      .split("\n")
      .filter((l) => l.trim())
      .flatMap((l) => {
        const resolved = l.replace(LINK_MARKER_RE, (_, label, num) => `${label} [${num}]`);
        return resolved.length <= maxContentWidth ? [resolved] : wordWrap(resolved, maxContentWidth);
      });

    const trimmedCitation = citation?.trim();
    const citationLine = trimmedCitation
      ? `-- ${trimmedCitation.replace(LINK_MARKER_RE, (_, label, num) => `${label} [${num}]`)}`
      : null;

    const contentLines = citationLine ? [...bodyLines, citationLine] : bodyLines;
    const boxWidth = Math.max(...contentLines.map((l) => l.length)) + 2 * PULLQUOTE_INDENT.length;
    const border = "-".repeat(boxWidth);

    const lines = [border, ...bodyLines.map((l) => `${PULLQUOTE_INDENT}${l}`), border];
    if (citationLine) {
      const leftPad = boxWidth - PULLQUOTE_INDENT.length - citationLine.length;
      lines.push(`${" ".repeat(Math.max(0, leftPad))}${citationLine}`);
    }
    return lines;
  }

  const BLOCK_SPAN_RE = new RegExp(
    `${QUOTE_OPEN}([\\s\\S]*?)${QUOTE_CLOSE}|${CODE_OPEN}([\\s\\S]*?)${CODE_CLOSE}|${PULLQUOTE_OPEN}([\\s\\S]*?)${PULLQUOTE_CLOSE}`,
    "g"
  );
  const wrapped = [];
  let lastIndex = 0;
  let qm;
  while ((qm = BLOCK_SPAN_RE.exec(plain)) !== null) {
    if (qm.index > lastIndex) wrapped.push(...wrapPlainSegment(plain.slice(lastIndex, qm.index), lastIndex === 0));
    if (wrapped.length && wrapped[wrapped.length - 1] !== "") wrapped.push("");
    if (qm[1] !== undefined) wrapped.push(...wrapQuoteSegment(qm[1]));
    else if (qm[2] !== undefined) wrapped.push(...wrapCodeSegment(qm[2]));
    else wrapped.push(...wrapPullquoteSegment(qm[3]));
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
