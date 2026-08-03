import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../i18n/index.js", () => ({
  t: {
    locale: "en-US",
    help_available_commands: "Available commands:",
    help_ls: "  ls …",
    help_cd: "  cd …",
    help_read: "  read …",
    help_link: "  link …",
    help_search: "  search …",
    help_grep: "  grep …",
    help_comments: "  comments …",
    help_reply: "  reply …",
    help_cat: "  cat …",
    help_history: "  history …",
    help_config: "  config …",
    help_clear: "  clear …",
    help_help: "  help …",
    help_man: "  man …",
    help_tip: "Tip: Arrow keys",
    history_empty: "No command history.",
    history_title: "Command history:",
    link_usage: "Usage: link <number>",
    link_unknown_num: (n) => `Number ${n} unknown.`,
    link_no_url: "No URL available.",
    link_opening: (u) => `Opening: ${u}`,
    config_current_title: "Current configuration:",
    config_font: (v) => `  --font   ${v}px`,
    config_posts: (v) => `  --posts  ${v}`,
    config_theme: (v) => `  --theme  ${v}`,
    config_order: (v) => `  --order  ${v}`,
    config_glow: (v) => `  --glow   ${v}`,
    config_scroll: (v) => `  --scroll ${v}`,
    config_usage: "Usage: config …",
    config_saved: "Configuration saved.",
    config_unknown: "Unknown option.",
    cd_no_context: "No context active.",
    cd_current: (n, type) => `Current context: ${n} [${type}]`,
    cd_back_to_root: "Back to root.",
    cd_now_in: (n, type) => `Entered ${type} context: ${n}`,
    cd_hint_combine: "Tip: combine filters",
    cd_not_found: (s) => `cd: '${s}': not found`,
    cd_matches_found: "Multiple matches:",
    cd_match_item: (n, name, type) => `  ${n}  ${name}  [${type}]`,
    error: (m) => `Error: ${m}`,
    unknown_command: (c) => `${c}: command not found`,
    no_active_pager: "No active pager.",
  },
}));

vi.mock("../utils.js", () => ({
  saveConfig: vi.fn(),
  applyConfig: vi.fn(),
  getPageLines: vi.fn(() => 20),
}));

vi.mock("../api/taxonomy.js", () => ({
  fetchCategories: vi.fn(),
  fetchTags: vi.fn(),
}));

import cmdHelp from "./cmdHelp.js";
import cmdHistory from "./cmdHistory.js";
import cmdConfig from "./cmdConfig.js";
import cmdLink from "./cmdLink.js";
import cmdCd from "./cmdCd.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import { saveConfig, applyConfig } from "../utils.js";

// ─── cmdHelp ──────────────────────────────────────────────────────────────────

describe("cmdHelp", () => {
  it("returns an array of strings", () => {
    const result = cmdHelp();
    expect(Array.isArray(result)).toBe(true);
    expect(result.every((l) => typeof l === "string")).toBe(true);
  });

  it("includes the available commands header", () => {
    expect(cmdHelp()).toContain("Available commands:");
  });

  it("includes tip line", () => {
    const result = cmdHelp();
    expect(result).toContainLineWithText("Arrow keys");
  });
});

// ─── cmdHistory ───────────────────────────────────────────────────────────────

describe("cmdHistory", () => {
  it("returns empty message when history is empty", () => {
    const ref = { current: [] };
    expect(cmdHistory(ref)).toEqual(["No command history."]);
  });

  it("lists commands in chronological order (oldest first)", () => {
    const ref = { current: ["third", "second", "first"] };
    const result = cmdHistory(ref);
    const lines = result.filter((l) => l.trim());
    expect(lines[lines.length - 1]).toContain("third");
    expect(lines[1]).toContain("first");
  });

  it("includes a numbered list", () => {
    const ref = { current: ["ls posts"] };
    const result = cmdHistory(ref);
    expect(result).toContainLineWithText("ls posts");
  });
});

// ─── cmdConfig ────────────────────────────────────────────────────────────────

