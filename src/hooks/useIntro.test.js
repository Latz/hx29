import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "@wordpress/element";
import useIntro from "./useIntro.js";

function useHarness(introItems) {
  const [terminalLines, setTerminalLines] = useState([]);
  const introPlaying = useIntro(introItems, setTerminalLines);
  return { introPlaying, terminalLines };
}

const textOf = (el) => el.props.children;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIntro", () => {
  it("starts with introPlaying=true", () => {
    const { result } = renderHook(() => useHarness([{ text: "Hi", delay: 0 }]));
    expect(result.current.introPlaying).toBe(true);
  });

  it("animates a plain text item in and sets introPlaying=false when done", async () => {
    const { result } = renderHook(() => useHarness([{ text: "Hi", delay: 0 }]));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.introPlaying).toBe(false);
    const rendered = result.current.terminalLines.map(textOf);
    expect(rendered).toContain("Hi");
  });

  it("pushes a blank spacer line for an empty/space text item without animating", async () => {
    const { result } = renderHook(() => useHarness([{ text: " ", delay: 0 }]));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.introPlaying).toBe(false);
    expect(result.current.terminalLines).toHaveLength(1);
    expect(textOf(result.current.terminalLines[0])).toBe(" ");
  });

  it("cycles a phased item through its phases, ending on the last phase's text", async () => {
    const items = [
      {
        delay: 0,
        __phases: [
          { text: "A", hold: 10 },
          { text: "B", hold: 10 },
        ],
      },
    ];
    const { result } = renderHook(() => useHarness(items));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.introPlaying).toBe(false);
    // Both phases share the same key, so only one line should remain, showing the last phase.
    expect(result.current.terminalLines).toHaveLength(1);
    expect(textOf(result.current.terminalLines[0])).toBe("B");
  });

  it("plays multiple items in order", async () => {
    const items = [
      { text: "First", delay: 0 },
      { text: "Second", delay: 0 },
    ];
    const { result } = renderHook(() => useHarness(items));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.introPlaying).toBe(false);
    const rendered = result.current.terminalLines.map(textOf);
    expect(rendered).toContain("First");
    expect(rendered).toContain("Second");
  });

  it("stops animating and never sets introPlaying=false once cancelled (unmounted)", async () => {
    const items = [{ text: "A very long line of intro text", delay: 0 }];
    const { result, unmount } = renderHook(() => useHarness(items));

    // Let the animation start (first tick or two), then unmount mid-animation.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const linesBeforeUnmount = result.current.terminalLines.length;
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // No further state updates should have been triggered post-unmount;
    // introPlaying is only observable via the pre-unmount `result.current`, which stays true.
    expect(result.current.introPlaying).toBe(true);
    expect(result.current.terminalLines.length).toBe(linesBeforeUnmount);
  });

  it("focuses the hidden input after the sequence finishes", async () => {
    const input = document.createElement("input");
    input.className = "terminal-hidden-input";
    document.body.appendChild(input);

    renderHook(() => useHarness([{ text: "Hi", delay: 0 }]));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(document.activeElement).toBe(input);
  });
});
