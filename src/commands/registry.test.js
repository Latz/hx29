import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../i18n/index.js", () => ({
  t: {
    unknown_command: (c) => `${c}: command not found`,
    help_available_commands: "Available commands:",
    help_ls: "", help_cd: "", help_read: "", help_link: "", help_search: "",
    help_grep: "", help_comments: "", help_comment: "", help_cat: "", help_history: "",
    help_config: "", help_clear: "", help_help: "", help_man: "", help_tip: "",
    history_empty: "No command history.",
    history_title: "Command history:",
    no_active_pager: "No active pager.",
    config_current_title: "Current configuration:",
    config_font: (v) => `  --font   ${v}px`,
    config_posts: (v) => `  --posts  ${v}`,
    config_theme: (v) => `  --theme  ${v}`,
    config_order: (v) => `  --order  ${v}`,
    config_glow: (v) => `  --glow   ${v}`,
    config_usage: "Usage: config …",
    link_usage: "Usage: link <number>",
    cat_usage: "Usage: cat <number> or cat <slug>",
    read_usage: "Usage: read <number> or r <number>",
    cd_no_context: "No context active.",
    cd_back_to_root: "Back to root.",
    cd_current: (n, t) => `Context: ${n}`,
    search_usage: "Usage: search <term>",
    grep_usage: "Usage: grep <term>",
    comments_usage: "Usage: comments <number>",
    comment_usage: "Usage: comment <number> <text>",
    man_usage: "Usage: man <command>",
    man_available: "Available manual pages: ",
    man_not_found: (t) => `No manual page for '${t}'.`,
    man_available_list: "Available: ",
    man_pages: { ls: ["ls help text"], cd: ["cd help text"], read: ["read help text"] },
    error: (m) => `Error: ${m}`,
  },
}));

vi.mock("../utils.js", () => ({
  saveConfig: vi.fn(),
  applyConfig: vi.fn(),
  getPageLines: vi.fn(() => 20),
  parseBodyWithLinks: vi.fn(() => ({ lines: [], footerLines: [], footnotes: [] })),
  getLineWidth: vi.fn(() => 80),
  stripHtml: vi.fn((s) => s),
  formatDate: vi.fn(() => "2025-01-01"),
  wordWrap: vi.fn((s) => [s]),
  wrapLines: vi.fn((l) => l),
  fmtLine: vi.fn(() => "  1 Post Title       2025-01-01"),
  batchFmtLineEls: vi.fn(() => []),
}));

vi.mock("../api/posts.js", () => ({ fetchPosts: vi.fn(), fetchPostBySlug: vi.fn() }));
vi.mock("../api/pages.js", () => ({ fetchPages: vi.fn() }));
vi.mock("../api/taxonomy.js", () => ({ fetchCategories: vi.fn(), fetchTags: vi.fn() }));
vi.mock("../api/apiFetch.js", () => ({ default: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock("../apiError.js", () => ({ fmtApiError: (e) => `Error: ${e.message}` }));
vi.mock("../api/comments.js", () => ({ fetchComments: vi.fn(), postComment: vi.fn() }));

import { executeCommand } from "./registry.js";

const makePager = () => ({ current: null });
const makeConfig = () => ({ current: { font: 22, posts: 10, theme: "a", order: "desc" } });
const makeContext = () => ({ current: { type: null, id: null, name: null } });
const makeHistory = () => ({ current: [] });

describe("executeCommand", () => {
  let pager, configRef, contextRef, historyRef, setCtxDisplay, pendingRef;

  beforeEach(() => {
    pager = makePager();
    configRef = makeConfig();
    contextRef = makeContext();
    historyRef = makeHistory();
    setCtxDisplay = vi.fn();
    pendingRef = { current: null };
    vi.clearAllMocks();
  });

  const run = (input) =>
    executeCommand(input, pager, configRef, contextRef, historyRef, setCtxDisplay, pendingRef);

  it("returns __CLEAR__ for clear command", async () => {
    expect(await run("clear")).toBe("__CLEAR__");
  });

  it("returns empty array for empty input", async () => {
    expect(await run("")).toEqual([]);
  });

  it("returns unknown command message for unrecognized input", async () => {
    const result = await run("foobar");
    expect(result[0]).toContain("foobar");
    expect(result[0]).toContain("command not found");
  });

  it("dispatches help", async () => {
    const result = await run("help");
    expect(result).toContain("Available commands:");
  });

  it("dispatches history", async () => {
    const result = await run("history");
    expect(result).toContain("No command history.");
  });

  it("dispatches config with no args", async () => {
    const result = await run("config");
    expect(result).toContain("Current configuration:");
  });

  it("dispatches link with no number", async () => {
    const result = await run("link");
    expect(result).toContain("Usage: link <number>");
  });

  it("dispatches l as alias for link", async () => {
    const result = await run("l");
    expect(result).toContain("Usage: link <number>");
  });

  it("dispatches read with no args", async () => {
    const result = await run("read");
    expect(result).toContain("Usage: read <number> or r <number>");
  });

  it("dispatches r as alias for read", async () => {
    const result = await run("r");
    expect(result).toContain("Usage: read <number> or r <number>");
  });

  it("dispatches cat with no args", async () => {
    const result = await run("cat");
    expect(result).toContain("Usage: cat <number> or cat <slug>");
  });

  it("dispatches search with no args", async () => {
    const result = await run("search");
    expect(result).toContain("Usage: search <term>");
  });

  it("dispatches grep with no args", async () => {
    const result = await run("grep");
    expect(result).toContain("Usage: grep <term>");
  });

  it("dispatches comments with no args", async () => {
    const result = await run("comments");
    expect(result).toContain("Usage: comments <number>");
  });

  it("dispatches c as alias for comment", async () => {
    const result = await run("c");
    expect(result).toContain("Usage: comment <number> <text>");
  });

  it("dispatches cd with no args and no context", async () => {
    const result = await run("cd");
    expect(result).toContain("No context active.");
  });

  it("dispatches man with no args", async () => {
    const result = await run("man");
    expect(result).toContain("Usage: man <command>");
  });

  it("is case-insensitive for commands", async () => {
    const result = await run("HELP");
    expect(result).toContain("Available commands:");
  });

  it("trims extra whitespace from input", async () => {
    const result = await run("  help  ");
    expect(result).toContain("Available commands:");
  });
});
