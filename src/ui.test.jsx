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
    expect(container.innerHTML).toContain("background");
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

  it("returns React elements for lines containing links", () => {
    const html = '<p>Check <a href="https://example.com">this link</a> out</p>';
    const { lines } = parseBodyWithLinks(html, 80);
    expect(lines.some((l) => isValidElement(l))).toBe(true);
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

  it("strips empty lines from output", () => {
    const { lines } = parseBodyWithLinks("<p></p><p>Hello</p><p></p>", 80);
    expect(lines.some((l) => typeof l === "string" && l.trim() === "")).toBe(false);
  });

  it("renders link label as underlined text in output", () => {
    const html = '<p><a href="https://example.com">click here</a></p>';
    const { lines } = parseBodyWithLinks(html, 80);
    const elementLines = lines.filter((l) => isValidElement(l));
    expect(elementLines.length).toBeGreaterThan(0);
    const { container } = render(elementLines[0]);
    expect(container.textContent).toContain("click here");
    expect(container.innerHTML).toContain("underline");
  });
});
