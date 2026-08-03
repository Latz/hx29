import { describe, it, expect } from "vitest";
import en from "./en.js";
import de from "./de.js";

// All keys that must exist in every locale bundle
const REQUIRED_KEYS = [
  "locale",
  "help_available_commands",
  "help_tip",
  "no_active_pager",
  "more_chars_left",
  "more_results_left",
  "cd_now_in",
  "cd_back_to_root",
  "cd_not_found",
  "cd_cancelled",
  "ls_no_posts",
  "ls_posts_found",
  "ls_no_pages",
  "ls_no_categories",
  "ls_no_tags",
  "tree_no_categories",
  "read_usage",
  "read_not_found",
  "read_published",
  "link_usage",
  "link_unknown_num",
  "search_usage",
  "search_no_results",
  "grep_usage",
  "grep_no_results",
  "comments_usage",
  "reply_usage",
  "history_empty",
  "history_title",
  "man_usage",
  "config_current_title",
  "config_saved",
  "error",
  "unknown_command",
];

const FUNCTION_KEYS = [
  "more_chars_left",
  "more_results_left",
  "more_items_left",
  "cd_now_in",
  "cd_not_found",
  "cd_match_item",
  "ls_posts_found",
  "ls_pages_found",
  "ls_categories_found",
  "ls_tags_found",
  "read_not_found",
  "read_published",
  "read_categories",
  "read_tags",
  "read_comment_count",
  "link_unknown_num",
  "link_opening",
  "search_no_results",
  "search_found",
  "grep_no_results",
  "grep_found",
  "comments_unknown_num",
  "reply_unknown_num",
  "config_font",
  "config_posts",
  "config_theme",
  "config_order",
  "config_scroll",
  "error",
  "unknown_command",
];

describe("i18n/en", () => {
  it("has all required keys", () => {
    for (const key of REQUIRED_KEYS) {
      expect(en, `missing key: ${key}`).toHaveProperty(key);
    }
  });

  it("function keys are callable and return strings", () => {
    for (const key of FUNCTION_KEYS) {
      expect(typeof en[key], `${key} should be a function`).toBe("function");
      const result = en[key]("x", "y");
      expect(typeof result, `${key}() should return a string`).toBe("string");
    }
  });

  it("locale is en-US", () => {
    expect(en.locale).toBe("en-US");
  });

  it("read_categories pluralizes the label by count", () => {
    expect(en.read_categories("Tech", 1)).toBe("Category: Tech");
    expect(en.read_categories("Tech, Rust", 2)).toBe("Categories: Tech, Rust");
  });
});

describe("i18n/de", () => {
  it("has all required keys", () => {
    for (const key of REQUIRED_KEYS) {
      expect(de, `missing key: ${key}`).toHaveProperty(key);
    }
  });

  it("function keys are callable and return strings", () => {
    for (const key of FUNCTION_KEYS) {
      expect(typeof de[key], `${key} should be a function`).toBe("function");
      const result = de[key]("x", "y");
      expect(typeof result, `${key}() should return a string`).toBe("string");
    }
  });

  it("locale is de-DE", () => {
    expect(de.locale).toBe("de-DE");
  });

  it("has same set of keys as en", () => {
    const enKeys = Object.keys(en).sort();
    const deKeys = Object.keys(de).sort();
    expect(deKeys).toEqual(enKeys);
  });

  it("read_categories pluralizes the label by count", () => {
    expect(de.read_categories("Tech", 1)).toBe("Kategorie: Tech");
    expect(de.read_categories("Tech, Rust", 2)).toBe("Kategorien: Tech, Rust");
  });
});
