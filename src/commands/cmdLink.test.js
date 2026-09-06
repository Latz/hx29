import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../i18n/index.js", () => ({
  t: {
    link_usage: "Usage: link <number>",
    link_unknown_num: (n) => `Number ${n} unknown.`,
    link_no_url: "No URL available.",
    link_opening: (u) => `Opening: ${u}`,
  },
}));

import cmdLink from "./cmdLink.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("cmdLink", () => {
  it("returns usage when arg is not numeric", () => {
    const result = cmdLink(["x"], { current: null });
    expect(result[0]).toContain("Usage: link");
  });

  it("returns unknown_num when n has no slugMap entry and no footnote", () => {
    const pager = { current: { slugMap: {} } };
    const result = cmdLink(["5"], pager);
    expect(result[0]).toContain("5");
  });

  it("opens an http(s) URL from the slugMap", () => {
    const pager = { current: { slugMap: { 1: { url: "https://example.com/post" } } } };
    const result = cmdLink(["1"], pager);
    expect(result[0]).toContain("https://example.com/post");
  });

  it("opens an http(s) URL from footnotes, preferred over slugMap", () => {
    const pager = { current: { footnotes: ["https://example.com/footnote"], slugMap: {} } };
    const result = cmdLink(["1"], pager);
    expect(result[0]).toContain("https://example.com/footnote");
  });

  it("opens a mailto: URL", () => {
    const pager = { current: { slugMap: { 1: { url: "mailto:test@example.com" } } } };
    const result = cmdLink(["1"], pager);
    expect(result[0]).toContain("mailto:test@example.com");
  });

  // robustness.md/security.md LOW: no scheme allowlist — a javascript: URL
  // planted in post content (requires unfiltered_html) would otherwise
  // execute in this origin via the synthetic anchor click.
  it("refuses a javascript: URL instead of clicking it", () => {
    const pager = { current: { slugMap: { 1: { url: "javascript:alert(1)" } } } };
    const result = cmdLink(["1"], pager);
    expect(result[0]).toBe("No URL available.");
    expect(document.body.querySelector("a")).toBeNull();
  });

  it("refuses a data: URL", () => {
    const pager = { current: { slugMap: { 1: { url: "data:text/html,<script>alert(1)</script>" } } } };
    const result = cmdLink(["1"], pager);
    expect(result[0]).toBe("No URL available.");
  });
});
