import { LINE_W } from "./format.js";

/**
 * Calculates how many terminal lines fit in the visible `.react-terminal` element.
 * Falls back to 20 if the element is not yet in the DOM.
 * @returns {number}
 */
export function getPageLines() {
  const el = document.querySelector(".react-terminal");
  if (!el) return 20;
  const lineH = Number.parseFloat(getComputedStyle(el).fontSize) * 1.4;
  return Math.max(5, Math.floor(el.clientHeight / lineH) - 3);
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
  span.style.cssText =
    "position:absolute;visibility:hidden;font-family:var(--font,monospace);font-size:var(--fsize,22px);white-space:pre";
  span.textContent = "M";
  el.appendChild(span);
  const charW = span.getBoundingClientRect().width;
  span.remove();
  _lineWidthCache = charW > 0 ? Math.floor(el.clientWidth / charW) : LINE_W;
  return _lineWidthCache;
}

/**
 * Scrolls the terminal to the bottom with a brief CRT opacity flash.
 * @returns {void}
 */
export function scrollTerminal() {
  const el = document.querySelector(".react-terminal");
  if (!el) return;
  const wrapper = document.querySelector(".react-terminal-wrapper");
  if (wrapper) {
    wrapper.style.transition = "opacity 50ms linear";
    wrapper.style.opacity = "0.94";
    setTimeout(() => {
      wrapper.style.transition = "opacity 120ms ease-out";
      wrapper.style.opacity = "1";
    }, 50);
  }
  el.scrollTop = el.scrollHeight;
}

/**
 * With 3% probability applies a CRT sync-tear animation to the last terminal line.
 * @returns {void}
 */
export function maybeSyncTear() {
  if (Math.random() >= 0.03) return;
  const lines = document.querySelectorAll(".react-terminal .react-terminal-line");
  if (!lines.length) return;
  const target = lines[lines.length - 1];
  const duration = 40 + Math.random() * 40;
  target.classList.add("sync-tear");
  target.style.animationDuration = `${duration}ms`;
  setTimeout(() => {
    target.classList.remove("sync-tear");
    target.style.animationDuration = "";
  }, duration + 10);
}
