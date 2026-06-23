// Keep in sync with the switch cases in registry.js
const TOP_LEVEL = [
  "c", "cat", "cd", "clear", "comment", "comments", "config",
  "grep", "help", "history", "l", "link", "ls", "m", "man",
  "n", "r", "read", "search",
];

const LS_SUBS = ["categories", "cats", "pages", "posts", "tags"];

const SLUG_CMDS = new Set(["read", "r", "cat"]);

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
  if (!input) return null;

  const parts = input.split(" ");

  // Trailing space means the user finished a word — nothing to complete
  if (input.endsWith(" ")) return null;

  if (parts.length === 2) {
    const [cmd, prefix] = parts;

    if (cmd === "ls") {
      const matches = LS_SUBS.filter((s) => s.startsWith(prefix));
      if (matches.length === 1) return `ls ${matches[0]}`;
      return null;
    }

    if (SLUG_CMDS.has(cmd)) {
      const slugMap = pager.current?.slugMap;
      if (!slugMap) return null;
      const slugs = Object.values(slugMap)
        .map((e) => (typeof e === "object" ? e.slug : e))
        .filter(Boolean);
      const matches = slugs.filter((s) => s.startsWith(prefix));
      if (matches.length === 1) return `${cmd} ${matches[0]}`;
      return null;
    }

    return null;
  }

  if (parts.length === 1) {
    const prefix = parts[0];
    const matches = TOP_LEVEL.filter((c) => c.startsWith(prefix));
    if (matches.length === 1) return matches[0];
    return null;
  }

  return null;
}
