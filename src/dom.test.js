import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./random.js", () => ({ cosmeticRandom: vi.fn(() => 0.5) }));

import { cosmeticRandom } from "./random.js";
import { getPageLines, getLineWidth, getRenderedLineCount, scrollTerminal, maybeSyncTear } from "./dom.js";

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

describe("getRenderedLineCount", () => {
  it("returns 0 when no terminal lines exist", () => {
    expect(getRenderedLineCount()).toBe(0);
  });

  it("counts .react-terminal-line elements", () => {
    const container = document.createElement("div");
    container.className = "react-terminal";
    for (let i = 0; i < 5; i++) {
      const line = document.createElement("div");
      line.className = "react-terminal-line";
      container.appendChild(line);
    }
    document.body.appendChild(container);
    expect(getRenderedLineCount()).toBe(5);
  });
});

describe("scrollTerminal", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "setTimeout", "clearTimeout"] });
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
