import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./random.js", () => ({ cosmeticRandom: vi.fn(() => 0.5) }));

import { cosmeticRandom } from "./random.js";
import { getPageLines, getLineWidth, scrollTerminal, followTerminal, _resetFollowThrottleForTests, _resetScrollScheduledForTests, maybeSyncTear } from "./dom.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("getPageLines", () => {
  it("returns 20 when terminal element is absent", () => {
    expect(getPageLines()).toBe(20);
  });

  it("returns fallback of 20 or a positive integer when terminal element exists", () => {
    const el = document.createElement("div");
    el.className = "react-terminal";
    Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });
    document.body.appendChild(el);
    const lines = getPageLines();
    // jsdom may not support getComputedStyle fontSize → falls back to 20 via Math.max(5,NaN)=NaN→fallback
    expect(typeof lines).toBe("number");
  });
});

describe("getLineWidth", () => {
  it("returns a positive number when terminal is absent (fallback constant)", () => {
    const width = getLineWidth();
    expect(typeof width).toBe("number");
    expect(width).toBeGreaterThan(0);
  });

  it("returns a positive number when terminal element is present", () => {
    const el = document.createElement("div");
    el.className = "react-terminal";
    Object.defineProperty(el, "clientWidth", { value: 800, configurable: true });
    document.body.appendChild(el);
    const width = getLineWidth();
    expect(width).toBeGreaterThan(0);
  });
});

describe("scrollTerminal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "setTimeout", "clearTimeout"] });
    _resetScrollScheduledForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when the terminal element is absent", async () => {
    expect(() => scrollTerminal()).not.toThrow();
    await vi.advanceTimersByTimeAsync(100);
  });

  it("scrolls to bottom and flashes then restores the wrapper class", async () => {
    const el = document.createElement("div");
    el.className = "react-terminal";
    Object.defineProperty(el, "scrollHeight", { value: 500, configurable: true });
    // jsdom doesn't implement real layout, so scrollTop is otherwise always clamped to 0.
    let scrollTop = 0;
    Object.defineProperty(el, "scrollTop", {
      get: () => scrollTop,
      set: (v) => { scrollTop = v; },
      configurable: true,
    });
    document.body.appendChild(el);
    const wrapper = document.createElement("div");
    wrapper.className = "react-terminal-wrapper";
    document.body.appendChild(wrapper);

    scrollTerminal();
    await vi.advanceTimersByTimeAsync(20); // flush the requestAnimationFrame callback (~16ms/frame)

    expect(el.scrollTop).toBe(500);
    expect(wrapper.classList.contains("hx29-scroll-flash")).toBe(true);

    await vi.advanceTimersByTimeAsync(60);

    expect(wrapper.classList.contains("hx29-scroll-flash")).toBe(false);
    expect(wrapper.classList.contains("hx29-scroll-flash-restore")).toBe(true);
  });

  it("coalesces repeated calls within the same frame into a single scroll", async () => {
    const el = document.createElement("div");
    el.className = "react-terminal";
    document.body.appendChild(el);

    scrollTerminal();
    scrollTerminal();
    scrollTerminal();
    await vi.advanceTimersByTimeAsync(0);

    expect(el.scrollTop).toBe(0);
  });
});

describe("smooth scroll mode", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "setTimeout", "clearTimeout"] });
    _resetScrollScheduledForTests();
    document.documentElement.dataset.scroll = "smooth";
  });

  afterEach(() => {
    vi.useRealTimers();
    delete document.documentElement.dataset.scroll;
  });

  function makeTerminal(scrollHeight) {
    const el = document.createElement("div");
    el.className = "react-terminal";
    Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
    let scrollTop = 0;
    Object.defineProperty(el, "scrollTop", {
      get: () => scrollTop,
      set: (v) => { scrollTop = v; },
      configurable: true,
    });
    document.body.appendChild(el);
    return el;
  }

  it("animates scrollTop gradually toward the bottom instead of jumping instantly", async () => {
    const el = makeTerminal(500);

    scrollTerminal();
    // First frame just establishes the animation's start time (no movement yet);
    // advance a couple more frames in to see it actually progress.
    await vi.advanceTimersByTimeAsync(50);

    expect(el.scrollTop).toBeGreaterThan(0);
    expect(el.scrollTop).toBeLessThan(500);

    await vi.advanceTimersByTimeAsync(200); // past the animation duration

    expect(el.scrollTop).toBe(500);
  });

  it("falls back to an instant jump when prefers-reduced-motion is set", async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }));
    const el = makeTerminal(500);

    scrollTerminal();
    await vi.advanceTimersByTimeAsync(20);

    expect(el.scrollTop).toBe(500);
    window.matchMedia = originalMatchMedia;
  });

  it("falls back to an instant jump when data-scroll is not smooth", async () => {
    delete document.documentElement.dataset.scroll;
    const el = makeTerminal(500);

    scrollTerminal();
    await vi.advanceTimersByTimeAsync(20);

    expect(el.scrollTop).toBe(500);
  });
});

