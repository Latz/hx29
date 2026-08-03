import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import { stripHtml } from "../utils.js";

let _prevContext = { type: null, id: null, name: null };

/**
 * Finds an exact slug or name match for `target` within a taxonomy list.
 * @param {Array<{slug:string,name:string}>} list - Categories or tags.
 * @param {string} target - Lowercased target string.
 * @param {string} type - `"category"` or `"tag"`, tagged onto the match.
 * @returns {Object|null} The matched term (with `type` added), or null.
 */
function findExactMatch(list, target, type) {
  const item = list.find((x) => x.slug === target || x.name.toLowerCase() === target.toLowerCase());
  return item ? { ...item, type } : null;
}

/**
 * Finds partial slug/name matches for `target` within a taxonomy list.
 * @param {Array<{slug:string,name:string}>} list - Categories or tags.
 * @param {string} target - Lowercased target string.
 * @param {string} type - `"category"` or `"tag"`, tagged onto each match.
 * @returns {Array<Object>} Matching terms (each with `type` added).
 */
function findCandidates(list, target, type) {
  return list.filter((x) => x.slug.includes(target) || x.name.toLowerCase().includes(target)).map((x) => ({ ...x, type }));
}

/**
 * Resolves a `cd` target against the taxonomy lists: exact match first, then
 * partial matches (single = auto-select, multiple = disambiguation, none = not found).
 * @param {string} target - Lowercased target string.
 * @param {Array<Object>} cats - All categories.
 * @param {Array<Object>} tags - All tags.
 * @returns {{kind:"exact"|"single"|"multiple"|"none", item?:Object, candidates?:Array<Object>}} Resolution result.
 */
function resolveCdTarget(target, cats, tags) {
  const exact = findExactMatch(cats, target, "category") || findExactMatch(tags, target, "tag");
  if (exact) return { kind: "exact", item: exact };

  const candidates = [...findCandidates(cats, target, "category"), ...findCandidates(tags, target, "tag")];
  if (candidates.length === 1) return { kind: "single", item: candidates[0] };
  if (candidates.length > 1) return { kind: "multiple", candidates };
  return { kind: "none" };
}

/**
 * Applies a `cd` resolution: updates the context ref/display for an exact or
 * single match, stages disambiguation candidates, or reports not-found.
 * @param {{kind:"exact"|"single"|"multiple"|"none", item?:Object, candidates?:Array<Object>}} resolved - Result from `resolveCdTarget`.
 * @param {string} target - Original target string, for the not-found message.
 * @param {import('react').RefObject<{type:string|null,id:number|null,name:string|null}>} contextRef - Active context ref, mutated on change.
 * @param {function({type:string,name:string}|null):void} setCtxDisplay - Updates the prompt display.
 * @param {import('react').RefObject<{candidates:Array}|null>} pendingRef - Set when disambiguation is needed.
 * @returns {string[]} Status lines.
 */
function applyCdResolution(resolved, target, contextRef, setCtxDisplay, pendingRef) {
  if (resolved.kind === "none") return [t.cd_not_found(target)];

  if (resolved.kind === "multiple") {
    if (pendingRef) pendingRef.current = { candidates: resolved.candidates };
    return [
      t.cd_matches_found,
      "",
      ...resolved.candidates.map((c, i) => t.cd_match_item(i + 1, c.name, c.type)),
    ];
  }

  const pick = resolved.item;
  _prevContext = { ...contextRef.current };
  contextRef.current = { type: pick.type, id: pick.id, name: pick.name };
  setCtxDisplay({ type: pick.type, name: pick.slug });
  const lines = [t.cd_now_in(pick.name, pick.type)];
  if (pick.type === "category") lines.push(t.cd_hint_combine);
  return lines;
}

/**
 * Changes the active taxonomy context (category or tag) used to filter `ls posts`.
 * Supports exact slug/name, partial match, and interactive disambiguation.
 * `cd ..` or `cd /` resets to root. `cd` with no args shows the current context.
 * @param {string[]} args - Target name/slug tokens, or empty to show current context.
 * @param {import('react').RefObject<{type:string|null,id:number|null,name:string|null}>} contextRef - Active context ref, mutated on change.
 * @param {function({type:string,name:string}|null):void} setCtxDisplay - Updates the prompt display.
 * @param {import('react').RefObject<{candidates:Array}|null>} pendingRef - Set when disambiguation is needed.
 * @returns {Promise<string[]>} Status lines.
 */
export default async function cmdCd(args, contextRef, setCtxDisplay, pendingRef) {
  const target = args.join(" ").toLowerCase().trim();

  if (!target) {
    const ctx = contextRef.current;
    if (!ctx.type) return [t.cd_no_context];
    return [t.cd_current(ctx.name, ctx.type)];
  }

  if (target === ".." || target === "/") {
    _prevContext = { ...contextRef.current };
    contextRef.current = { type: null, id: null, name: null };
    setCtxDisplay(null);
    return [t.cd_back_to_root];
  }

  if (target === "-") {
    if (!_prevContext.type) return [t.cd_no_context];
    const prev = { ..._prevContext };
    _prevContext = { ...contextRef.current };
    contextRef.current = prev;
    setCtxDisplay({ type: prev.type, name: prev.name });
    return [t.cd_now_in(prev.name, prev.type)];
  }

  try {
    const { cats } = await fetchCategories(1, 100);
    const { tags } = await fetchTags(1, 100);
    const decodedCats = cats.map((c) => ({ ...c, name: stripHtml(c.name) }));
    const decodedTags = tags.map((tg) => ({ ...tg, name: stripHtml(tg.name) }));
    const resolved = resolveCdTarget(target, decodedCats, decodedTags);
    return applyCdResolution(resolved, target, contextRef, setCtxDisplay, pendingRef);
  } catch (e) {
    return [fmtApiError(e)];
  }
}
