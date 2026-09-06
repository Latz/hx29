import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("../utils.js", () => ({ scrollTerminal: vi.fn() }));
vi.mock("../random.js", () => ({ cosmeticRandom: vi.fn(() => 0) }));

const neonFlicker = vi.fn(async () => {});
const vortex = vi.fn(async () => {});
vi.mock("../idle/neonFlicker.js", () => ({ default: neonFlicker }));
vi.mock("../idle/vortex.js", () => ({ default: vortex }));
vi.mock("../idle/bufferMelt.js", () => ({ default: vi.fn(async () => {}) }));
vi.mock("../idle/cyberdeck.js", () => ({ default: vi.fn(async () => {}) }));
vi.mock("../idle/overheat.js", () => ({ default: vi.fn(async () => {}) }));
vi.mock("../idle/gridGlitch.js", () => ({ default: vi.fn(async () => {}) }));
vi.mock("../idle/synapseDesync.js", () => ({ default: vi.fn(async () => {}) }));
vi.mock("../idle/memoryLeak.js", () => ({ default: vi.fn(async () => {}) }));

import { cosmeticRandom } from "../random.js";
import useIdleSequence from "./useIdleSequence.js";

const IDLE_MS = 5 * 60 * 1000;

function makeRefs({ intro = false, printing = false } = {}) {
  return { introPlayingRef: { current: intro }, printingRef: { current: printing } };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useIdleSequence", () => {
  it("does not run a sequence before 5 minutes of inactivity", async () => {
    const { introPlayingRef, printingRef } = makeRefs();
    renderHook(() => useIdleSequence(introPlayingRef, printingRef, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1000);
    });

    expect(neonFlicker).not.toHaveBeenCalled();
  });

  it("runs the picked sequence after 5 minutes and passes it a well-formed context", async () => {
    const { introPlayingRef, printingRef } = makeRefs();
    const { result } = renderHook(() => useIdleSequence(introPlayingRef, printingRef, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    });

    expect(neonFlicker).toHaveBeenCalledTimes(1);
    expect(result.current.idleActiveRef.current).toBe(true);

    const ctx = neonFlicker.mock.calls[0][0];
    expect(typeof ctx.key).toBe("function");
    expect(typeof ctx.wait).toBe("function");
    expect(typeof ctx.append).toBe("function");
    expect(typeof ctx.update).toBe("function");
    expect(typeof ctx.scrollTerminal).toBe("function");
    expect(ctx.idleActiveRef).toBe(result.current.idleActiveRef);
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
    expect(ctx.signal.aborted).toBe(false);
  });

  it("defers idle start while the intro is playing, then runs once it finishes", async () => {
    const introPlayingRef = { current: true };
    const printingRef = { current: false };
    renderHook(() => useIdleSequence(introPlayingRef, printingRef, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    });
    expect(neonFlicker).not.toHaveBeenCalled();

    introPlayingRef.current = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    });
    expect(neonFlicker).toHaveBeenCalledTimes(1);
  });

  it("defers idle start while a command is printing", async () => {
    const { introPlayingRef, printingRef } = makeRefs({ printing: true });
    renderHook(() => useIdleSequence(introPlayingRef, printingRef, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    });

    expect(neonFlicker).not.toHaveBeenCalled();
  });

  it("aborts the sequence's signal and clears idleActiveRef on unmount", async () => {
    const { introPlayingRef, printingRef } = makeRefs();
    const { result, unmount } = renderHook(() => useIdleSequence(introPlayingRef, printingRef, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    });
    const ctx = neonFlicker.mock.calls[0][0];
    expect(ctx.signal.aborted).toBe(false);

    unmount();

    expect(ctx.signal.aborted).toBe(true);
    expect(result.current.idleActiveRef.current).toBe(false);
  });

  // robustness.md High #8: a failed chunk load / throwing sequence must not
  // leave idleActiveRef stuck true or stop idle effects from ever retrying.
  it("recovers when the picked sequence throws: clears idleActiveRef and reschedules", async () => {
    neonFlicker.mockRejectedValueOnce(new Error("chunk load failed"));
    // Force the first pick to neonFlicker (index 0) and the retry to vortex
    // (index 1) — pickSequence refuses to repeat the same index twice in a row.
    cosmeticRandom.mockReturnValueOnce(0).mockReturnValueOnce(0.2);
    const { introPlayingRef, printingRef } = makeRefs();
    const { result } = renderHook(() => useIdleSequence(introPlayingRef, printingRef, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    });
    expect(neonFlicker).toHaveBeenCalledTimes(1);
    expect(result.current.idleActiveRef.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS + 10);
    });
    expect(vortex).toHaveBeenCalledTimes(1);
  });

  it("idleTimerRef.schedule() restarts the idle timer from now", async () => {
    const { introPlayingRef, printingRef } = makeRefs();
    const { result } = renderHook(() => useIdleSequence(introPlayingRef, printingRef, vi.fn()));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 60_000);
    });
    act(() => {
      result.current.idleTimerRef.schedule();
    });

    // Original timer would have fired by now, but schedule() reset the clock.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(70_000);
    });
    expect(neonFlicker).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS);
    });
    expect(neonFlicker).toHaveBeenCalledTimes(1);
  });
});
