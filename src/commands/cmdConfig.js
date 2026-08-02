import { t } from "../i18n/index.js";
import { saveConfig, applyConfig } from "../utils.js";

const FLAG_PARSERS = {
  "--font": (v, cfg) => {
    const n = Number.parseInt(v, 10);
    if (n > 0) { cfg.font = n; return true; }
    return false;
  },
  "--posts": (v, cfg) => {
    const n = Number.parseInt(v, 10);
    if (n > 0) { cfg.posts = n; return true; }
    return false;
  },
  "--theme": (v, cfg) => {
    if (["a", "b", "c", "d", "e"].includes(v)) { cfg.theme = v; return true; }
    return false;
  },
  "--order": (v, cfg) => {
    if (["asc", "desc"].includes(v)) { cfg.order = v; return true; }
    return false;
  },
  "--glow": (v, cfg) => {
    const n = Number.parseFloat(v);
    if (!Number.isNaN(n) && n >= 0 && n <= 1) { cfg.glow = n; return true; }
    return false;
  },
  "--scroll": (v, cfg) => {
    if (["jump", "smooth"].includes(v)) { cfg.scroll = v; return true; }
    return false;
  },
};

/**
 * Applies recognised `--flag value` pairs to `cfg` in place.
 * @param {string[]} args - Flag/value pairs.
 * @param {{font:number,posts:number,theme:string,order:string,glow?:number,scroll?:string}} cfg - Config object, mutated in place.
 * @returns {boolean} `true` if any flag was applied.
 */
function applyConfigFlags(args, cfg) {
  let changed = false;
  for (let i = 0; i < args.length; i++) {
    const parser = FLAG_PARSERS[args[i]];
    if (parser && args[i + 1] !== undefined) {
      if (parser(args[++i], cfg)) changed = true;
    }
  }
  return changed;
}

/**
 * Reads or updates the persistent user config (font size, page size, theme, sort order).
 * With no args prints current values; with flags (--font, --posts, --theme, --order) updates them.
 * @param {string[]} args - Flag/value pairs, e.g. `["--font", "18", "--theme", "b"]`.
 * @param {import('react').RefObject<{font:number,posts:number,theme:string,order:string}>} configRef - User config ref, mutated in place on change.
 * @returns {string[]} Status lines.
 */
export default function cmdConfig(args, configRef) {
  const cfg = { ...configRef.current };
  if (!args.length) {
    return [
      t.config_current_title,
      "",
      t.config_font(cfg.font),
      t.config_posts(cfg.posts),
      t.config_theme(cfg.theme),
      t.config_order(cfg.order),
      t.config_glow(cfg.glow ?? 0),
      t.config_scroll(cfg.scroll ?? "jump"),
      "",
      t.config_usage,
    ];
  }
  const changed = applyConfigFlags(args, cfg);
  if (changed) {
    configRef.current = cfg;
    saveConfig(cfg);
    applyConfig(cfg);
    return [t.config_saved];
  }
  return [t.config_unknown];
}
