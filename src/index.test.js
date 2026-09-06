import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { t } from "./i18n/index.js";

// vitest.config.js aliases @wordpress/element -> react (for JSX/hooks), but
// react itself has no createRoot — index.js needs the real react-dom/client
// implementation to actually mount into a DOM node.
vi.mock("@wordpress/element", async () => {
  const react = await vi.importActual("react");
  const { createRoot } = await import("react-dom/client");
  return { ...react, createRoot };
});

// @wordpress/compose ships its own bundled (older) React copy; useDebounce
// calling that copy's hooks alongside our top-level react-dom instance
// crashes with a null hook dispatcher. Not relevant to this test — swap in
// an identity passthrough.
vi.mock("@wordpress/compose", () => ({ useDebounce: (fn) => fn }));

vi.mock("./intros.js", () => ({
  getSessionIntro: () => ({ stage: 1, items: [] }),
}));

const executeCommand = vi.fn();
vi.mock("./commands/registry.js", () => ({ executeCommand }));

/**
 * Types `raw` into the terminal's hidden input and presses Enter, mirroring
 * how react-terminal-ui dispatches onInput.
 * @param {string} raw - Command text to submit.
 * @returns {void}
 */
function submit(raw) {
  const input = document.querySelector(".terminal-hidden-input");
  fireEvent.change(input, { target: { value: raw } });
  fireEvent.keyDown(input, { key: "Enter" });
}

beforeEach(async () => {
  vi.resetModules();
  executeCommand.mockReset();
  document.body.innerHTML = '<div id="hx29-root"></div>';
  await import("./index.js");
  // Empty intro items resolve almost immediately (a scheduled setTimeout(50)),
  // so wait for the hidden input to actually become interactive.
  await waitFor(() => {
    expect(document.querySelector(".terminal-hidden-input")).toBeTruthy();
  });
});

describe("WPTerminal handleInput robustness (robustness.md High #8)", () => {
  it("does not permanently disable input when a command handler throws", async () => {
    executeCommand.mockRejectedValueOnce(new Error("boom"));

    submit("bad-command");

    await waitFor(() => {
      expect(document.body.textContent).toContain(t.error("boom"));
    });

    // The printing lock must have been released — a second command still
    // reaches executeCommand instead of onInput staying nulled forever.
    executeCommand.mockResolvedValueOnce(["ok"]);
    submit("ls");

    await waitFor(() => {
      expect(executeCommand).toHaveBeenCalledTimes(2);
    });
  });

  it("does not permanently disable input when printing itself throws", async () => {
    // An empty __phases array is truthy (enters the phased-line branch) but
    // makes printPhasedLine destructure `text.__phases[0]`, which is
    // undefined — throwing partway through printLines, after setPrinting(true).
    executeCommand.mockResolvedValueOnce([{ __phases: [] }]);

    submit("break-print");

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Error/);
    });

    // Printing must have been released (not stuck true) — a subsequent
    // command still reaches executeCommand.
    executeCommand.mockResolvedValueOnce(["ok"]);
    submit("ls");

    await waitFor(() => {
      expect(executeCommand).toHaveBeenCalledTimes(2);
    });
  });
});
