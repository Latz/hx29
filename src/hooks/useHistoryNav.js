import { useEffect, useRef, useCallback } from "@wordpress/element";

/**
 * Sets the value of a React-controlled input using the native setter so React's
 * synthetic event system picks up the change.
 * @param {HTMLInputElement} el - The input element to update.
 * @param {string} value - New value to set.
 */
function setNativeValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Wires ArrowUp/ArrowDown history navigation to the hidden terminal input.
 * Also simulates occasional key-bounce with a self-correcting visual notice.
 * @param {import('react').RefObject<string[]>} historyRef - Command history ref (most-recent-first).
 * @param {boolean} printing - When true, key events are ignored.
 * @param {boolean} introPlaying - When true, key events are ignored.
 * @returns {{reset: function():void}} `reset` sets the navigation position back to -1; call it on command submit.
 */
export default function useHistoryNav(historyRef, printing, introPlaying) {
  const historyPosRef = useRef(-1);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (printing || introPlaying) return;
      const el = e.currentTarget;

      if (e.key.length === 1 && Math.random() < 0.005) {
        setTimeout(() => {
          const before = el.value;
          const pos = el.selectionStart ?? before.length;
          const doubled = before.slice(0, pos) + e.key + before.slice(pos);
          setNativeValue(el, doubled);
          const notice = document.createElement("div");
          notice.textContent = "[KEY_BOUNCE RECALIBRATED]";
          notice.style.cssText =
            "position:fixed;bottom:12px;right:16px;color:var(--dim);font-family:var(--font);font-size:12px;pointer-events:none;z-index:9999;opacity:1;transition:opacity 0.3s";
          document.body.appendChild(notice);
          setTimeout(() => {
            const cur = el.value;
            const p = el.selectionStart ?? cur.length;
            if (p > 0) setNativeValue(el, cur.slice(0, p - 1) + cur.slice(p));
            notice.style.opacity = "0";
            setTimeout(() => notice.remove(), 320);
          }, 120);
        }, 0);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const h = historyRef.current;
        if (!h.length) return;
        const next = Math.min(historyPosRef.current + 1, h.length - 1);
        historyPosRef.current = next;
        setNativeValue(el, h[next]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const h = historyRef.current;
        const next = historyPosRef.current - 1;
        historyPosRef.current = Math.max(next, -1);
        setNativeValue(el, next < 0 ? "" : h[next]);
      }
    };

    const attach = () => {
      const el = document.querySelector(".terminal-hidden-input");
      if (el) {
        el.addEventListener("keydown", onKeyDown, true);
        return el;
      }
      return null;
    };

    let el = attach();
    let timer;
    if (!el) {
      timer = setTimeout(() => { el = attach(); }, 300);
    }

    return () => {
      clearTimeout(timer);
      if (el) el.removeEventListener("keydown", onKeyDown, true);
    };
  }, [printing]);

  const reset = useCallback(() => { historyPosRef.current = -1; }, []);
  return { reset };
}
