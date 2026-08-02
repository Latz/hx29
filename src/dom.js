import { LINE_W } from "./format.js";
import { cosmeticRandom } from "./random.js";

/**
 * Calculates how many terminal lines fit in the visible `.react-terminal` element.
 * Reserves 7 lines beyond the page content: the echoed input line, a blank
 * line, the "more" continuation message, the active prompt/input row, and
 * extra slack for the `fontSize * 1.4` line-height estimate under-measuring
 * the actual rendered row height (empirically ~3 lines of drift over a full
 * page — see commit history for `getPageLines`).
 * Falls back to 20 if the element is not yet in the DOM.
 * @returns {number}
 */
export function getPageLines() {
  const el = document.querySelector(".react-terminal");
  if (!el) return 20;
  const lineH = Number.parseFloat(getComputedStyle(el).fontSize) * 1.4;
  return Math.max(5, Math.floor(el.clientHeight / lineH) - 7);
}

let _lineWidthCache = 0;
if (typeof window !== "undefined") {
  window.addEventListener("resize", () => { _lineWidthCache = 0; }, { passive: true });
}

/**
 * Measures how many monospace characters fit in one terminal line.
 * Result is cached until the next resize event.
 * Falls back to `LINE_W` if unmeasurable.
 * @returns {number}
 */
export function getLineWidth() {
  if (_lineWidthCache > 0) return _lineWidthCache;
  const el = document.querySelector(".react-terminal");
  if (!el) return LINE_W;
  const span = document.createElement("span");
  span.className = "hx29-measure-span";
  span.textContent = "M";
  el.appendChild(span);
  const charW = span.getBoundingClientRect().width;
  span.remove();
  _lineWidthCache = charW > 0 ? Math.floor(el.clientWidth / charW) : LINE_W;
  return _lineWidthCache;
}

let _scrollScheduled = false;
let _followScheduled = false;

/**
 * Scrolls the terminal to the bottom with a brief CRT opacity flash.
 * Coalesces repeated calls within the same frame into a single scroll/reflow via `requestAnimationFrame`.
 * Intended for one-off "settle" scrolls (e.g. after a command finishes) — for scrolling to
 * follow output line-by-line during printing, use `followTerminal()` instead, which skips the
 * flash so rapid successive calls don't flicker.
 * @returns {void}
 */
export function scrollTerminal() {
  if (_scrollScheduled) return;
  _scrollScheduled = true;
  requestAnimationFrame(() => {
    _scrollScheduled = false;
    const el = document.querySelector(".react-terminal");
    if (!el) return;
    const wrapper = document.querySelector(".react-terminal-wrapper");
    if (wrapper) {
      wrapper.classList.add("hx29-scroll-flash");
      setTimeout(() => {
        wrapper.classList.replace("hx29-scroll-flash", "hx29-scroll-flash-restore");
      }, 50);
    }
    el.scrollTop = el.scrollHeight;
  });
}

/**
 * Scrolls the terminal to the bottom without the CRT flash, so it can be called once per
 * printed line during output without flickering. Coalesces repeated calls within the same
 * frame via `requestAnimationFrame`.
 * @returns {void}
 */
export function followTerminal() {
  if (_followScheduled) return;
  _followScheduled = true;
  requestAnimationFrame(() => {
    _followScheduled = false;
    const el = document.querySelector(".react-terminal");
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
}

/**
 * Returns the number of line elements currently rendered in the terminal.
 * @returns {number}
 */
export function getRenderedLineCount() {
  return document.querySelectorAll(".react-terminal .react-terminal-line").length;
}

/**
 * With 3% probability applies a CRT sync-tear animation to the last terminal line.
 * @returns {void}
 */
export function maybeSyncTear() {
  if (cosmeticRandom() >= 0.03) return;
  const lines = document.querySelectorAll(".react-terminal .react-terminal-line");
  if (!lines.length) return;
  const target = lines[lines.length - 1];
  const duration = 40 + cosmeticRandom() * 40;
  target.classList.add("sync-tear");
  target.style.setProperty("--tear-duration", `${duration}ms`);
  setTimeout(() => {
    target.classList.remove("sync-tear");
    target.style.removeProperty("--tear-duration");
  }, duration + 10);
}
