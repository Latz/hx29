import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../random.js", () => ({ cosmeticRandom: vi.fn(() => 0.5) }));

import idleVortex from "./vortex.js";

const SETUP_MS = 400 + 600 + 200; // the three `await wait(...)` calls before the loop starts

function makeCtx() {
  const idleActiveRef = { current: true };
  const controller = new AbortController();
  return {
    key: (suffix) => `vortex-${suffix}`,
    wait: (ms) => new Promise((res) => setTimeout(res, ms)),
    append: vi.fn(),
    update: vi.fn(),
    scrollTerminal: vi.fn(),
    idleActiveRef,
    signal: controller.signal,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("idleVortex", () => {
  it("prints the setup lines and first frame before entering the spin loop", async () => {
    const ctx = makeCtx();
    const donePromise = idleVortex(ctx);

    await vi.advanceTimersByTimeAsync(SETUP_MS + 5);

    expect(ctx.append).toHaveBeenCalledWith("vortex-l1", expect.any(String));
    expect(ctx.append).toHaveBeenCalledWith("vortex-l2", expect.any(String));
    expect(ctx.append).toHaveBeenCalledWith("vortex-v0", expect.any(String));
    expect(ctx.scrollTerminal).toHaveBeenCalled();

    ctx.idleActiveRef.current = false;
    await vi.advanceTimersByTimeAsync(150);
    await donePromise;
  });

  it("a keypress mid-loop interrupts it and runs the collapse cleanup", async () => {
    const ctx = makeCtx();
    const donePromise = idleVortex(ctx);

    // Land inside the loop's Promise.race wait, well before the 100ms tick would elapse.
    await vi.advanceTimersByTimeAsync(SETUP_MS + 10);
    const updateCallsInLoop = ctx.update.mock.calls.length;
    expect(updateCallsInLoop).toBeGreaterThan(0);

    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));

    // Drive the cleanup's `await wait(300)` to completion.
    await vi.advanceTimersByTimeAsync(310);
    await donePromise;

    expect(ctx.idleActiveRef.current).toBe(false);
    expect(ctx.update).toHaveBeenCalledWith("vortex-v1", expect.stringContaining("VORTEX COLLAPSED"));
    expect(ctx.append).toHaveBeenCalledWith("vortex-done", "");
  });

  it("exits without the collapse cleanup when idleActiveRef is cleared externally (unmount)", async () => {
    const ctx = makeCtx();
    const donePromise = idleVortex(ctx);

    await vi.advanceTimersByTimeAsync(SETUP_MS + 10);
    ctx.idleActiveRef.current = false;

    await vi.advanceTimersByTimeAsync(150); // past the in-flight 100ms tick
    await donePromise;

    expect(ctx.update).not.toHaveBeenCalledWith("vortex-v1", expect.stringContaining("VORTEX COLLAPSED"));
    expect(ctx.append).not.toHaveBeenCalledWith("vortex-done", "");
  });
});
