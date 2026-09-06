import { describe, it, expect, vi, beforeEach } from "vitest";
import { isValidElement } from "@wordpress/element";
import { render, screen } from "@testing-library/react";
import { highlightMatch, fmtLineEl, parseBodyWithLinks } from "./ui.jsx";

vi.mock("./format.js", () => ({
  fmtLine: vi.fn((n, title) => `${n}. ${title}`),
  stripHtml: vi.fn((s) => s.replace(/<[^>]*>/g, "")),
  wordWrap: vi.fn((s, w) => {
    const words = s.split(" ");
    const lines = [];
    let cur = "";
    for (const word of words) {
      if ((cur + " " + word).trim().length <= w) {
        cur = (cur + " " + word).trim();
      } else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }),
  LINE_W: 80,
}));

beforeEach(() => vi.clearAllMocks());

describe("highlightMatch", () => {
  it("returns a React element", () => {
    const el = highlightMatch("This is a test line", "test", 80);
    expect(isValidElement(el)).toBe(true);
  });

  it("wraps matched term in an inner span", () => {
    const { container } = render(highlightMatch("This is a test line", "test", 80));
    const innerSpan = container.querySelector("span span");
    expect(innerSpan).not.toBeNull();
    expect(innerSpan.textContent).toBe("test");
  });

  it("returns span even when term is not found", () => {
    const { container } = render(highlightMatch("Hello world", "zzz", 80));
    expect(container.textContent).toContain("Hello world");
    expect(container.querySelectorAll("span span")).toHaveLength(0);
  });

  it("truncates line to cols-4 characters", () => {
    const line = "A".repeat(100);
    const { container } = render(highlightMatch(line, "X", 20));
    expect(container.textContent.replace(/\s/g, "").length).toBeLessThanOrEqual(16 + 4);
  });

  it("is case-insensitive — matches WORLD with 'world'", () => {
    const { container } = render(highlightMatch("Hello WORLD", "world", 80));
    const innerSpan = container.querySelector("span span");
    expect(innerSpan).not.toBeNull();
    expect(innerSpan.textContent).toBe("WORLD");
    expect(container.innerHTML).toContain("hx29-highlight");
  });
});

describe("fmtLineEl", () => {
  it("returns object with __animText and __suffix keys", () => {
    const result = fmtLineEl(1, "My Title", "2025-01-01");
    expect(result).toHaveProperty("__animText");
    expect(result).toHaveProperty("__suffix");
  });

  it("__animText contains formatted line", () => {
    const result = fmtLineEl(3, "My Title", "2025-01-01");
    expect(result.__animText).toContain("3. My Title");
  });

  it("__suffix is a React element containing 'link [n]'", () => {
    const result = fmtLineEl(5, "Title", "2025");
    expect(isValidElement(result.__suffix)).toBe(true);
    render(result.__suffix);
    expect(screen.getByText("link [5]")).not.toBeNull();
  });

  it("__suffix has underline style", () => {
    const result = fmtLineEl(2, "Title", "2025");
    const { container } = render(result.__suffix);
    expect(container.innerHTML).toContain("underline");
  });
});

describe("parseBodyWithLinks", () => {
  it("returns {lines, footerLines, footnotes}", () => {
    const result = parseBodyWithLinks("<p>Hello world</p>", 80);
    expect(result).toHaveProperty("lines");
    expect(result).toHaveProperty("footerLines");
    expect(result).toHaveProperty("footnotes");
  });

  it("returns plain strings for text without links", () => {
    const { lines } = parseBodyWithLinks("<p>Hello world</p>", 80);
    expect(lines.every((l) => typeof l === "string")).toBe(true);
  });

  it("returns animated-text descriptors for lines containing links", () => {
    const html = '<p>Check <a href="https://example.com">this link</a> out</p>';
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines.some((l) => typeof l === "object" && typeof l.__animText === "string" && isValidElement(l.__final))).toBe(true);
  });

  it("collects footnote URLs", () => {
    const html = '<p><a href="https://example.com">example</a></p>';
    const { footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toContain("https://example.com");
  });

  it("generates footerLines with numbered references when links present", () => {
    const html = '<p><a href="https://example.com">example</a></p>';
    const { footerLines } = parseBodyWithLinks(html, 80);
    expect(footerLines.some((l) => l.includes("[1]") && l.includes("https://example.com"))).toBe(true);
  });

  it("returns empty footerLines when no links", () => {
    const { footerLines } = parseBodyWithLinks("<p>No links here</p>", 80);
    expect(footerLines).toHaveLength(0);
  });

  it("deduplicates repeated URLs — only one footnote entry", () => {
    const html = '<p><a href="https://example.com">A</a> and <a href="https://example.com">B</a></p>';
    const { footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toHaveLength(1);
  });

  // security.md LOW: urlIndex was a plain object, so a link literally
  // targeting "constructor"/"toString" read a truthy value off
  // Object.prototype instead of being registered as a real footnote.
  it("registers a link whose href is an Object.prototype property name (e.g. 'constructor')", () => {
    const html = '<p><a href="constructor">A</a></p>';
    const { footnotes, footerLines } = parseBodyWithLinks(html, 80);
    expect(footnotes).toEqual(["constructor"]);
    expect(footerLines.some((l) => l.includes("[1]") && l.includes("constructor"))).toBe(true);
  });

  it("keeps 'toString' and a real URL as two distinct footnotes", () => {
    const html = '<p><a href="toString">A</a> <a href="https://example.com">B</a></p>';
    const { footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toEqual(["toString", "https://example.com"]);
  });

  it("strips empty lines from output", () => {
    const { lines } = parseBodyWithLinks("<p></p><p>Hello</p><p></p>", 80);
    expect(lines.some((l) => typeof l === "string" && l.trim() === "")).toBe(false);
  });

  it("renders link label as plain (non-underlined) text with a footnote suffix", () => {
    const html = '<p><a href="https://example.com">click here</a></p>';
    const { lines } = parseBodyWithLinks(html, 80);
    const linkLines = lines.filter((l) => typeof l === "object" && isValidElement(l.__final));
    expect(linkLines.length).toBeGreaterThan(0);
    expect(linkLines[0].__animText).toContain("click here");
    const { container } = render(linkLines[0].__final);
    expect(container.textContent).toContain("click here [1]");
    expect(container.innerHTML).not.toContain("underline");
  });

  it("renders a heading as underlined text", () => {
    const html = "<h2>Some Heading</h2>";
    const { lines } = parseBodyWithLinks(html, 80);
    const headingLines = lines.filter((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingLines.length).toBeGreaterThan(0);
    expect(headingLines[0].__animText).toBe("Some Heading");
    const { container } = render(headingLines[0].__final);
    expect(container.textContent).toContain("Some Heading");
    expect(container.innerHTML).toContain("underline");
  });

  it("underlines all heading levels h1 through h6", () => {
    for (let level = 1; level <= 6; level++) {
      const html = `<h${level}>Heading ${level}</h${level}>`;
      const { lines } = parseBodyWithLinks(html, 80);
      const headingLine = lines.find((l) => typeof l === "object" && isValidElement(l.__final));
      expect(headingLine).toBeDefined();
      const { container } = render(headingLine.__final);
      expect(container.textContent).toContain(`Heading ${level}`);
      expect(container.innerHTML).toContain("underline");
    }
  });

  it("keeps a link's own footnote marker inside an underlined heading", () => {
    const html = '<h2>See <a href="https://example.com">this</a></h2>';
    const { lines, footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toContain("https://example.com");
    const headingLines = lines.filter((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingLines.length).toBeGreaterThan(0);
    const { container } = render(headingLines[0].__final);
    expect(container.textContent).toContain("this [1]");
    const underlineCount = (container.innerHTML.match(/hx29-underline/g) || []).length;
    expect(underlineCount).toBe(1);
  });

  it("word-wraps a long heading across multiple underlined lines", () => {
    const longHeading = "word ".repeat(30).trim();
    const html = `<h1>${longHeading}</h1>`;
    const { lines } = parseBodyWithLinks(html, 20);
    const headingLines = lines.filter((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingLines.length).toBeGreaterThan(1);
    headingLines.forEach((l) => {
      const { container } = render(l.__final);
      expect(container.innerHTML).toContain("underline");
    });
  });

  it("inserts a blank line before a heading that follows other content", () => {
    const html = "<p>Intro text</p>\n\n<h2>Some Heading</h2>";
    const { lines } = parseBodyWithLinks(html, 80);
    const headingIdx = lines.findIndex((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingIdx).toBeGreaterThan(0);
    expect(lines[headingIdx - 1]).toBe("");
  });

  it("does not insert a leading blank line when a heading opens the content", () => {
    const html = "<h1>Opening Heading</h1>\n\n<p>Body text</p>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines[0]).not.toBe("");
    expect(typeof lines[0]).toBe("object");
  });

  it("prefixes blockquote lines with ' | ' and surrounds the block with blank lines", () => {
    const html = "<p>Intro</p>\n\n<blockquote><p>A wise quote.</p></blockquote>\n\n<p>Outro</p>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines).toEqual(["Intro", "", " | A wise quote.", "", "Outro"]);
  });

  it("word-wraps a long quote, prefixing every wrapped line", () => {
    const longQuote = "word ".repeat(30).trim();
    const html = `<blockquote><p>${longQuote}</p></blockquote>`;
    const { lines } = parseBodyWithLinks(html, 20);
    const quoteLines = lines.filter((l) => typeof l === "string" && l.startsWith(" | "));
    expect(quoteLines.length).toBeGreaterThan(1);
    quoteLines.forEach((l) => expect(l.startsWith(" | ")).toBe(true));
  });

  it("does not double up blank lines when a heading directly follows a quote", () => {
    const html = "<blockquote><p>Quote text</p></blockquote>\n\n<h2>Heading</h2>";
    const { lines } = parseBodyWithLinks(html, 80);
    const headingIdx = lines.findIndex((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingIdx).toBeGreaterThan(0);
    expect(lines[headingIdx - 1]).toBe("");
    expect(lines[headingIdx - 2]).not.toBe("");
  });

  it("resolves a link inside a quote to plain text with its footnote suffix", () => {
    const html = '<blockquote><p>See <a href="https://example.com">this</a>.</p></blockquote>';
    const { lines, footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toContain("https://example.com");
    expect(lines).toContain(" | See this [1].");
  });

  it("indents and prefixes unordered list items with '* '", () => {
    const html = "<ul><li>First</li><li>Second</li></ul>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines).toEqual(["  * First", "  * Second"]);
  });

  it("indents and prefixes ordered list items with sequential numbers", () => {
    const html = "<ol><li>First</li><li>Second</li></ol>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines).toEqual(["  1. First", "  2. Second"]);
  });

  it("surrounds a list block with blank lines when it follows and precedes other content", () => {
    const html = "<p>Intro</p>\n\n<ul><li>First</li><li>Second</li></ul>\n\n<p>Outro</p>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines).toEqual(["Intro", "", "  * First", "  * Second", "", "Outro"]);
  });

  it("word-wraps a long list item, hanging-indenting continuation lines without repeating the marker", () => {
    const longItem = "word ".repeat(30).trim();
    const html = `<ul><li>${longItem}</li></ul>`;
    const { lines } = parseBodyWithLinks(html, 20);
    const itemLines = lines.filter((l) => typeof l === "string" && l.trim());
    expect(itemLines.length).toBeGreaterThan(1);
    expect(itemLines[0].startsWith("  * ")).toBe(true);
    itemLines.slice(1).forEach((l) => {
      expect(l.startsWith("  * ")).toBe(false);
      expect(l.startsWith("    ")).toBe(true);
    });
  });

  it("does not insert a blank line between list items", () => {
    const html = "<p>Intro</p>\n\n<ul><li>First</li><li>Second</li><li>Third</li></ul>\n\n<p>Outro</p>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines.filter((l) => l === "")).toHaveLength(2);
  });

  it("resolves a link inside a list item to plain text with its footnote suffix", () => {
    const html = '<ul><li>See <a href="https://example.com">this</a>.</li></ul>';
    const { lines, footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toContain("https://example.com");
    const itemLines = lines.filter((l) => typeof l === "object" && isValidElement(l.__final));
    expect(itemLines.length).toBeGreaterThan(0);
    expect(itemLines[0].__animText).toBe("  * See this [1].");
  });

  it("does not double up blank lines when a heading directly follows a list", () => {
    const html = "<ul><li>Item</li></ul>\n\n<h2>Heading</h2>";
    const { lines } = parseBodyWithLinks(html, 80);
    const headingIdx = lines.findIndex((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingIdx).toBeGreaterThan(0);
    expect(lines[headingIdx - 1]).toBe("");
    expect(lines[headingIdx - 2]).not.toBe("");
  });

  it("indents and prefixes code block lines with ':> ' and surrounds the block with blank lines", () => {
    const html = "<p>Intro</p>\n\n<pre><code>line one\nline two</code></pre>\n\n<p>Outro</p>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines).toEqual(["Intro", "", "  :> line one", "  :> line two", "", "Outro"]);
  });

  it("preserves an internal blank line inside a code block without indenting/prefixing it", () => {
    const html = "<pre><code>line one\n\nline two</code></pre>";
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines).toEqual(["  :> line one", "", "  :> line two"]);
  });

  it("word-wraps a long code line, prefixing every wrapped line with the indent + ':> '", () => {
    const longLine = "word ".repeat(30).trim();
    const html = `<pre><code>${longLine}</code></pre>`;
    const { lines } = parseBodyWithLinks(html, 20);
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l) => expect(l.startsWith("  :> ")).toBe(true));
  });

  it("does not double up blank lines when a heading directly follows a code block", () => {
    const html = "<pre><code>x = 1</code></pre>\n\n<h2>Heading</h2>";
    const { lines } = parseBodyWithLinks(html, 80);
    const headingIdx = lines.findIndex((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingIdx).toBeGreaterThan(0);
    expect(lines[headingIdx - 1]).toBe("");
    expect(lines[headingIdx - 2]).not.toBe("");
  });

  it("resolves a link inside a code block to plain text with its footnote suffix", () => {
    const html = '<pre><code>see <a href="https://example.com">this</a></code></pre>';
    const { lines, footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toContain("https://example.com");
    expect(lines).toContain("  :> see this [1]");
  });

  it("renders a pullquote as a dashed-border box without a citation", () => {
    const html = '<figure class="wp-block-pullquote"><blockquote><p>Bold statement.</p></blockquote></figure>';
    const { lines } = parseBodyWithLinks(html, 20);
    const boxWidth = "Bold statement.".length + 4;
    expect(lines).toEqual(["-".repeat(boxWidth), "  Bold statement.", "-".repeat(boxWidth)]);
  });

  it("sizes the border to the content, not the full terminal width", () => {
    const html = '<figure class="wp-block-pullquote"><blockquote><p>Short</p></blockquote></figure>';
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines).toEqual(["-".repeat(9), "  Short", "-".repeat(9)]);
  });

  it("renders a pullquote with a right-aligned citation line", () => {
    const html =
      '<figure class="wp-block-pullquote"><blockquote><p>Bold statement.</p><cite>Author</cite></blockquote></figure>';
    const { lines } = parseBodyWithLinks(html, 20);
    const boxWidth = "Bold statement.".length + 4;
    expect(lines[0]).toBe("-".repeat(boxWidth));
    expect(lines[1]).toBe("  Bold statement.");
    expect(lines[2]).toBe("-".repeat(boxWidth));
    expect(lines[3].endsWith("-- Author")).toBe(true);
    expect(lines[3]).toHaveLength(boxWidth - 2);
  });

  it("word-wraps a long pullquote body, indenting every wrapped line", () => {
    const longBody = "word ".repeat(30).trim();
    const html = `<figure class="wp-block-pullquote"><blockquote><p>${longBody}</p></blockquote></figure>`;
    const { lines } = parseBodyWithLinks(html, 20);
    const bodyLines = lines.slice(1, -1);
    expect(bodyLines.length).toBeGreaterThan(1);
    bodyLines.forEach((l) => expect(l.startsWith("  ")).toBe(true));
  });

  it("surrounds a pullquote with blank lines and does not double them up before a heading", () => {
    const html = '<p>Intro</p>\n\n<figure class="wp-block-pullquote"><blockquote><p>Quote</p></blockquote></figure>\n\n<h2>Heading</h2>';
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines[0]).toBe("Intro");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("-".repeat("Quote".length + 4));
    const headingIdx = lines.findIndex((l) => typeof l === "object" && isValidElement(l.__final));
    expect(headingIdx).toBeGreaterThan(0);
    expect(lines[headingIdx - 1]).toBe("");
    expect(lines[headingIdx - 2]).not.toBe("");
  });

  it("resolves a link inside a pullquote body to plain text with its footnote suffix", () => {
    const html =
      '<figure class="wp-block-pullquote"><blockquote><p>See <a href="https://example.com">this</a>.</p></blockquote></figure>';
    const { lines, footnotes } = parseBodyWithLinks(html, 80);
    expect(footnotes).toContain("https://example.com");
    expect(lines).toContain("  See this [1].");
  });
});
