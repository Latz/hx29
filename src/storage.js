import { CONFIG_DEFAULTS } from "./config.js";

/**
 * `; Secure` when served over HTTPS, so persisted cookies aren't sent over
 * a plaintext connection on a downgraded or mixed-content page.
 * @returns {string}
 */
function secureAttr() {
  return location.protocol === "https:" ? "; Secure" : "";
}

/**
 * Loads the user config from the `hx29_config` cookie, merged with defaults.
 * @returns {{font:number,posts:number,theme:string,order:string}}
 */
export function loadConfig() {
  const c = document.cookie.split("; ").find((r) => r.startsWith("hx29_config="));
  if (!c) return { ...CONFIG_DEFAULTS };
  try {
    return { ...CONFIG_DEFAULTS, ...JSON.parse(decodeURIComponent(c.split("=").slice(1).join("="))) };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

/**
 * Persists the user config to the `hx29_config` cookie (1-year expiry).
 * @param {{font:number,posts:number,theme:string,order:string}} cfg
 * @returns {void}
 */
export function saveConfig(cfg) {
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `hx29_config=${encodeURIComponent(JSON.stringify(cfg))}; expires=${exp}; path=/; SameSite=Lax${secureAttr()}`;
}

/**
 * Applies config values to the DOM: `--fsize`/`--glow` CSS variables and
 * `data-theme`/`data-scroll` attributes.
 * @param {{font:number,theme:string,scroll?:string}} cfg
 * @returns {void}
 */
export function applyConfig(cfg) {
  document.documentElement.style.setProperty("--fsize", cfg.font + "px");
  document.documentElement.style.setProperty("--glow", cfg.glow ?? 0);
  if (cfg.theme && cfg.theme !== "a") {
    document.documentElement.dataset.theme = cfg.theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
  if (cfg.scroll === "smooth") {
    document.documentElement.dataset.scroll = "smooth";
  } else {
    delete document.documentElement.dataset.scroll;
  }
}

/**
 * Loads the command history array from the `hx29_history` cookie.
 * @returns {string[]} Most-recent-first. Empty array on missing/corrupt cookie.
 */
export function loadHistory() {
  const c = document.cookie.split("; ").find((r) => r.startsWith("hx29_history="));
  if (!c) return [];
  try {
    return JSON.parse(decodeURIComponent(c.split("=").slice(1).join("=")));
  } catch {
    return [];
  }
}

/**
 * Prepends a command to the history ref, deduplicates, caps at 25, and persists to cookie.
 * @param {import('react').RefObject<string[]>} historyRef
 * @param {string} cmd
 * @returns {void}
 */
export function pushHistory(historyRef, cmd) {
  const h = historyRef.current;
  const idx = h.indexOf(cmd);
  if (idx !== -1) h.splice(idx, 1);
  h.unshift(cmd);
  if (h.length > 25) h.length = 25;
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `hx29_history=${encodeURIComponent(JSON.stringify(h))}; expires=${exp}; path=/; SameSite=Lax${secureAttr()}`;
}
