import { t } from "./i18n/index.js";
import { ApiError } from "./api/apiFetch.js";

/**
 * Converts an ApiError (or generic Error) to a localised error string.
 * @param {Error} e
 * @returns {string}
 */
export function fmtApiError(e) {
  if (e instanceof ApiError) {
    if (e.type === "timeout")    return t.error_timeout;
    if (e.type === "rate_limit") return t.error_rate_limit;
    if (e.type === "server")     return t.error_server(e.status);
  }
  return t.error(e.message);
}
