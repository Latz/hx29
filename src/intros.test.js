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

vi.mock("./random.js", () => ({ cosmeticRandom: vi.fn(() => 0) }));

vi.mock("./intro.json", () => ({
  default: [
    [
      { text: "Hello {{SITE_NAME}}", delay: 100 },
      { text: null, delay: 50 },
      {
        delay: 10,
        __phases: [
          { text: "Boot ing", hold: 10 },
          { text: "Ready", hold: 20 },
        ],
      },
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
      items: [{ text: "Visit {{VISITS}}, last seen {{TIME_AGO}}", delay: 100 }],
    },
  ],
}));

import { cosmeticRandom } from "./random.js";

let localStorageStore = {};
beforeEach(() => {
  localStorageStore = {};
  vi.stubGlobal("localStorage", {
    getItem: (k) => localStorageStore[k] ?? null,
    setItem: (k, v) => { localStorageStore[k] = v; },
    removeItem: (k) => { delete localStorageStore[k]; },
  });
  cosmeticRandom.mockReturnValue(0);
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

  it("corrupts the middle phase of a phased item, preserving spaces (cosmeticRandom below threshold)", () => {
    cosmeticRandom.mockReturnValue(0); // every char rolls "corrupt" (0 < 0.45) and picks CORRUPT_CHARS[0]
    const result = getIntro("TestSite");
    const phased = result.find((item) => item.__phases);

    expect(phased).toBeDefined();
    expect(phased.__phases).toHaveLength(3);
    expect(phased.__phases[0].text).toBe("Boot ing");
    expect(phased.__phases[1].text).toBe("▒▒▒▒ ▒▒▒"); // "Boot ing" with every non-space char replaced
    expect(phased.__phases[1].text[4]).toBe(" "); // space position preserved
    expect(phased.__phases[2].text).toBe("Ready");
    expect(phased.__phases[2].hold).toBe(20);
  });

  it("leaves text uncorrupted when cosmeticRandom rolls above the 45% threshold", () => {
    cosmeticRandom.mockReturnValue(0.9);
    const result = getIntro("TestSite");
    const phased = result.find((item) => item.__phases);

    expect(phased.__phases[1].text).toBe("Boot ing");
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

  it("increments the visit counter on first visit", () => {
    getSessionIntro("TestSite");
    expect(localStorageStore["hx29_visits"]).toBe(1);
    expect(localStorageStore["hx29_last_visit"]).toBeDefined();
  });

  it("increments the visit counter again once an hour has passed", () => {
    // Keep the resulting visit count at 1 so it resolves to the mocked stage-1 entry
    // (Math.min(visits, 4) would otherwise select an unmocked stage).
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    localStorageStore["hx29_sig"] = "SIG-ABCDEF";
    localStorageStore["hx29_visits"] = "0";
    localStorageStore["hx29_last_visit"] = twoHoursAgo;

    getSessionIntro("TestSite");

    expect(localStorageStore["hx29_visits"]).toBe(1);
  });

  it("does not increment the visit counter within the same hour", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    localStorageStore["hx29_sig"] = "SIG-ABCDEF";
    localStorageStore["hx29_visits"] = "1";
    localStorageStore["hx29_last_visit"] = fiveMinAgo;

    getSessionIntro("TestSite");

    expect(localStorageStore["hx29_visits"]).toBe("1");
  });

  it("expands TIME_AGO in minutes for a last visit under an hour ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    localStorageStore["hx29_sig"] = "SIG-ABCDEF";
    localStorageStore["hx29_visits"] = "1";
    localStorageStore["hx29_last_visit"] = fiveMinAgo;

    const result = getSessionIntro("TestSite");

    expect(result.items[0].text).toContain("5 minutes ago");
  });

  it("expands TIME_AGO in hours for a last visit under a day ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000).toISOString();
    localStorageStore["hx29_sig"] = "SIG-ABCDEF";
    localStorageStore["hx29_visits"] = "0";
    localStorageStore["hx29_last_visit"] = threeHoursAgo;

    const result = getSessionIntro("TestSite");

    expect(result.items[0].text).toContain("3 hours ago");
  });

  it("expands TIME_AGO in days for a last visit over a day ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    localStorageStore["hx29_sig"] = "SIG-ABCDEF";
    localStorageStore["hx29_visits"] = "0";
    localStorageStore["hx29_last_visit"] = twoDaysAgo;

    const result = getSessionIntro("TestSite");

    expect(result.items[0].text).toContain("2 days ago");
  });

  // robustness.md High #7: loadSession() must not throw when localStorage or
  // crypto is unavailable/throwing (e.g. Safari private browsing), since it
  // runs at module load time before React mounts.
  it("does not throw when localStorage.getItem throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new DOMException("disabled", "SecurityError"); },
      setItem: () => { throw new DOMException("disabled", "SecurityError"); },
      removeItem: () => {},
    });

    expect(() => getSessionIntro("TestSite")).not.toThrow();
    const result = getSessionIntro("TestSite");
    expect(result.stage).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("does not throw when localStorage.setItem throws (quota exceeded)", () => {
    vi.stubGlobal("localStorage", {
      getItem: (k) => localStorageStore[k] ?? null,
      setItem: () => { throw new DOMException("quota exceeded", "QuotaExceededError"); },
      removeItem: (k) => { delete localStorageStore[k]; },
    });

    expect(() => getSessionIntro("TestSite")).not.toThrow();
  });

  it("does not throw when crypto.getRandomValues throws", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: () => { throw new Error("crypto unavailable"); },
    });

    expect(() => getSessionIntro("TestSite")).not.toThrow();
  });
});
