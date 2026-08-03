import apiFetch from "@wordpress/api-fetch";

const HX29 = typeof window !== "undefined" && window.hx29 ? window.hx29 : {};

export const WP_API = (HX29.rest_root || "/wp-json/").replace(/\/$/, "") + "/wp/v2";
export const NONCE = HX29.nonce || "";
export const SITE_NAME = HX29.site_name || "my-terminal";
export const UID = HX29.uid || "guest";
export const PROMPT_PREFIX = HX29.prompt_prefix || "user@system";
export const TYPING_SPEED = Number(HX29.typing_speed) || 1;

export const CONFIG_DEFAULTS = Object.freeze({ font: 22, posts: 10, theme: "a", order: "desc", glow: 0, scroll: "jump" });

if (HX29.rest_root) apiFetch.use(apiFetch.createRootURLMiddleware(HX29.rest_root));
if (NONCE) apiFetch.use(apiFetch.createNonceMiddleware(NONCE));
