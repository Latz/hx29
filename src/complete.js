// Keep in sync with the switch cases in registry.js
const TOP_LEVEL = [
  "c", "cat", "cd", "clear", "comments", "config",
  "grep", "help", "history", "l", "link", "ls", "m", "man",
  "n", "r", "read", "reply", "search",
];

const LS_SUBS = ["categories", "cats", "pages", "posts", "tags"];

const SLUG_CMDS = new Set(["read", "r", "cat"]);

/**
 * Completes an `ls <prefix>` subcommand.
 * @param {string} prefix - Partial subcommand text.
 * @returns {string|null} Completed `ls <sub>` string, or null if ambiguous/no match.
 */
function completeLsSub(prefix) {
  const matches = LS_SUBS.filter((s) => s.startsWith(prefix));
  return matches.length === 1 ? `ls ${matches[0]}` : null;
}

/**
 * Completes a `<read|r|cat> <prefix>` post slug from the pager's slugMap.
 * @param {string} cmd - The command word.
 * @param {string} prefix - Partial slug text.
 * @param {{current: {slugMap?: Object}|null}} pager - Shared pager ref.
 * @returns {string|null} Completed `<cmd> <slug>` string, or null if ambiguous/no match.
 */
function completeSlug(cmd, prefix, pager) {
  const slugMap = pager.current?.slugMap;
  if (!slugMap) return null;
  const slugs = Object.values(slugMap)
    .map((e) => (typeof e === "object" ? e.slug : e))
    .filter(Boolean);
  const matches = slugs.filter((s) => s.startsWith(prefix));
  return matches.length === 1 ? `${cmd} ${matches[0]}` : null;
}

/**
 * Completes a two-word input (`cmd prefix`), dispatching to the `ls` or slug completer.
 * @param {string} cmd - The command word.
 * @param {string} prefix - Partial second-word text.
 * @param {{current: {slugMap?: Object}|null}} pager - Shared pager ref.
 * @returns {string|null} Completed string, or null if ambiguous/no match.
 */
function completeTwoWord(cmd, prefix, pager) {
  if (cmd === "ls") return completeLsSub(prefix);
  if (SLUG_CMDS.has(cmd)) return completeSlug(cmd, prefix, pager);
  return null;
}

/**
 * Completes a single-word input against the top-level command list.
 * @param {string} prefix - Partial command text.
 * @returns {string|null} Completed command, or null if ambiguous/no match.
 */
function completeTopLevel(prefix) {
  const matches = TOP_LEVEL.filter((c) => c.startsWith(prefix));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Returns the completed string for a Tab keypress, or null if no unambiguous
 * completion exists.
 *
 * Completion tiers (checked in order):
 *  1. `ls <prefix>` → ls subcommand
 *  2. `<read|r|cat> <prefix>` → post slug from pager slugMap
 *  3. `<prefix>` → top-level command
 *
 * @param {string} input - Current input field value.
 * @param {{current: {slugMap?: Object}|null}} pager - Shared pager ref.
 * @returns {string|null} Completed string, or null if ambiguous/no match.
 */
export function complete(input, pager) {
  // Trailing space means the user finished a word — nothing to complete
  if (!input || input.endsWith(" ")) return null;

  const parts = input.split(" ");
  if (parts.length === 2) return completeTwoWord(parts[0], parts[1], pager);
  if (parts.length === 1) return completeTopLevel(parts[0]);
  return null;
}
