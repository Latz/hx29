import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../complete.js", () => ({
  complete: vi.fn(() => null),
}));
vi.mock("../random.js", () => ({ cosmeticRandom: vi.fn(() => 1) }));

import { complete } from "../complete.js";
import { cosmeticRandom } from "../random.js";
import useHistoryNav from "./useHistoryNav.js";

function makeInput() {
  const el = document.createElement("input");
  el.className = "terminal-hidden-input";
  document.body.appendChild(el);
  return el;
}

function makeRefs({ history = [], printing = false, intro = false } = {}) {
  return {
    historyRef: { current: history },
    printingRef: { current: printing },
    introPlayingRef: { current: intro },
    pager: { current: null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cosmeticRandom.mockReturnValue(1); // never bounce by default
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useHistoryNav — ArrowUp/ArrowDown history navigation", () => {
  it("ArrowUp fills input with most recent history entry", async () => {
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: ["read hello", "ls posts"] });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("read hello");
  });

  it("ArrowUp twice steps back to older entry", async () => {
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: ["read hello", "ls posts"] });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("ls posts");
  });

  it("ArrowDown after ArrowUp returns to more recent entry", async () => {
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: ["read hello", "ls posts"] });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("read hello");
  });

  it("ArrowDown past the beginning clears input", async () => {
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: ["ls posts"] });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("");
  });

  it("ArrowUp does nothing when history is empty", async () => {
    const input = makeInput();
    input.value = "typed";
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: [] });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("typed");
  });
});

describe("useHistoryNav — Tab completion", () => {
  it("Tab calls complete() and updates input when result returned", async () => {
    complete.mockReturnValue("ls posts");
    const input = makeInput();
    input.value = "ls p";
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs();
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });

    expect(complete).toHaveBeenCalledWith("ls p", pager);
    expect(input.value).toBe("ls posts");
  });

  it("Tab does nothing when complete() returns null", async () => {
    complete.mockReturnValue(null);
    const input = makeInput();
    input.value = "xyz";
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs();
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("xyz");
  });
});

describe("useHistoryNav — Ctrl+L", () => {
  it("Ctrl+L calls onClear callback", async () => {
    const input = makeInput();
    const onClear = vi.fn();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs();
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager, onClear));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "l", ctrlKey: true, bubbles: true, cancelable: true }));
    });

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("useHistoryNav — guard conditions", () => {
  it("ignores keys when printingRef is true", async () => {
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({
      history: ["ls posts"],
      printing: true,
    });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("");
  });

  it("ignores keys when introPlayingRef is true", async () => {
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({
      history: ["ls posts"],
      intro: true,
    });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("");
  });
});

describe("useHistoryNav — reset()", () => {
  it("reset() makes next ArrowUp return most recent entry again", async () => {
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: ["read hello", "ls posts"] });
    const { result } = renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("ls posts");

    act(() => result.current.reset());

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    });

    expect(input.value).toBe("read hello");
  });
});

describe("useHistoryNav — key-bounce simulation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("duplicates the keystroke then self-corrects when the random roll passes", async () => {
    cosmeticRandom.mockReturnValue(0); // 0 < 0.005 → triggers the bounce
    const input = makeInput();
    input.value = "ab";
    input.setSelectionRange(2, 2);
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs();
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(input.value).toBe("abc");
    expect(document.querySelector(".hx29-key-bounce-notice")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(130);
    expect(input.value).toBe("ab");
    expect(document.querySelector(".hx29-key-bounce-notice").classList.contains("is-hidden")).toBe(true);

    await vi.advanceTimersByTimeAsync(330);
    expect(document.querySelector(".hx29-key-bounce-notice")).toBeNull();
  });

  it("does not bounce when the random roll is above the threshold", async () => {
    cosmeticRandom.mockReturnValue(0.5);
    const input = makeInput();
    input.value = "ab";
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs();
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(500);

    expect(document.querySelector(".hx29-key-bounce-notice")).toBeNull();
  });

  it("does not bounce for multi-character keys (e.g. ArrowUp) even when the roll passes", async () => {
    cosmeticRandom.mockReturnValue(0);
    const input = makeInput();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: ["ls posts"] });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(500);

    expect(document.querySelector(".hx29-key-bounce-notice")).toBeNull();
  });
});

describe("useHistoryNav — deferred attach", () => {
  it("attaches to the hidden input once it appears, if it wasn't there at mount", async () => {
    vi.useFakeTimers();
    const { historyRef, printingRef, introPlayingRef, pager } = makeRefs({ history: ["ls posts"] });
    renderHook(() => useHistoryNav(historyRef, printingRef, introPlayingRef, pager));

    await vi.advanceTimersByTimeAsync(250);
    const input = makeInput();
    await vi.advanceTimersByTimeAsync(100); // past the 300ms retry

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(0);

    expect(input.value).toBe("ls posts");
    vi.useRealTimers();
  });
});
