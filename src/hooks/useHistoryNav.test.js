import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../complete.js", () => ({
  complete: vi.fn(() => null),
}));

import { complete } from "../complete.js";
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
