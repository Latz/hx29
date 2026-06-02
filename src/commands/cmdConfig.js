import { t } from "../i18n/index.js";
import { saveConfig, applyConfig } from "../utils.js";

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
      "",
      t.config_usage,
    ];
  }
  let changed = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--font" && args[i + 1]) {
      const v = parseInt(args[++i], 10);
      if (v > 0) { cfg.font = v; changed = true; }
    } else if (args[i] === "--posts" && args[i + 1]) {
      const v = parseInt(args[++i], 10);
      if (v > 0) { cfg.posts = v; changed = true; }
    } else if (args[i] === "--theme" && args[i + 1]) {
      const v = args[++i];
      if (["a", "b", "c", "d", "e"].includes(v)) { cfg.theme = v; changed = true; }
    } else if (args[i] === "--order" && args[i + 1]) {
      const v = args[++i];
      if (["asc", "desc"].includes(v)) { cfg.order = v; changed = true; }
    }
  }
  if (changed) {
    configRef.current = cfg;
    saveConfig(cfg);
    applyConfig(cfg);
    return [t.config_saved];
  }
  return [t.config_unknown];
}
