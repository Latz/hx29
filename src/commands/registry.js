import { t } from "../i18n/index.js";
import cmdHelp from "./cmdHelp.js";
import cmdN from "./cmdN.js";
import cmdLs from "./cmdLs.js";
import cmdRead from "./cmdRead.js";
import cmdLink from "./cmdLink.js";
import cmdSearch from "./cmdSearch.js";
import cmdGrep from "./cmdGrep.js";
import cmdComments from "./cmdComments.js";
import cmdReply from "./cmdReply.js";
import cmdHistory from "./cmdHistory.js";
import cmdMan from "./cmdMan.js";
import cmdConfig from "./cmdConfig.js";
import cmdCd from "./cmdCd.js";
import cmdCat from "./cmdCat.js";

/**
 * Parses raw terminal input and dispatches to the matching command handler.
 * @param {string} rawInput - The full input string typed by the user.
 * @param {import('react').RefObject<{type:string,page:number,total:number,slugMap:Object,lines?:Array,offset?:number}|null>} pager - Shared pager state ref.
 * @param {import('react').RefObject<{font:number,posts:number,theme:string,order:string}>} configRef - User config ref.
 * @param {import('react').RefObject<{type:string|null,id:number|null,name:string|null}>} contextRef - Active taxonomy context ref.
 * @param {import('react').RefObject<string[]>} historyRef - Command history ref.
 * @param {function({type:string,name:string}|null):void} setCtxDisplay - Updates the prompt context display.
 * @param {import('react').RefObject<{candidates:Array}|null>} pendingRef - Pending disambiguation ref.
 * @returns {Promise<Array<string|import('react').ReactElement>|"__CLEAR__">}
 */
export async function executeCommand(rawInput, pager, configRef, contextRef, historyRef, setCtxDisplay, pendingRef) {
  const parts = rawInput.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "help":    return cmdHelp();
    case "n":
    case "m":       return cmdN(pager, configRef);
    case "ls":      return cmdLs(args, pager, configRef, contextRef);
    case "cat":     return cmdCat(args, pager);
    case "r":
    case "read":    return cmdRead(args, pager);
    case "l":
    case "link":    return cmdLink(args, pager);
    case "search":  return cmdSearch(args, pager, configRef);
    case "grep":    return cmdGrep(args, pager);
    case "comments": return cmdComments(args, pager);
    case "c":
    case "reply":   return cmdReply(args, pager);
    case "history": return cmdHistory(historyRef);
    case "man":     return cmdMan(args, pager);
    case "config":  return cmdConfig(args, configRef);
    case "cd":      return cmdCd(args, contextRef, setCtxDisplay, pendingRef);
    case "clear":   return "__CLEAR__";
    case "":        return [];
    default:        return [t.unknown_command(cmd)];
  }
}
