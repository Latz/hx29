import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";
import { stripHtml } from "../utils.js";

let _prevContext = { category: null, tag: null };

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
 * Renders one status line per active context slot (category and/or tag).
 * @param {{category:{id:number,slug:string,name:string}|null,tag:{id:number,slug:string,name:string}|null}} ctx - Active context.
 * @returns {string[]} One `cd_current` line per active slot.
 */
function describeContext(ctx) {
  const lines = [];
  if (ctx.category) lines.push(t.cd_current(ctx.category.name, "category"));
  if (ctx.tag) lines.push(t.cd_current(ctx.tag.name, "tag"));
  return lines;
}

/**
 * Merges a resolved `cd` pick into its matching context slot (category or
 * tag), leaving the other slot untouched, and updates the prompt display.
 * @param {{type:string,id:number,slug:string,name:string}} pick - Resolved taxonomy term.
 * @param {import('react').RefObject<{category:Object|null,tag:Object|null}>} contextRef - Active context ref, mutated on change.
 * @param {function({category:Object|null,tag:Object|null}|null):void} setCtxDisplay - Updates the prompt display.
 * @returns {string[]} Status lines.
 */
export function applyCdPick(pick, contextRef, setCtxDisplay) {
  _prevContext = { ...contextRef.current };
  const slot = { id: pick.id, slug: pick.slug, name: pick.name };
  contextRef.current = { ...contextRef.current, [pick.type]: slot };
  setCtxDisplay({ ...contextRef.current });

  const lines = [t.cd_now_in(pick.name, pick.type)];
  const otherType = pick.type === "category" ? "tag" : "category";
  if (!contextRef.current[otherType]) lines.push(t.cd_hint_combine(otherType));
  return lines;
}

/**
 * Applies a `cd` resolution: updates the context ref/display for an exact or
 * single match, stages disambiguation candidates, or reports not-found.
 * @param {{kind:"exact"|"single"|"multiple"|"none", item?:Object, candidates?:Array<Object>}} resolved - Result from `resolveCdTarget`.
 * @param {string} target - Original target string, for the not-found message.
 * @param {import('react').RefObject<{category:Object|null,tag:Object|null}>} contextRef - Active context ref, mutated on change.
 * @param {function({category:Object|null,tag:Object|null}|null):void} setCtxDisplay - Updates the prompt display.
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

  return applyCdPick(resolved.item, contextRef, setCtxDisplay);
}

/**
 * Changes the active taxonomy context (category and/or tag) used to filter `ls posts`.
 * Supports exact slug/name, partial match, and interactive disambiguation.
 * `cd <slug>` only replaces the matching slot (category or tag), leaving the
 * other slot active — this is how category and tag context combine.
 * `cd ..` pops one path segment (tag first, then category); `cd /` resets to root.
 * `cd` with no args shows the current context.
 * @param {string[]} args - Target name/slug tokens, or empty to show current context.
 * @param {import('react').RefObject<{category:Object|null,tag:Object|null}>} contextRef - Active context ref, mutated on change.
 * @param {function({category:Object|null,tag:Object|null}|null):void} setCtxDisplay - Updates the prompt display.
 * @param {import('react').RefObject<{candidates:Array}|null>} pendingRef - Set when disambiguation is needed.
 * @returns {Promise<string[]>} Status lines.
 */
export default async function cmdCd(args, contextRef, setCtxDisplay, pendingRef) {
  const target = args.join(" ").toLowerCase().trim();

  if (!target) {
    const ctx = contextRef.current;
    const lines = describeContext(ctx);
    return lines.length ? lines : [t.cd_no_context];
  }

  if (target === "/") {
    _prevContext = { ...contextRef.current };
    contextRef.current = { category: null, tag: null };
    setCtxDisplay(null);
    return [t.cd_back_to_root];
  }

  if (target === "..") {
    _prevContext = { ...contextRef.current };
    if (contextRef.current.tag) {
      contextRef.current = { ...contextRef.current, tag: null };
      setCtxDisplay(contextRef.current.category ? { ...contextRef.current } : null);
      return [t.cd_popped_tag];
    }
    if (contextRef.current.category) {
      contextRef.current = { ...contextRef.current, category: null };
      setCtxDisplay(null);
      return [t.cd_back_to_root];
    }
    return [t.cd_back_to_root];
  }

  if (target === "-") {
    if (!_prevContext.category && !_prevContext.tag) return [t.cd_no_context];
    const prev = { ..._prevContext };
    _prevContext = { ...contextRef.current };
    contextRef.current = prev;
    setCtxDisplay(prev.category || prev.tag ? { ...prev } : null);
    return describeContext(prev);
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
