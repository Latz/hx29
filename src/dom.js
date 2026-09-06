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
let _scrollAnimId = 0;
const SMOOTH_SCROLL_DURATION_MS = 180;

/**
 * Whether scrolling should animate: config is set to "smooth" (`data-scroll` on `<html>`,
 * set by `applyConfig()`) and the user hasn't requested reduced motion at the OS level.
 * Driving the animation ourselves (rather than relying on CSS `scroll-behavior: smooth`)
 * sidesteps browser-specific quirks — e.g. Firefox silently forces `scroll-behavior` to act
 * instant under `prefers-reduced-motion: reduce` regardless of author CSS — while still
 * respecting that same preference here, deliberately.
 * @returns {boolean}
 */
function _isSmoothScrollMode() {
  if (document.documentElement.dataset.scroll !== "smooth") return false;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  try {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/**
 * Scrolls `el` to the bottom, animating over `SMOOTH_SCROLL_DURATION_MS` when smooth-scroll
 * mode is active, or jumping instantly otherwise. A newer call cancels any animation still
 * in flight from a previous call so they don't fight over `scrollTop`.
 * @param {Element} el - The scrollable `.react-terminal` element.
 * @returns {void}
 */
function _scrollToBottom(el) {
  const target = el.scrollHeight;
  if (!_isSmoothScrollMode()) {
    el.scrollTop = target;
    return;
  }
  const myId = ++_scrollAnimId;
  const start = el.scrollTop;
  const change = target - start;
  if (change === 0) return;
  let startTime = null;
  const step = (now) => {
    if (myId !== _scrollAnimId) return; // superseded by a newer scroll
    if (startTime === null) startTime = now;
    const t = Math.min(1, (now - startTime) / SMOOTH_SCROLL_DURATION_MS);
    const eased = 1 - (1 - t) ** 3; // ease-out cubic
    el.scrollTop = start + change * eased;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

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
    _scrollToBottom(el);
  });
}

const FOLLOW_THROTTLE_MS = 150;
let _followLastRun = 0;
let _followTrailingTimer = null;

/**
 * Scrolls the terminal to the bottom without the CRT flash, so it can be called once per
 * printed line during output without flickering. Coalesces repeated calls within the same
 * frame via `requestAnimationFrame`, and throttles actual scrolls to at most once per
 * `FOLLOW_THROTTLE_MS` (with a trailing call) so a smooth-scroll animation (see
 * `_scrollToBottom`) has time to visibly progress instead of being retargeted before it can
 * move — at typing speeds well under that interval, back-to-back calls would otherwise keep
 * restarting the animation, making it look identical to an instant jump.
 * @returns {void}
 */
export function followTerminal() {
  const now = Date.now();
  const elapsed = now - _followLastRun;
  if (elapsed >= FOLLOW_THROTTLE_MS) {
    _followLastRun = now;
    _scheduleFollowScroll();
    return;
  }
  // A trailing call is already queued for this throttle window — later calls within the
  // same window are no-ops, so the window has a fixed end rather than being pushed out by
  // every call (which would starve the trailing call during continuous printing).
  if (_followTrailingTimer) return;
  _followTrailingTimer = setTimeout(() => {
    _followLastRun = Date.now();
    _followTrailingTimer = null;
    _scheduleFollowScroll();
  }, FOLLOW_THROTTLE_MS - elapsed);
}

/**
 * Coalesces repeated calls within the same frame into a single scroll via `requestAnimationFrame`.
 * @returns {void}
 */
function _scheduleFollowScroll() {
  if (_followScheduled) return;
  _followScheduled = true;
  requestAnimationFrame(() => {
    _followScheduled = false;
    const el = document.querySelector(".react-terminal");
    if (!el) return;
    _scrollToBottom(el);
  });
}

/**
 * Test-only: resets `followTerminal()`'s throttle/coalescing state so tests don't leak state
 * across cases (e.g. a pending `requestAnimationFrame` left un-flushed by a prior test).
 * @returns {void}
 */
export function _resetFollowThrottleForTests() {
  _followLastRun = 0;
  _followScheduled = false;
  clearTimeout(_followTrailingTimer);
  _followTrailingTimer = null;
}

/**
 * Test-only: resets `scrollTerminal()`'s coalescing state so tests don't leak a pending
 * `requestAnimationFrame` left un-flushed by a prior test.
 * @returns {void}
 */
export function _resetScrollScheduledForTests() {
  _scrollScheduled = false;
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
