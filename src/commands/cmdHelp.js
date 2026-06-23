import { t } from "../i18n/index.js";

/**
 * Returns the help text listing all available commands.
 * @returns {string[]} Array of localised help lines.
 */
export default function cmdHelp() {
  return [
    t.help_available_commands,
    "",
    t.help_ls,
    t.help_cd,
    t.help_read,
    t.help_link,
    t.help_search,
    t.help_grep,
    t.help_comments,
    t.help_comment,
    t.help_cat,
    t.help_history,
    t.help_config,
    t.help_clear,
    t.help_help,
    t.help_man,
    "",
    t.help_tip,
  ];
}
