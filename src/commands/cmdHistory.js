import { t } from "../i18n/index.js";

/**
 * Returns the command history as a formatted numbered list.
 * @param {import('react').MutableRefObject<string[]>} historyRef - Command history ref (most-recent-first).
 * @returns {string[]} Formatted history lines.
 */
export default function cmdHistory(historyRef) {
  const h = historyRef.current;
  if (!h.length) return [t.history_empty];
  return [
    t.history_title,
    "",
    ...h.slice().reverse().map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`),
  ];
}
