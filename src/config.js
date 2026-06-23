const HX29 = typeof window !== "undefined" && window.hx29 ? window.hx29 : {};

export const WP_API = (HX29.rest_root || "/wp-json/").replace(/\/$/, "") + "/wp/v2";
export const NONCE = HX29.nonce || "";
export const SITE_NAME = HX29.site_name || "my-terminal";
export const UID = HX29.uid || "guest";

export const CONFIG_DEFAULTS = { font: 22, posts: 10, theme: "a", order: "desc", glow: 0 };