describe("cmdConfig", () => {
  let configRef;

  beforeEach(() => {
    configRef = { current: { font: 22, posts: 10, theme: "a", order: "desc" } };
    vi.clearAllMocks();
  });

  it("returns current config when called with no args", () => {
    const result = cmdConfig([], configRef);
    expect(result).toContain("Current configuration:");
    expect(result).toContainLineWithText("22px");
  });

  it("updates font size", () => {
    cmdConfig(["--font", "16"], configRef);
    expect(configRef.current.font).toBe(16);
  });

  it("updates posts per page", () => {
    cmdConfig(["--posts", "5"], configRef);
    expect(configRef.current.posts).toBe(5);
  });

  it("updates theme", () => {
    cmdConfig(["--theme", "b"], configRef);
    expect(configRef.current.theme).toBe("b");
  });

  it("rejects invalid theme", () => {
    cmdConfig(["--theme", "z"], configRef);
    expect(configRef.current.theme).toBe("a");
  });

  it("rejects a zero/negative font size", () => {
    cmdConfig(["--font", "0"], configRef);
    expect(configRef.current.font).toBe(22);
    cmdConfig(["--font", "-5"], configRef);
    expect(configRef.current.font).toBe(22);
  });

  it("rejects a zero/negative posts-per-page value", () => {
    cmdConfig(["--posts", "0"], configRef);
    expect(configRef.current.posts).toBe(10);
    cmdConfig(["--posts", "-1"], configRef);
    expect(configRef.current.posts).toBe(10);
  });

  it("updates order to asc", () => {
    cmdConfig(["--order", "asc"], configRef);
    expect(configRef.current.order).toBe("asc");
  });

  it("rejects an invalid order value", () => {
    cmdConfig(["--order", "sideways"], configRef);
    expect(configRef.current.order).toBe("desc");
  });

  it("updates the glow value", () => {
    cmdConfig(["--glow", "0.5"], configRef);
    expect(configRef.current.glow).toBe(0.5);
  });

  it("rejects a non-numeric glow value", () => {
    cmdConfig(["--glow", "bright"], configRef);
    expect(configRef.current.glow).toBeUndefined();
  });

  it("rejects an out-of-range glow value", () => {
    cmdConfig(["--glow", "1.5"], configRef);
    expect(configRef.current.glow).toBeUndefined();
    cmdConfig(["--glow", "-0.1"], configRef);
    expect(configRef.current.glow).toBeUndefined();
  });

  it("updates scroll to smooth", () => {
    cmdConfig(["--scroll", "smooth"], configRef);
    expect(configRef.current.scroll).toBe("smooth");
  });

  it("rejects an invalid scroll value", () => {
    cmdConfig(["--scroll", "sideways"], configRef);
    expect(configRef.current.scroll).toBeUndefined();
  });

  it("calls saveConfig and applyConfig on change", () => {
    cmdConfig(["--font", "18"], configRef);
    expect(saveConfig).toHaveBeenCalledOnce();
    expect(applyConfig).toHaveBeenCalledOnce();
  });

  it("returns unknown option for unrecognized flag", () => {
    const result = cmdConfig(["--unknown"], configRef);
    expect(result).toContain("Unknown option.");
  });

  it("returns saved message on valid change", () => {
    const result = cmdConfig(["--font", "18"], configRef);
    expect(result).toContain("Configuration saved.");
  });
});

// ─── cmdLink ──────────────────────────────────────────────────────────────────

describe("cmdLink", () => {
  it("returns usage when no number given", () => {
    const pager = { current: null };
    expect(cmdLink([], pager)).toEqual(["Usage: link <number>"]);
  });

  it("returns usage for non-numeric arg", () => {
    const pager = { current: null };
    expect(cmdLink(["abc"], pager)).toEqual(["Usage: link <number>"]);
  });

  it("returns unknown number when pager has no entry", () => {
    const pager = { current: { slugMap: {}, footnotes: [] } };
    const result = cmdLink(["5"], pager);
    expect(result).toContain("Number 5 unknown.");
  });

  it("opens link from footnotes", () => {
    const pager = { current: { footnotes: ["https://example.com"], slugMap: {} } };
    const result = cmdLink(["1"], pager);
    expect(result).toContain("Opening: https://example.com");
  });

  it("opens link from slugMap url", () => {
    const pager = { current: { slugMap: { 1: { url: "https://site.com/post" } }, footnotes: [] } };
    const result = cmdLink(["1"], pager);
    expect(result).toContain("Opening: https://site.com/post");
  });
});

// ─── cmdCd ────────────────────────────────────────────────────────────────────

