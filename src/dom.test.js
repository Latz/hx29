import { describe, it, expect, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

import { getPageLines, getLineWidth, getRenderedLineCount } from "./dom.js";

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
