import { fetchPostBySlug } from "../api/posts.js";
import apiFetch from "../api/apiFetch.js";

/**
 * Resolves a post from a `cat`/`read` argument: a slug, or a 1-based ordinal
 * (either a pager slugMap entry or, failing that, the nth most recent post).
 * @param {string} slugArg - Raw argument: a slug or a numeric ordinal.
 * @param {Object<number, string|{slug:string}>} savedSlugMap - Pager slugMap from the previous listing, if any.
 * @returns {Promise<{post: Object|null, slug: string}>} The resolved post (or null if not found) and the slug used to look it up.
 */
export async function resolvePost(slugArg, savedSlugMap) {
  let slug = slugArg;
  const num = Number.parseInt(slug, 10);
  let resolvedFromMap = false;
  if (!Number.isNaN(num) && savedSlugMap[num]) {
    const entry = savedSlugMap[num];
    slug = typeof entry === "object" ? entry.slug : entry;
    resolvedFromMap = true;
  }

  let post = (Number.isNaN(num) || resolvedFromMap) ? await fetchPostBySlug(slug) : null;
  if (!post && !Number.isNaN(num) && !resolvedFromMap) {
    const res = await apiFetch(`/posts?per_page=1&page=${num}&orderby=date&order=desc&_embed=wp:term`);
    if (res.ok) {
      const posts = await res.json();
      if (posts.length) post = posts[0];
    }
  }
  return { post, slug };
}