describe("cmdCd", () => {
  let contextRef, setCtxDisplay, pendingRef;

  beforeEach(() => {
    contextRef = { current: { type: null, id: null, name: null } };
    setCtxDisplay = vi.fn();
    pendingRef = { current: null };
    vi.clearAllMocks();
  });

  it("shows no-context message when called with no args and no context", async () => {
    const result = await cmdCd([], contextRef, setCtxDisplay, pendingRef);
    expect(result).toContain("No context active.");
  });

  it("shows current context when called with no args", async () => {
    contextRef.current = { type: "category", id: 1, name: "Tech" };
    const result = await cmdCd([], contextRef, setCtxDisplay, pendingRef);
    expect(result[0]).toContain("Tech");
  });

  // Must run before any other cmdCd test sets the module-level _prevContext.
  it("cd - with no previous context reports no context active", async () => {
    const result = await cmdCd(["-"], contextRef, setCtxDisplay, pendingRef);
    expect(result).toContain("No context active.");
  });

  it("resets context on cd ..", async () => {
    contextRef.current = { type: "category", id: 1, name: "Tech" };
    const result = await cmdCd([".."], contextRef, setCtxDisplay, pendingRef);
    expect(contextRef.current.type).toBeNull();
    expect(result).toContain("Back to root.");
  });

  it("cd - returns to the previous context after cd ..", async () => {
    fetchCategories.mockResolvedValue({ cats: [{ id: 1, slug: "tech", name: "Tech" }], total: 1 });
    fetchTags.mockResolvedValue({ tags: [], total: 0 });
    await cmdCd(["tech"], contextRef, setCtxDisplay, pendingRef);
    await cmdCd([".."], contextRef, setCtxDisplay, pendingRef);

    const result = await cmdCd(["-"], contextRef, setCtxDisplay, pendingRef);

    expect(contextRef.current).toMatchObject({ type: "category", id: 1, name: "Tech" });
    expect(result[0]).toContain("Tech");
  });

  it("returns a formatted error when the taxonomy fetch rejects", async () => {
    fetchCategories.mockRejectedValue(new Error("network down"));
    fetchTags.mockResolvedValue({ tags: [], total: 0 });
    const result = await cmdCd(["tech"], contextRef, setCtxDisplay, pendingRef);
    expect(result[0]).toContain("Error:");
  });

  it("resets context on cd /", async () => {
    const result = await cmdCd(["/"], contextRef, setCtxDisplay, pendingRef);
    expect(result).toContain("Back to root.");
  });

  it("enters category context on exact slug match", async () => {
    fetchCategories.mockResolvedValue({ cats: [{ id: 1, slug: "tech", name: "Tech" }], total: 1 });
    fetchTags.mockResolvedValue({ tags: [], total: 0 });
    const result = await cmdCd(["tech"], contextRef, setCtxDisplay, pendingRef);
    expect(contextRef.current).toMatchObject({ type: "category", id: 1, name: "Tech" });
    expect(result[0]).toContain("category");
  });

  it("enters tag context on exact slug match", async () => {
    fetchCategories.mockResolvedValue({ cats: [], total: 0 });
    fetchTags.mockResolvedValue({ tags: [{ id: 5, slug: "rust", name: "Rust" }], total: 1 });
    const result = await cmdCd(["rust"], contextRef, setCtxDisplay, pendingRef);
    expect(contextRef.current).toMatchObject({ type: "tag", id: 5 });
    expect(result[0]).toContain("tag");
  });

  it("returns not-found for unknown slug", async () => {
    fetchCategories.mockResolvedValue({ cats: [], total: 0 });
    fetchTags.mockResolvedValue({ tags: [], total: 0 });
    const result = await cmdCd(["nonexistent"], contextRef, setCtxDisplay, pendingRef);
    expect(result[0]).toContain("not found");
  });

  it("sets pendingRef on multiple matches", async () => {
    fetchCategories.mockResolvedValue({ cats: [{ id: 1, slug: "sys-logs", name: "System Logs" }], total: 1 });
    fetchTags.mockResolvedValue({ tags: [{ id: 2, slug: "sysadmin", name: "Sysadmin" }], total: 1 });
    await cmdCd(["sys"], contextRef, setCtxDisplay, pendingRef);
    expect(pendingRef.current).not.toBeNull();
    expect(pendingRef.current.candidates.length).toBeGreaterThan(1);
  });

  it("enters context directly on single partial match", async () => {
    fetchCategories.mockResolvedValue({ cats: [{ id: 3, slug: "zero-day", name: "Zero-Day" }], total: 1 });
    fetchTags.mockResolvedValue({ tags: [], total: 0 });
    await cmdCd(["zero"], contextRef, setCtxDisplay, pendingRef);
    expect(contextRef.current.name).toBe("Zero-Day");
  });
});
