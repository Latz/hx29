import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./i18n/index.js", () => ({
  t: {
    help_tip_boot: "Type help",
    time_seconds_ago: (n) => `${n} seconds ago`,
    time_minutes_ago: (n) => `${n} minutes ago`,
    time_hours_ago:   (n) => `${n} hours ago`,
    time_days_ago:    (n) => `${n} days ago`,
  },
}));

vi.mock("./intro.json", () => ({
  default: [
    [
      { text: "Hello {{SITE_NAME}}", delay: 100 },
      { text: null, delay: 50 },
    ],
  ],
}));

vi.mock("./returning.json", () => ({
  default: [
    {
      stage: 0,
      items: [{ text: "Welcome back {{SIG}}", delay: 100 }],
    },
    {
      stage: 1,
      items: [{ text: "Visit {{VISITS}}", delay: 100 }],
    },
  ],
}));

let localStorageStore = {};
beforeEach(() => {
  localStorageStore = {};
  vi.stubGlobal("localStorage", {
    getItem: (k) => localStorageStore[k] ?? null,
    setItem: (k, v) => { localStorageStore[k] = v; },
    removeItem: (k) => { delete localStorageStore[k]; },
  });
  vi.clearAllMocks();
});

import { getIntro, getSessionIntro } from "./intros.js";

describe("getIntro", () => {
  it("returns an array", () => {
    const result = getIntro("TestSite");
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns items with delay property", () => {
    const result = getIntro("TestSite");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((item) => {
      expect(item).toHaveProperty("delay");
    });
  });

  it("expands SITE_NAME placeholder in text items", () => {
    const result = getIntro("MyBlog");
    const textItems = result.filter((item) => typeof item.text === "string");
    expect(textItems.some((item) => item.text.includes("MyBlog"))).toBe(true);
  });
});

describe("getSessionIntro", () => {
  it("returns object with stage and items", () => {
    const result = getSessionIntro("TestSite");
    expect(result).toHaveProperty("stage");
    expect(result).toHaveProperty("items");
  });

  it("stage is a non-negative integer", () => {
    const result = getSessionIntro("TestSite");
    expect(Number.isInteger(result.stage)).toBe(true);
    expect(result.stage).toBeGreaterThanOrEqual(0);
  });

  it("items is an array", () => {
    const result = getSessionIntro("TestSite");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("returns the same stage on second call within same session", () => {
    const first = getSessionIntro("TestSite");
    const second = getSessionIntro("TestSite");
    expect(first.stage).toBe(second.stage);
  });
});
