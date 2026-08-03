import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../api/taxonomy.js", () => ({ fetchCategories: vi.fn() }));
vi.mock("../utils.js", () => ({ getPageLines: vi.fn(() => 100), stripHtml: vi.fn((s) => s) }));
vi.mock("../i18n/index.js", () => ({
  t: {
    tree_no_categories: "No categories found.",
    more_chars_left: (n) => `[n]ext (${n} chars remaining)`,
  },
}));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));

import { fetchCategories } from "../api/taxonomy.js";
import { getPageLines } from "../utils.js";
import cmdTree from "./cmdTree.js";

const CAT = (id, name, parent = 0, count = 3) => ({
  id, slug: `cat-${id}`, name, link: `https://example.com/cat-${id}`, parent, count,
});

beforeEach(() => {
  vi.clearAllMocks();
  getPageLines.mockReturnValue(100);
});

describe("cmdTree", () => {
  it("returns the no-categories message when there are none", async () => {
    fetchCategories.mockResolvedValue({ cats: [], total: 0 });
    const result = await cmdTree({ current: null });
    expect(result).toEqual(["No categories found."]);
  });

  it("renders a flat list of top-level categories with connectors", async () => {
    fetchCategories.mockResolvedValue({
      cats: [CAT(1, "Tech"), CAT(2, "Life")],
      total: 2,
    });
    const pager = { current: null };
    const result = await cmdTree(pager);
    expect(result).toContain("├── 1. Tech (3)");
    expect(result).toContain("└── 2. Life (3)");
  });

  it("nests children under their parent with indented connectors", async () => {
    fetchCategories.mockResolvedValue({
      cats: [CAT(1, "Tech"), CAT(2, "JavaScript", 1), CAT(3, "Python", 1)],
      total: 3,
    });
    const pager = { current: null };
    const result = await cmdTree(pager);
    expect(result[0]).toBe("└── 1. Tech (3)");
    expect(result[1]).toBe("    ├── 2. JavaScript (3)");
    expect(result[2]).toBe("    └── 3. Python (3)");
  });

  it("builds a slugMap so link <n> can open a category's archive page", async () => {
    fetchCategories.mockResolvedValue({ cats: [CAT(1, "Tech")], total: 1 });
    const pager = { current: null };
    await cmdTree(pager);
    expect(pager.current.slugMap[1]).toEqual({ slug: "cat-1", id: 1, url: "https://example.com/cat-1" });
  });

  it("paginates when the tree exceeds one screen", async () => {
    getPageLines.mockReturnValue(2);
    fetchCategories.mockResolvedValue({
      cats: [CAT(1, "A"), CAT(2, "B"), CAT(3, "C")],
      total: 3,
    });
    const pager = { current: null };
    const result = await cmdTree(pager);
    expect(result).toContainLineWithText("[n]ext");
    expect(pager.current.type).toBe("article");
    expect(pager.current.offset).toBe(2);
    expect(pager.current.lines.length).toBe(3);
  });

  it("does not set article continuation state when everything fits on one page", async () => {
    fetchCategories.mockResolvedValue({ cats: [CAT(1, "Tech")], total: 1 });
    const pager = { current: null };
    await cmdTree(pager);
    expect(pager.current.lines).toEqual([]);
    expect(pager.current.offset).toBe(0);
  });

  it("returns an error message on API failure", async () => {
    fetchCategories.mockRejectedValue(new Error("timeout"));
    const result = await cmdTree({ current: null });
    expect(result[0]).toContain("Error:");
  });
});