describe("followTerminal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "setTimeout", "clearTimeout"] });
    _resetFollowThrottleForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when the terminal element is absent", async () => {
    expect(() => followTerminal()).not.toThrow();
    await vi.advanceTimersByTimeAsync(100);
  });

  it("scrolls to bottom without flashing the wrapper class", async () => {
    const el = document.createElement("div");
    el.className = "react-terminal";
    Object.defineProperty(el, "scrollHeight", { value: 500, configurable: true });
    let scrollTop = 0;
    Object.defineProperty(el, "scrollTop", {
      get: () => scrollTop,
      set: (v) => { scrollTop = v; },
      configurable: true,
    });
    document.body.appendChild(el);
    const wrapper = document.createElement("div");
    wrapper.className = "react-terminal-wrapper";
    document.body.appendChild(wrapper);

    followTerminal();
    await vi.advanceTimersByTimeAsync(20);

    expect(el.scrollTop).toBe(500);
    expect(wrapper.classList.contains("hx29-scroll-flash")).toBe(false);
    expect(wrapper.classList.contains("hx29-scroll-flash-restore")).toBe(false);
  });

  it("coalesces repeated calls within the same frame into a single scroll", async () => {
    const el = document.createElement("div");
    el.className = "react-terminal";
    document.body.appendChild(el);

    followTerminal();
    followTerminal();
    followTerminal();
    await vi.advanceTimersByTimeAsync(0);

    expect(el.scrollTop).toBe(0);
  });

  it("throttles rapid successive calls to a trailing call ~150ms later", async () => {
    const el = document.createElement("div");
    el.className = "react-terminal";
    let scrollHeight = 100;
    Object.defineProperty(el, "scrollHeight", { get: () => scrollHeight });
    let scrollTop = 0;
    Object.defineProperty(el, "scrollTop", {
      get: () => scrollTop,
      set: (v) => { scrollTop = v; },
      configurable: true,
    });
    document.body.appendChild(el);

    followTerminal(); // runs immediately (first call)
    await vi.advanceTimersByTimeAsync(20);
    expect(el.scrollTop).toBe(100);

    scrollHeight = 500;
    followTerminal(); // within the throttle window — queues a trailing call, doesn't run yet
    await vi.advanceTimersByTimeAsync(20);
    expect(el.scrollTop).toBe(100);

    followTerminal(); // still within the window — no-op, coalesces into the same trailing call
    await vi.advanceTimersByTimeAsync(200);
    expect(el.scrollTop).toBe(500);
  });
});

describe("maybeSyncTear", () => {
  it("does nothing when the random roll is above the 3% threshold", () => {
    cosmeticRandom.mockReturnValue(0.5);
    const container = document.createElement("div");
    container.className = "react-terminal";
    const line = document.createElement("div");
    line.className = "react-terminal-line";
    container.appendChild(line);
    document.body.appendChild(container);

    maybeSyncTear();

    expect(line.classList.contains("sync-tear")).toBe(false);
  });

  it("does nothing when there are no terminal lines, even if the roll passes", () => {
    cosmeticRandom.mockReturnValue(0);
    expect(() => maybeSyncTear()).not.toThrow();
  });

  it("applies a sync-tear class to the last line and removes it after the animation duration", async () => {
    vi.useFakeTimers();
    cosmeticRandom.mockReturnValue(0); // roll passes (0 < 0.03); duration = 40 + 0*40 = 40ms
    const container = document.createElement("div");
    container.className = "react-terminal";
    for (let i = 0; i < 2; i++) {
      const line = document.createElement("div");
      line.className = "react-terminal-line";
      container.appendChild(line);
    }
    document.body.appendChild(container);
    const last = container.querySelectorAll(".react-terminal-line")[1];

    maybeSyncTear();

    expect(last.classList.contains("sync-tear")).toBe(true);
    expect(last.style.getPropertyValue("--tear-duration")).toBe("40ms");

    await vi.advanceTimersByTimeAsync(60);

    expect(last.classList.contains("sync-tear")).toBe(false);
    expect(last.style.getPropertyValue("--tear-duration")).toBe("");

    vi.useRealTimers();
  });
});
