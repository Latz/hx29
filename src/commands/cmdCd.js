import { t } from "../i18n/index.js";
import { fmtApiError } from "../apiError.js";
import { fetchCategories, fetchTags } from "../api/taxonomy.js";

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
let _prevContext = { type: null, id: null, name: null };

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

    const cat = cats.find((c) => c.slug === target || c.name.toLowerCase() === target.toLowerCase());
    if (cat) {
      _prevContext = { ...contextRef.current };
      contextRef.current = { type: "category", id: cat.id, name: cat.name };
      setCtxDisplay({ type: "category", name: cat.slug });
      return [t.cd_now_in(cat.name, "category"), t.cd_hint_combine];
    }

    const tag = tags.find((tg) => tg.slug === target || tg.name.toLowerCase() === target.toLowerCase());
    if (tag) {
      _prevContext = { ...contextRef.current };
      contextRef.current = { type: "tag", id: tag.id, name: tag.name };
      setCtxDisplay({ type: "tag", name: tag.slug });
      return [t.cd_now_in(tag.name, "tag")];
    }

    const candidates = [
      ...cats.filter((c) => c.slug.includes(target) || c.name.toLowerCase().includes(target)).map((c) => ({ ...c, type: "category" })),
      ...tags.filter((tg) => tg.slug.includes(target) || tg.name.toLowerCase().includes(target)).map((tg) => ({ ...tg, type: "tag" })),
    ];

    if (candidates.length === 1) {
      const pick = candidates[0];
      _prevContext = { ...contextRef.current };
      contextRef.current = { type: pick.type, id: pick.id, name: pick.name };
      setCtxDisplay({ type: pick.type, name: pick.slug });
      const lines = [t.cd_now_in(pick.name, pick.type)];
      if (pick.type === "category") lines.push(t.cd_hint_combine);
      return lines;
    }

    if (candidates.length > 1) {
      if (pendingRef) pendingRef.current = { candidates };
      return [
        t.cd_matches_found,
        "",
        ...candidates.map((c, i) => t.cd_match_item(i + 1, c.name, c.type)),
      ];
    }

    return [t.cd_not_found(target)];
  } catch (e) {
    return [fmtApiError(e)];
  }
}
