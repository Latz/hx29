import { t } from "../i18n/index.js";
import cmdMan from "./cmdMan.js";

const COL_GAP = 2;

/**
 * Formats one help section: an uppercase title followed by its commands, each
 * padded so descriptions line up in a column at the width of the longest command,
 * plus an optional trailing clarifying note.
 * @param {{title:string, items: Array<[string,string]>, note?:string}} section - Section title, `[command, description]` pairs, and an optional note.
 * @returns {string[]} Rendered lines for this section (title + one line per command + optional note).
 */
function formatSection(section) {
  const width = Math.max(...section.items.map(([cmd]) => cmd.length));
  const lines = [
    `${section.title}:`,
    ...section.items.map(([cmd, desc]) => `  ${cmd.padEnd(width + COL_GAP)}${desc}`),
  ];
  if (section.note) lines.push("", `  ${section.note}`);
  return lines;
}

/**
 * Returns the help text listing all available commands, grouped into sections —
 * or, when a command name is given, delegates to `man` for that command's detail page.
 * @param {string[]} [args] - `[command?]`; when present, shows that command's man page instead.
 * @param {import('react').RefObject<Object|null>} [pager] - Shared pager state ref, forwarded to `man`.
 * @returns {string[]} Array of localised help lines, or the requested man page.
 */
export default function cmdHelp(args, pager) {
  if (args?.length) return cmdMan(args, pager);

  const lines = [t.help_available_commands, ""];
  t.help_sections.forEach((section, i) => {
    if (i > 0) lines.push("");
    lines.push(...formatSection(section));
  });
  lines.push("", t.help_footer_hint, "", t.help_tip);
  return lines;
}
