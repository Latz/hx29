import { describe, it, expect, vi } from "vitest";

vi.mock("../i18n/index.js", () => ({
  t: {
    read_categories: (s, n) => `${n === 1 ? "Category" : "Categories"}: ${s}`,
    read_tags: (s) => `Tags: ${s}`,
  },
}));
vi.mock("../utils.js", () => ({
  wordWrap: (s) => [s],
  stripHtml: (s) => s.replace(/<[^>]*>/g, ""),
}));

import { buildArticleHeader } from "./articleHeader.js";

function makePost({ title = "Test Post", terms } = {}) {
  return {
    title: { rendered: title },
    _embedded: terms ? { "wp:term": terms } : undefined,
  };
}

describe("buildArticleHeader", () => {
  it("builds a header with just title and date when there are no terms", () => {
    const { titleLines, headerLines } = buildArticleHeader(makePost(), "Published: 1 Jan 2025", 80);
    expect(titleLines).toEqual(["Test Post"]);
    expect(headerLines[0]).toMatch(/^-+$/);
    expect(headerLines).toContain("Test Post");
    expect(headerLines).toContain("Published: 1 Jan 2025");
    expect(headerLines.at(-1)).toMatch(/^-+$/);
  });

  it("includes only the categories line when there are no tags", () => {
    const post = makePost({ terms: [[{ name: "Tech" }, { name: "Web" }], []] });
    const { headerLines } = buildArticleHeader(post, "Published: 1 Jan 2025", 80);
    expect(headerLines).toContain("Categories: Tech, Web");
    expect(headerLines.some((l) => l.startsWith("Tags:"))).toBe(false);
  });

  it("uses the singular label for a single category", () => {
    const post = makePost({ terms: [[{ name: "Tech" }], []] });
    const { headerLines } = buildArticleHeader(post, "Published: 1 Jan 2025", 80);
    expect(headerLines).toContain("Category: Tech");
  });

  it("includes only the tags line when there are no categories", () => {
    const post = makePost({ terms: [[], [{ name: "rust" }]] });
    const { headerLines } = buildArticleHeader(post, "Published: 1 Jan 2025", 80);
    expect(headerLines).toContain("Tags: rust");
    expect(headerLines.some((l) => l.startsWith("Categories:"))).toBe(false);
  });

  it("combines categories and tags onto one line when it fits the header width", () => {
    const post = makePost({ terms: [[{ name: "Tech" }], [{ name: "rust" }]] });
    // A wide date line pushes baseW well past the combined "Categories: Tech  Tags: rust" length.
    const wideDateLine = "Published: 1 January 2025, in the distant cyber-future";
    const { headerLines } = buildArticleHeader(post, wideDateLine, 80);
    expect(headerLines).toContain("Category: Tech  Tags: rust");
  });

  it("splits categories and tags onto separate lines when combined they exceed the header width", () => {
    const longCat = "A".repeat(60);
    const longTag = "B".repeat(60);
    const post = makePost({ terms: [[{ name: longCat }], [{ name: longTag }]] });
    const { headerLines } = buildArticleHeader(post, "Published: 1 Jan 2025", 80);
    expect(headerLines).toContain(`Category: ${longCat}`);
    expect(headerLines).toContain(`Tags: ${longTag}`);
    expect(headerLines).not.toContain(`Category: ${longCat}  Tags: ${longTag}`);
  });

  it("sizes the rule lines to the widest line in the header", () => {
    const post = makePost({ title: "Short", terms: [[{ name: "A".repeat(50) }], []] });
    const { headerLines } = buildArticleHeader(post, "d", 80);
    const ruleLen = headerLines[0].length;
    for (const line of headerLines) {
      if (typeof line === "string") expect(line.length).toBeLessThanOrEqual(ruleLen);
    }
  });
});
