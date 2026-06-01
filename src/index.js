import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createRoot,
} from "@wordpress/element";
import Terminal, { ColorMode, TerminalOutput, TerminalInput } from "react-terminal-ui";
import { getSessionIntro } from "./intros";
import glitches from "./glitches.json";
import { t } from "./i18n/index.js";

// ─── Konfig ───────────────────────────────────────────────────────────────────
const HX29 = typeof window !== "undefined" && window.hx29 ? window.hx29 : {};
// Session resolved once at module load so stage and intro are always consistent
const _session = getSessionIntro(HX29.site_name || "my-terminal");
const WP_API = (HX29.rest_root || "/wp-json/").replace(/\/$/, "") + "/wp/v2";
const NONCE = HX29.nonce || "";
const SITE_NAME = HX29.site_name || "my-terminal";

function apiFetch(path) {
  return fetch(`${WP_API}${path}`, {
    headers: NONCE ? { "X-WP-Nonce": NONCE } : {},
    credentials: "same-origin",
  });
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString(t.locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stripHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html.replace(/<[^>]*>/g, "");
  return txt.value.trim();
}

// Parse HTML body into an array of lines (strings or React elements),
// with <a> links rendered as underlined text + footnote number.
// Returns { lines: [...], footerLines: [...], footnotes: [url, ...] }
function parseBodyWithLinks(html, width) {
  const footnotes = [];
  const urlIndex = {};

  // Step 1: replace <a> tags with "text «n»" in plain HTML so it word-wraps naturally
  const marked = html.replace(
    /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_, url, text) => {
      const t = stripHtml(text);
      if (!urlIndex[url]) {
        footnotes.push(url);
        urlIndex[url] = footnotes.length;
      }
      // Use rare Unicode brackets as markers that survive stripHtml & word-wrap
      return `«${t}»​${urlIndex[url]}‌`;
    }
  );

  // Step 2: strip remaining HTML tags, decode entities
  const plain = stripHtml(marked);
  const rawLines = plain.split("\n").filter(l => l.trim());
  const wrapped = wrapLines(rawLines, width);

  // Step 3: convert marker sequences to React elements with underline
  // Marker format: «text»​n‌  (U+00AB text U+00BB U+200B digit(s) U+200C)
  const markerRe = /«([^»]*)»​(\d+)‌/g;
  const lines = wrapped.map((line, li) => {
    if (!line.includes('«')) return line;
    const parts = [];
    let last = 0;
    let m;
    markerRe.lastIndex = 0;
    while ((m = markerRe.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      parts.push(
        <span key={`lnk-${li}-${m[2]}`} style={{textDecoration: "underline"}}>{m[1]}</span>
      );
      parts.push(` [${m[2]}]`);
      last = m.index + m[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <span key={`line-${li}`}>{parts}</span>;
  });

  const footerLines = footnotes.length
    ? (() => {
        const entries = footnotes.map((u, i) => `[${i + 1}] ${u}`);
        const sepW = Math.min(Math.max(...entries.map(e => e.length)), width);
        return ["", "-".repeat(sepW), ...entries];
      })()
    : [];

  return { lines, footerLines, footnotes };
}

// ─── User config (cookie) ─────────────────────────────────────────────────────
const CONFIG_DEFAULTS = { font: 22, posts: 10, theme: 'a', order: 'desc' };

const MAN_PAGES = t.man_pages;

function loadConfig() {
  const c = document.cookie.split('; ').find(r => r.startsWith('hx29_config='));
  if (!c) return { ...CONFIG_DEFAULTS };
  try { return { ...CONFIG_DEFAULTS, ...JSON.parse(decodeURIComponent(c.split('=').slice(1).join('='))) }; }
  catch { return { ...CONFIG_DEFAULTS }; }
}

function saveConfig(cfg) {
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `hx29_config=${encodeURIComponent(JSON.stringify(cfg))}; expires=${exp}; path=/; SameSite=Lax`;
}

function loadHistory() {
  const c = document.cookie.split('; ').find(r => r.startsWith('hx29_history='));
  if (!c) return [];
  try { return JSON.parse(decodeURIComponent(c.split('=').slice(1).join('='))); }
  catch { return []; }
}

function pushHistory(historyRef, cmd) {
  const h = historyRef.current;
  const idx = h.indexOf(cmd);
  if (idx !== -1) h.splice(idx, 1);
  h.unshift(cmd);
  if (h.length > 25) h.length = 25;
  const exp = new Date(Date.now() + 365 * 864e5).toUTCString();
  document.cookie = `hx29_history=${encodeURIComponent(JSON.stringify(h))}; expires=${exp}; path=/; SameSite=Lax`;
}

function applyConfig(cfg) {
  document.documentElement.style.setProperty('--fsize', cfg.font + 'px');
  if (cfg.theme && cfg.theme !== 'a') {
    document.documentElement.setAttribute('data-theme', cfg.theme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// ─── WordPress API ────────────────────────────────────────────────────────────
async function fetchPosts(page = 1, pageSize = 10, order = 'desc', filter = {}) {
  let qs = `/posts?per_page=${pageSize}&page=${page}&orderby=date&order=${order}&_fields=id,slug,title,date,link`;
  if (filter.category) qs += `&categories=${filter.category}`;
  if (filter.tag)      qs += `&tags=${filter.tag}`;
  const res = await apiFetch(qs);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const posts = await res.json();
  return { posts, total };
}

async function fetchPostBySlug(slug) {
  const res = await apiFetch(`/posts?slug=${encodeURIComponent(slug)}&_fields=title,date,content,author`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const posts = await res.json();
  if (!posts.length) return null;
  return posts[0];
}

async function fetchPages(page = 1, pageSize = 10) {
  const res = await apiFetch(`/pages?per_page=${pageSize}&page=${page}&_fields=id,slug,title,link`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const pages = await res.json();
  return { pages, total };
}

async function fetchCategories(page = 1, pageSize = 10) {
  const res = await apiFetch(`/categories?per_page=${pageSize}&page=${page}&_fields=id,slug,name,link&hide_empty=false`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const cats = await res.json();
  return { cats, total };
}

async function fetchTags(page = 1, pageSize = 10) {
  const res = await apiFetch(`/tags?per_page=${pageSize}&page=${page}&_fields=id,slug,name,link&hide_empty=false`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const tags = await res.json();
  return { tags, total };
}

async function fetchComments(postId, perPage = 20) {
  const res = await apiFetch(`/comments?post=${postId}&per_page=${perPage}&_fields=id,author_name,date,content`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postComment(postId, authorName, content) {
  const res = await fetch(`${WP_API}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(NONCE ? { "X-WP-Nonce": NONCE } : {}),
    },
    credentials: "same-origin",
    body: JSON.stringify({
      post: postId,
      author_name: authorName,
      author_email: `${authorName}@hx29.local`,
      content,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Formatting ───────────────────────────────────────────────────────────────
const LINE_W  = 72;
const DATE_W  = 12;
const NUM_W   = 4;
const TITLE_W = LINE_W - DATE_W - NUM_W - 2;

function fmtLineEl(n, title, date, cols) {
  return {
    __animText: fmtLine(n, title, date, cols) + "  ",
    __suffix: <span style={{textDecoration:"underline"}}>{`link [${n}]`}</span>,
  };
}

function fmtLine(n, title, date, cols) {
  const titleW = (cols || LINE_W) - DATE_W - NUM_W - 2;
  const num = String(n).padStart(NUM_W - 1) + ' ';
  const t = title.length > titleW ? title.slice(0, titleW - 1) + '…' : title;
  return num + t.padEnd(titleW) + '  ' + date;
}

function batchFmtLineEls(items, cols) {
  const maxLen = Math.max(...items.map(it => it.title.length));
  const cap = (cols || LINE_W) - NUM_W - DATE_W - 5;
  const titleW = Math.min(maxLen, cap) + 5;
  return items.map(({ n, title, date }) => {
    const num = String(n).padStart(NUM_W - 1) + ' ';
    const t = title.length > titleW - 5 ? title.slice(0, titleW - 6) + '…' : title;
    return num + t.padEnd(titleW) + date;
  });
}

function breakToken(token, width) {
  // Split at natural break chars (preserving delimiter), then hard-break remainder
  const parts = token.split(/([-/_])/);
  const segments = [];
  let current = '';
  for (const part of parts) {
    if ((current + part).length <= width) {
      current += part;
    } else {
      if (current) segments.push(current);
      current = part;
    }
  }
  if (current) segments.push(current);
  // Hard-break any segment still too long
  const result = [];
  for (const seg of segments) {
    let s = seg;
    while (s.length > width) {
      result.push(s.slice(0, width - 1) + '-');
      s = s.slice(width - 1);
    }
    if (s) result.push(s);
  }
  return result;
}

function wordWrap(text, width) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const tokens = word.length > width ? breakToken(word, width) : [word];
    for (const token of tokens) {
      if (!current) {
        current = token;
      } else if (current.length + 1 + token.length <= width) {
        current += ' ' + token;
      } else {
        lines.push(current);
        current = token;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function wrapLines(rawLines, width) {
  return rawLines.flatMap((l) => l.length <= width ? [l] : wordWrap(l, width));
}

// ─── Command-Handler ──────────────────────────────────────────────────────────
async function executeCommand(rawInput, pager, configRef, contextRef, historyRef, setCtxDisplay) {
  const parts = rawInput.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "help":
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
        t.help_history,
        t.help_config,
        t.help_clear,
        t.help_help,
        t.help_man,
        "",
        t.help_tip,
      ];

    case "m": {
      if (!pager.current) return [t.no_active_pager];
      const { type, page, total, slugMap } = pager.current;

      if (type === "article") {
        const { lines, offset, slugMap: articleSlugMap, footnotes: articleFootnotes, slug: articleSlug } = pager.current;
        const pageLines = getPageLines();
        const slice = lines.slice(offset, offset + pageLines);
        const nextOffset = offset + pageLines;
        const hasMore = nextOffset < lines.length;
        pager.current = hasMore
          ? { type: "article", lines, offset: nextOffset, slugMap: articleSlugMap, footnotes: articleFootnotes, slug: articleSlug }
          : { type: "article", lines: [], offset: 0, slugMap: articleSlugMap, footnotes: articleFootnotes, slug: articleSlug };
        if (hasMore) {
          const charsLeft = lines.slice(nextOffset).reduce((s, l) => s + (typeof l === "string" ? l.length : 0), 0);
          return [...slice, "", t.more_chars_left(charsLeft)];
        }
        return [...slice, ""];
      }

      if (type === "grep") {
        const { blocks, shownBlocks, slugMap: grepSlugMap } = pager.current;
        const pageLines = getPageLines();
        const nextPage = [];
        let newShown = shownBlocks;
        for (let i = shownBlocks; i < blocks.length; i++) {
          if (nextPage.length + blocks[i].length > pageLines) break;
          nextPage.push(...blocks[i]);
          newShown++;
        }
        const remaining = blocks.length - newShown;
        pager.current = { type: "grep", blocks, shownBlocks: newShown, slugMap: grepSlugMap };
        if (remaining > 0) {
          return [...nextPage, t.more_results_left(remaining)];
        }
        return [...nextPage, ""];
      }
      const ps = configRef.current.posts;
      const nextPage = page + 1;
      const offset = page * ps;
      try {
        if (type === "search") {
          const { searchTerm } = pager.current;
          const res = await apiFetch(`/posts?search=${encodeURIComponent(searchTerm)}&per_page=${ps}&page=${nextPage}&_fields=id,slug,title,date,link`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const fetchedTotal = parseInt(res.headers.get("X-WP-Total") || "0", 10);
          const posts = await res.json();
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? fetchedTotal);
          posts.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap, searchTerm } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(posts.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
            ...(hasMore ? ["", t.more_items_left((total ?? fetchedTotal) - shown)] : [""]),
          ];
        }
        if (type === "posts") {
          const ord = pager.current.order || 'desc';
          const fil = pager.current.filter || {};
          const { posts, total: fetchedTotal } = await fetchPosts(nextPage, ps, ord, fil);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? fetchedTotal);
          posts.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap, order: ord, filter: fil } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(posts.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
            ...(hasMore ? ["", t.more] : [""]),
          ];
        }
        if (type === "pages") {
          const { pages, total: fetchedTotal } = await fetchPages(nextPage, ps);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? fetchedTotal);
          pages.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(pages.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: '' })), cols),
            ...(hasMore ? ["", t.more] : [""]),
          ];
        }
        if (type === "categories") {
          const { cats, total: fetchedTotal } = await fetchCategories(nextPage, ps);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? fetchedTotal);
          cats.forEach((c, i) => { slugMap[offset + i + 1] = { slug: c.slug, id: c.id, url: c.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(cats.map((c, i) => ({ n: offset + i + 1, title: c.name, date: '' })), cols),
            ...(hasMore ? ["", t.more] : [""]),
          ];
        }
        if (type === "tags") {
          const { tags, total: fetchedTotal } = await fetchTags(nextPage, ps);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? fetchedTotal);
          tags.forEach((tg, i) => { slugMap[offset + i + 1] = { slug: tg.slug, id: tg.id, url: tg.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? fetchedTotal, slugMap } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(tags.map((tg, i) => ({ n: offset + i + 1, title: tg.name, date: '' })), cols),
            ...(hasMore ? ["", t.more] : [""]),
          ];
        }
      } catch (e) {
        return [t.error(e.message)];
      }
      return [];
    }

    case "ls": {
      pager.current = null;
      const ps = configRef.current.posts;
      const cols = getLineWidth();
      const target = args[0]?.toLowerCase();
      if (args.includes('--help')) {
        const key = target === 'cats' ? 'categories' : target;
        return t.ls_help[key] ?? t.man_pages.ls;
      }
      if (!target || target === "posts") {
        const orderArg = args[1]?.toLowerCase();
        const order = (orderArg === 'asc' || orderArg === 'desc') ? orderArg : configRef.current.order;
        // Build filter from active context
        const filter = {};
        const ctx = contextRef.current;
        if (ctx.type === 'category') filter.category = ctx.id;
        if (ctx.type === 'tag')      filter.tag      = ctx.id;
        // Extra tag-slug arg stacks on top of a category context
        const tagArg = args.slice(1).find(a => a !== 'asc' && a !== 'desc' && !a.startsWith('--'));
        if (tagArg) {
          try {
            const { tags: allTags } = await fetchTags(1, 100);
            const found = allTags.find(tg => tg.slug === tagArg || tg.name.toLowerCase() === tagArg.toLowerCase());
            if (found) filter.tag = found.id;
            else return [t.cd_not_found(tagArg)];
          } catch (e) { return [t.error(e.message)]; }
        }
        try {
          const { posts, total } = await fetchPosts(1, ps, order, filter);
          if (!posts.length) return [t.ls_no_posts];
          const hasMore = total > ps;
          const slugMap = {};
          posts.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = { type: "posts", page: 1, total, slugMap, order, filter };
          return [
            t.ls_posts_found(total),
            "",
            ...batchFmtLineEls(posts.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
            ...(hasMore ? ["", t.more] : []),
          ];
        } catch (e) {
          return [t.error(e.message)];
        }
      }
      if (target === "pages") {
        try {
          const { pages, total } = await fetchPages(1, ps);
          if (!pages.length) return [t.ls_no_pages];
          const hasMore = total > ps;
          const slugMap = {};
          pages.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = { type: "pages", page: 1, total, slugMap };
          return [
            t.ls_pages_found(total),
            "",
            ...batchFmtLineEls(pages.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: '' })), cols),
            ...(hasMore ? ["", t.more] : []),
          ];
        } catch (e) {
          return [t.error(e.message)];
        }
      }
      if (target === "categories" || target === "cats") {
        try {
          const { cats, total } = await fetchCategories(1, ps);
          if (!cats.length) return [t.ls_no_categories];
          const hasMore = total > ps;
          const slugMap = {};
          cats.forEach((c, i) => { slugMap[i + 1] = { slug: c.slug, id: c.id, url: c.link }; });
          pager.current = { type: "categories", page: 1, total, slugMap };
          return [
            t.ls_categories_found(total),
            "",
            ...batchFmtLineEls(cats.map((c, i) => ({ n: i + 1, title: c.name, date: '' })), cols),
            ...(hasMore ? ["", t.more] : []),
          ];
        } catch (e) {
          return [t.error(e.message)];
        }
      }
      if (target === "tags") {
        try {
          const { tags, total } = await fetchTags(1, ps);
          if (!tags.length) return [t.ls_no_tags];
          const hasMore = total > ps;
          const slugMap = {};
          tags.forEach((tg, i) => { slugMap[i + 1] = { slug: tg.slug, id: tg.id, url: tg.link }; });
          pager.current = { type: "tags", page: 1, total, slugMap };
          return [
            t.ls_tags_found(total),
            "",
            ...batchFmtLineEls(tags.map((tg, i) => ({ n: i + 1, title: tg.name, date: '' })), cols),
            ...(hasMore ? ["", t.more] : []),
          ];
        } catch (e) {
          return [t.error(e.message)];
        }
      }
      return [t.ls_not_found(target)];
    }

    case "read":
    case "r": {
      let slug = args[0];
      if (!slug) return [t.read_usage];
      const num = parseInt(slug, 10);
      const savedSlugMap = pager.current?.slugMap || {};
      if (!isNaN(num) && savedSlugMap[num]) {
        const entry = savedSlugMap[num];
        slug = typeof entry === "object" ? entry.slug : entry;
      }
      try {
        let post = isNaN(num) ? await fetchPostBySlug(slug) : null;
        if (!post && !isNaN(num)) {
          // No slugMap entry — fetch by ordinal position
          const res = await apiFetch(`/posts?per_page=1&page=${num}&orderby=date&order=desc&_fields=id,slug,title,date,content,link`);
          if (res.ok) {
            const posts = await res.json();
            if (posts.length) post = posts[0];
          }
        }
        if (!post && isNaN(num)) post = await fetchPostBySlug(slug);
        if (!post) return [t.read_not_found(slug)];
        const cols = getLineWidth();
        const { lines: bodyLines, footerLines, footnotes } = parseBodyWithLinks(post.content.rendered, cols);
        const titleLines = wordWrap(stripHtml(post.title.rendered), cols);
        const dateLine = t.read_published(formatDate(post.date));
        const headerW = Math.max(...titleLines.map(l => l.length), dateLine.length);
        const allLines = [
          "-".repeat(headerW),
          ...titleLines,
          dateLine,
          "-".repeat(headerW),
          "",
          ...bodyLines,
          ...footerLines,
          "",
        ];
        const pageLines = getPageLines();
        const hasMore = allLines.length > pageLines;
        const slice = allLines.slice(0, pageLines);
        pager.current = hasMore
          ? { type: "article", lines: allLines, offset: pageLines, slugMap: savedSlugMap, footnotes, slug }
          : { type: "article", lines: [], offset: 0, slugMap: savedSlugMap, footnotes, slug };
        let more = [];
        if (hasMore) {
          const charsLeft = allLines.slice(pageLines).reduce((s, l) => s + l.length, 0);
          more = ["", t.more_chars_left(charsLeft)];
        }
        return [...slice, ...more];
      } catch (e) {
        return [t.error(e.message)];
      }
    }

    case "cat":
      return executeCommand('read ' + args.join(' '), pager, configRef, contextRef, historyRef, setCtxDisplay);

    case "l":
    case "link": {
      const n = parseInt(args[0], 10);
      if (isNaN(n)) return [t.link_usage];
      // Article footnotes take priority when reading an article
      const footnotes = pager.current?.footnotes;
      let url = footnotes && footnotes[n - 1] ? footnotes[n - 1] : null;
      if (!url) {
        const entry = pager.current?.slugMap?.[n];
        if (!entry) return [t.link_unknown_num(n)];
        url = typeof entry === "object" ? entry.url : null;
      }
      if (!url) return [t.link_no_url];
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return [t.link_opening(url)];
    }

    case "search": {
      if (!args.length) return [t.search_usage];
      const term = args.join(" ");
      const ps = configRef.current.posts;
      try {
        const res = await apiFetch(`/posts?search=${encodeURIComponent(term)}&per_page=${ps}&_fields=id,slug,title,date,link`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
        const posts = await res.json();
        if (!posts.length) return [t.search_no_results(term)];
        const hasMore = total > ps;
        const slugMap = {};
        posts.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
        pager.current = hasMore ? { type: "search", page: 1, total, slugMap, searchTerm: term } : null;
        const cols = getLineWidth();
        return [
          t.search_found(total, term),
          "",
          ...batchFmtLineEls(posts.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
          ...(hasMore ? ["", t.more_items_left(total - ps)] : []),
        ];
      } catch (e) {
        return [t.error(e.message)];
      }
    }

    case "grep": {
      if (!args.length) return [t.grep_usage];
      const term = args.join(" ");
      const termLower = term.toLowerCase();
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const res = await apiFetch(`/posts?per_page=100&_fields=id,slug,title,date,content`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
        const posts = await res.json();
        const cols = getLineWidth();
        const slugMap = {};
        // Build per-post blocks: each block = [titleLine, ...matchLines, ""]
        const blocks = [];
        posts.forEach((p) => {
          const body = stripHtml(p.content.rendered);
          const lines = body.split("\n").filter(l => l.trim());
          const matchLines = lines
            .filter(line => line.toLowerCase().includes(termLower))
            .map(line => {
              const raw = line.slice(0, cols - 4);
              const re = new RegExp(`(${escaped})`, "gi");
              const parts = raw.split(re);
              return (
                <span key={raw}>
                  {"    "}
                  {parts.map((part, i) =>
                    i % 2 === 1
                      ? <span key={i} style={{background:"var(--fg)",color:"var(--bg)"}}>{part}</span>
                      : part
                  )}
                </span>
              );
            });
          if (!matchLines.length) return;
          const n = blocks.length + 1;
          slugMap[n] = { slug: p.slug, id: p.id };
          blocks.push([
            fmtLine(n, stripHtml(p.title.rendered), formatDate(p.date), cols),
            ...matchLines,
            "",
          ]);
        });
        if (!blocks.length) return [t.grep_no_results(term)];
        const pageLines = getPageLines();
        // Fit as many whole blocks as possible into first page
        const firstPage = [];
        let shownBlocks = 0;
        for (const block of blocks) {
          if (firstPage.length + block.length > pageLines) break;
          firstPage.push(...block);
          shownBlocks++;
        }
        const remainingBlocks = blocks.length - shownBlocks;
        pager.current = {
          type: "grep",
          blocks,
          shownBlocks,
          slugMap,
        };
        const header = [t.grep_found(blocks.length, term), ""];
        if (remainingBlocks > 0) {
          return [...header, ...firstPage, t.more_results_left(remainingBlocks)];
        }
        pager.current = { type: "grep", blocks: [], shownBlocks: blocks.length, slugMap };
        return [...header, ...firstPage];
      } catch (e) {
        return [t.error(e.message)];
      }
    }

    case "comments": {
      const n = parseInt(args[0], 10);
      if (isNaN(n)) return [t.comments_usage];
      const entry = pager.current?.slugMap?.[n];
      if (!entry) return [t.comments_unknown_num(n)];
      const id = typeof entry === "object" ? entry.id : null;
      if (!id) return [t.comments_no_id];
      try {
        const list = await fetchComments(id);
        if (!list.length) return [t.comments_none];
        const cols = getLineWidth();
        const out = [""];
        list.forEach((c, i) => {
          const name = (c.author_name || "anonym").padEnd(16);
          const date = formatDate(c.date);
          out.push(`[${i + 1}] ${name} ${date}`);
          wrapLines(
            stripHtml(c.content.rendered).split("\n").filter(l => l.trim()),
            cols - 4
          ).forEach(l => out.push("    " + l));
          out.push("");
        });
        return out;
      } catch (e) {
        return [t.error(e.message)];
      }
    }

    case "c":
    case "comment": {
      const n = parseInt(args[0], 10);
      if (isNaN(n) || args.length < 2) return [t.comment_usage];
      const text = args.slice(1).join(" ").trim();
      if (!text) return [t.comment_no_text];
      const entry = pager.current?.slugMap?.[n];
      if (!entry) return [t.comment_unknown_num(n)];
      const id = typeof entry === "object" ? entry.id : null;
      if (!id) return [t.comment_no_id];
      try {
        await postComment(id, HX29.uid || "guest", text);
        return [t.comment_saved];
      } catch (e) {
        return [t.error(e.message)];
      }
    }

    case "history": {
      const h = historyRef.current;
      if (!h.length) return [t.history_empty];
      return [
        t.history_title,
        "",
        ...h.slice().reverse().map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`),
      ];
    }



    case "man": {
      const topic = args[0]?.toLowerCase();
      if (!topic) return [
        t.man_usage,
        t.man_available + Object.keys(MAN_PAGES).join(", "),
      ];
      const aliases = { r: "read", l: "link", link: "link", c: "comment" };
      const resolved = aliases[topic] ?? topic;
      const page = MAN_PAGES[resolved];
      if (!page) return [
        t.man_not_found(topic),
        t.man_available_list + Object.keys(MAN_PAGES).join(", "),
      ];
      return page;
    }

    case "config": {
      const cfg = { ...configRef.current };
      if (!args.length) {
        return [
          t.config_current_title,
          "",
          t.config_font(cfg.font),
          t.config_posts(cfg.posts),
          t.config_theme(cfg.theme),
          t.config_order(cfg.order),
          "",
          t.config_usage,
        ];
      }
      let changed = false;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--font' && args[i + 1]) {
          const v = parseInt(args[++i], 10);
          if (v > 0) { cfg.font = v; changed = true; }
        } else if (args[i] === '--posts' && args[i + 1]) {
          const v = parseInt(args[++i], 10);
          if (v > 0) { cfg.posts = v; changed = true; }
        } else if (args[i] === '--theme' && args[i + 1]) {
          const v = args[++i];
          if (['a', 'b', 'c', 'd', 'e'].includes(v)) { cfg.theme = v; changed = true; }
        } else if (args[i] === '--order' && args[i + 1]) {
          const v = args[++i];
          if (['asc', 'desc'].includes(v)) { cfg.order = v; changed = true; }
        }
      }
      if (changed) {
        configRef.current = cfg;
        saveConfig(cfg);
        applyConfig(cfg);
        return [t.config_saved];
      }
      return [t.config_unknown];
    }

    case "cd": {
      const target = args[0]?.toLowerCase();
      // cd with no arg — show current context
      if (!target) {
        const ctx = contextRef.current;
        if (!ctx.type) return [t.cd_no_context];
        return [t.cd_current(ctx.name, ctx.type)];
      }
      // cd .. or cd / — return to root
      if (target === '..' || target === '/') {
        contextRef.current = { type: null, id: null, name: null };
        setCtxDisplay(null);
        return [t.cd_back_to_root];
      }
      // resolve slug/name against categories then tags
      try {
        const { cats } = await fetchCategories(1, 100);
        const cat = cats.find(c => c.slug === target || c.name.toLowerCase() === target.toLowerCase());
        if (cat) {
          contextRef.current = { type: 'category', id: cat.id, name: cat.name };
          setCtxDisplay({ type: 'category', name: cat.slug });
          return [t.cd_now_in(cat.name, 'category'), t.cd_hint_combine];
        }
        const { tags } = await fetchTags(1, 100);
        const tag = tags.find(tg => tg.slug === target || tg.name.toLowerCase() === target.toLowerCase());
        if (tag) {
          contextRef.current = { type: 'tag', id: tag.id, name: tag.name };
          setCtxDisplay({ type: 'tag', name: tag.slug });
          return [t.cd_now_in(tag.name, 'tag')];
        }
        return [t.cd_not_found(target)];
      } catch (e) {
        return [t.error(e.message)];
      }
    }

    case "clear":
      return "__CLEAR__";

    case "":
      return [];

    default:
      return [t.unknown_command(cmd)];
  }
}

function scrollTerminal() {
  const el = document.querySelector(".react-terminal");
  if (!el) return;
  const wrapper = document.querySelector(".react-terminal-wrapper");
  if (wrapper) {
    wrapper.style.transition = "opacity 50ms linear";
    wrapper.style.opacity = "0.94";
    setTimeout(() => {
      wrapper.style.transition = "opacity 120ms ease-out";
      wrapper.style.opacity = "1";
    }, 50);
  }
  el.scrollTop = el.scrollHeight;
}

function maybeSyncTear() {
  if (Math.random() >= 0.03) return;
  const lines = document.querySelectorAll(".react-terminal .react-terminal-line");
  if (!lines.length) return;
  const target = lines[lines.length - 1];
  const duration = 40 + Math.random() * 40;
  target.classList.add("sync-tear");
  target.style.animationDuration = `${duration}ms`;
  setTimeout(() => {
    target.classList.remove("sync-tear");
    target.style.animationDuration = "";
  }, duration + 10);
}

function getPageLines() {
  const el = document.querySelector(".react-terminal");
  if (!el) return 20;
  const lineH = parseFloat(getComputedStyle(el).fontSize) * 1.4;
  return Math.max(5, Math.floor(el.clientHeight / lineH) - 3);
}

function getLineWidth() {
  const el = document.querySelector(".react-terminal");
  if (!el) return LINE_W;
  const span = document.createElement("span");
  span.style.cssText = "position:absolute;visibility:hidden;font-family:var(--font,monospace);font-size:var(--fsize,22px);white-space:pre";
  span.textContent = "M";
  el.appendChild(span);
  const charW = span.getBoundingClientRect().width;
  el.removeChild(span);
  return charW > 0 ? Math.floor(el.clientWidth / charW) : LINE_W;
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
function WPTerminal() {
  const [terminalLines, setTerminalLines] = useState([]);
  const [printing, setPrinting] = useState(false);
  const visitStage = _session.stage;
  const pager = useRef(null);
  const configRef = useRef(loadConfig());
  const contextRef = useRef({ type: null, id: null, name: null });
  const [ctxDisplay, setCtxDisplay] = useState(null);
  const historyRef = useRef(loadHistory());
  const historyPosRef = useRef(-1);
  const timerRef = useRef(null);
  const introPlayingRef = useRef(true);
  const printingRef = useRef(false);
  const idleTimerRef = useRef(null);
  const idleActiveRef = useRef(false);
  const [introPlaying, setIntroPlaying] = useState(true);

  useEffect(() => { applyConfig(configRef.current); }, []);

  useEffect(() => {
    const INTRO = _session.items;
    let cancelled = false;
    const charDelay = () => Math.random() < 0.03 ? 15 + Math.random() * 20 : 0;

    const animateLine = (key, text) => new Promise((resolve) => {
      let charIndex = 0;
      const CHUNK = 4; // chars per tick
      const tick = () => {
        if (cancelled) { resolve(); return; }
        for (let c = 0; c < CHUNK && charIndex < text.length; c++) {
          charIndex++;
          while (charIndex < text.length && text[charIndex] === ' ') charIndex++;
        }
        const partial = text.slice(0, charIndex);
        const isDone = charIndex >= text.length;
        setTerminalLines((prev) => {
          const arr = [...prev];
          const last = arr[arr.length - 1];
          if (last?.key === key) arr[arr.length - 1] = <TerminalOutput key={key}>{partial}</TerminalOutput>;
          else arr.push(<TerminalOutput key={key}>{partial}</TerminalOutput>);
          return arr;
        });
        if (!isDone) setTimeout(tick, 0);
        else resolve();
      };
      setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{""}</TerminalOutput>]);
      setTimeout(tick, 0);
    });

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    (async () => {
      for (let i = 0; i < INTRO.length; i++) {
        if (cancelled) break;
        const item = INTRO[i];
        await wait(item.delay);
        if (cancelled) break;

        if (item.__phases) {
          const key = `intro-${i}`;
          for (const { text: pt, hold } of item.__phases) {
            if (cancelled) break;
            // first phase: animate char by char; subsequent phases: overwrite instantly
            if (pt === item.__phases[0].text) {
              await animateLine(key, pt);
            } else {
              setTerminalLines((prev) => {
                const arr = [...prev];
                const last = arr[arr.length - 1];
                if (last?.key === key) arr[arr.length - 1] = <TerminalOutput key={key}>{pt}</TerminalOutput>;
                else arr.push(<TerminalOutput key={key}>{pt}</TerminalOutput>);
                return arr;
              });
            }
            if (hold > 0) await wait(hold);
          }
        } else if (item.text !== null && item.text !== undefined) {
          if (item.text === '' || item.text === ' ') {
            setTerminalLines((prev) => [...prev, <TerminalOutput key={`intro-${i}`}>{' '}</TerminalOutput>]);
          } else {
            await animateLine(`intro-${i}`, item.text);
          }
        }
      }
      if (!cancelled) {
        setIntroPlaying(false);
        introPlayingRef.current = false;
        setTimeout(() => document.querySelector('.terminal-hidden-input')?.focus(), 50);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const runHumBar = () => {
      document.documentElement.classList.add('hum-bar-active');
      setTimeout(() => document.documentElement.classList.remove('hum-bar-active'), 3100);
      setTimeout(runHumBar, 60000 + Math.random() * 60000);
    };
    const t = setTimeout(runHumBar, 60000 + Math.random() * 60000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const schedule = () => {
      const delay = 90000 + Math.random() * 60000;
      return setTimeout(() => {
        if (!introPlayingRef.current && !printingRef.current) {
          const msg = glitches[Math.floor(Math.random() * glitches.length)];
          setTerminalLines((prev) => [...prev, <TerminalOutput key={`glitch-${Date.now()}`}>{msg}</TerminalOutput>]);
          setTimeout(scrollTerminal, 50);
        }
        timerRef.current = schedule();
      }, delay);
    };
    timerRef.current = schedule();
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const IDLE_MS = 5 * 60 * 1000;
    const SEQUENCE_LOADERS = [
      () => import(/* webpackChunkName: "idle-neon"      */ "./idle/neonFlicker").then(m => m.default),
      () => import(/* webpackChunkName: "idle-vortex"    */ "./idle/vortex").then(m => m.default),
      () => import(/* webpackChunkName: "idle-melt"      */ "./idle/bufferMelt").then(m => m.default),
      () => import(/* webpackChunkName: "idle-cyberdeck" */ "./idle/cyberdeck").then(m => m.default),
      () => import(/* webpackChunkName: "idle-overheat"  */ "./idle/overheat").then(m => m.default),
      () => import(/* webpackChunkName: "idle-gridglitch"*/ "./idle/gridGlitch").then(m => m.default),
      () => import(/* webpackChunkName: "idle-synapse"   */ "./idle/synapseDesync").then(m => m.default),
      () => import(/* webpackChunkName: "idle-memleak"   */ "./idle/memoryLeak").then(m => m.default),
    ];
    let lastSeq = -1;

    const runIdleSequence = async () => {
      if (introPlayingRef.current || printingRef.current) {
        scheduleIdle();
        return;
      }
      idleActiveRef.current = true;

      let pick;
      do { pick = Math.floor(Math.random() * SEQUENCE_LOADERS.length); } while (pick === lastSeq && SEQUENCE_LOADERS.length > 1);
      lastSeq = pick;

      const ts = Date.now();
      const key = (suffix) => `idle-${ts}-${suffix}`;
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const append = (k, text) => setTerminalLines((prev) => [...prev, <TerminalOutput key={k}>{text}</TerminalOutput>]);
      const update = (k, text) => setTerminalLines((prev) => {
        const arr = [...prev];
        const i = arr.findIndex(l => l?.key === k);
        if (i !== -1) arr[i] = <TerminalOutput key={k}>{text}</TerminalOutput>;
        return arr;
      });

      const seq = await SEQUENCE_LOADERS[pick]();
      await seq({ key, wait, append, update, scrollTerminal, idleActiveRef });
      // no reschedule — timer only restarts after user input (handleInput)
    };

    const scheduleIdle = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(runIdleSequence, IDLE_MS);
    };

    // expose scheduleIdle so handleInput can restart the timer
    idleTimerRef.schedule = scheduleIdle;
    scheduleIdle();

    return () => { clearTimeout(idleTimerRef.current); };
  }, []);

  useEffect(() => {
    scrollTerminal();
  }, [terminalLines]);

  // Arrow-key history navigation — intercept before react-terminal-ui handles it
  useEffect(() => {
    const setNativeValue = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onKeyDown = (e) => {
      if (printing || introPlaying) return;
      const el = e.currentTarget;

      // Key-bounce simulation: 100% chance (testing) a printable key double-fires
      if (e.key.length === 1 && Math.random() < 0.005) {
        setTimeout(() => {
          const before = el.value;
          const pos = el.selectionStart ?? before.length;
          const doubled = before.slice(0, pos) + e.key + before.slice(pos);
          setNativeValue(el, doubled);
          // Show the bounce notice briefly
          const notice = document.createElement('div');
          notice.textContent = '[KEY_BOUNCE RECALIBRATED]';
          notice.style.cssText = 'position:fixed;bottom:12px;right:16px;color:var(--dim);font-family:var(--font);font-size:12px;pointer-events:none;z-index:9999;opacity:1;transition:opacity 0.3s';
          document.body.appendChild(notice);
          // Auto-correct: remove the extra char after 120ms
          setTimeout(() => {
            const cur = el.value;
            const p = el.selectionStart ?? cur.length;
            if (p > 0) setNativeValue(el, cur.slice(0, p - 1) + cur.slice(p));
            notice.style.opacity = '0';
            setTimeout(() => notice.remove(), 320);
          }, 120);
        }, 0);
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const h = historyRef.current;
        if (!h.length) return;
        const next = Math.min(historyPosRef.current + 1, h.length - 1);
        historyPosRef.current = next;
        setNativeValue(el, h[next]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const h = historyRef.current;
        const next = historyPosRef.current - 1;
        historyPosRef.current = Math.max(next, -1);
        setNativeValue(el, next < 0 ? '' : h[next]);
      }
    };

    const attach = () => {
      const el = document.querySelector('.terminal-hidden-input');
      if (el) {
        el.addEventListener('keydown', onKeyDown, true);
        return el;
      }
      return null;
    };

    // The input may not exist immediately on mount — retry briefly
    let el = attach();
    let timer;
    if (!el) {
      timer = setTimeout(() => { el = attach(); }, 300);
    }

    return () => {
      clearTimeout(timer);
      if (el) el.removeEventListener('keydown', onKeyDown, true);
    };
  }, [printing]);

  const handleInput = useCallback(async (input) => {
    if (introPlayingRef.current) return;
    idleActiveRef.current = false;
    idleTimerRef.schedule?.();
    const raw = input.trim();

    setTerminalLines((prev) => [
      ...prev,
      <TerminalInput key={`in-${Date.now()}`}>{raw}</TerminalInput>,
    ]);

    historyPosRef.current = -1;

    if (!raw) return;

    pushHistory(historyRef, raw);
    const result = await executeCommand(raw, pager, configRef, contextRef, historyRef, setCtxDisplay);

    if (result === "__CLEAR__") {
      setTerminalLines([]);
      return;
    }

    // 1200 baud: ~8ms/char baseline; 4% chance of a 200–500ms line-noise freeze mid-word
    const charDelay = (ch, nextCh) => {
      const base = 6 + Math.random() * 4;
      const midWord = ch !== ' ' && nextCh && nextCh !== ' ';
      if (midWord && Math.random() < 0.02) return base + 100 + Math.random() * 150;
      return base;
    };
    const LINE_DELAY = 8;

    setPrinting(true);
    printingRef.current = true;
    for (let i = 0; i < result.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, LINE_DELAY));
      const text = result[i];
      const key = `out-${Date.now()}-${i}`;

      if (!text) {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{" "}</TerminalOutput>]);
        continue;
      }

      // Phased glitch line — overwrites same line through multiple phases
      if (text?.__phases) {
        await new Promise((resolve) => {
          let p = 0;
          const step = () => {
            const { text: t, hold } = text.__phases[p];
            setTerminalLines((prev) => {
              const arr = [...prev];
              const last = arr[arr.length - 1];
              if (last?.key === key) arr[arr.length - 1] = <TerminalOutput key={key}>{t}</TerminalOutput>;
              else arr.push(<TerminalOutput key={key}>{t}</TerminalOutput>);
              return arr;
            });
            p++;
            if (p < text.__phases.length) setTimeout(step, hold);
            else resolve();
          };
          step();
        });
        continue;
      }

      // React elements (e.g. highlighted grep lines) — render instantly
      if (typeof text !== "string" && !text?.__animText) {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{text}</TerminalOutput>]);
        continue;
      }

      // Animated text with optional React suffix (e.g. fmtLineEl underlined link)
      const animText = text?.__animText ?? text;
      const suffix = text?.__suffix ?? null;

      await new Promise((resolve) => {
        let charIndex = 0;
        const tick = () => {
          charIndex++;
          // skip over whitespace runs instantly
          while (charIndex < animText.length && animText[charIndex] === ' ') charIndex++;
          const partial = animText.slice(0, charIndex);
          const isDone = charIndex >= animText.length;
          setTerminalLines((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.key === key) {
              next[next.length - 1] = <TerminalOutput key={key}>{isDone && suffix ? <>{partial}{suffix}</> : partial}</TerminalOutput>;
            } else {
              next.push(<TerminalOutput key={key}>{partial}</TerminalOutput>);
            }
            return next;
          });
          if (charIndex < animText.length) {
            setTimeout(tick, charDelay(animText[charIndex - 1], animText[charIndex]));
          } else {
            resolve();
          }
        };
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{""}</TerminalOutput>]);
        setTimeout(tick, charDelay());
      });

      maybeSyncTear();

      // 1% chance of a glitch line after each output line
      if (Math.random() < 0.01) {
        const gkey = `glitch-inline-${Date.now()}`;
        const gmsg = glitches[Math.floor(Math.random() * glitches.length)];
        setTerminalLines((prev) => [...prev, <TerminalOutput key={gkey}>{gmsg}</TerminalOutput>]);
        await new Promise((resolve) => setTimeout(resolve, 80));
        scrollTerminal();
      }
    }
    setPrinting(false);
    printingRef.current = false;
  }, []);

  return (
    <Terminal
      name=""
      prompt={(() => {
        const base = [
          `guest@aeon-gateway:~$`,
          `intruder@aeon-gateway:#`,
          `anon@apex-mainframe:#`,
          `operator@aeon-core:#`,
        ][visitStage - 1];
        return ctxDisplay ? base.replace('~', `~/${ctxDisplay.name}`) : base;
      })()}
      colorMode={ColorMode.Dark}
      height="100%"
      onInput={printing || introPlaying ? null : handleInput}
      TopButtonsPanel={() => null}
    >
      {terminalLines}
    </Terminal>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("hx29-root");
  if (el) createRoot(el).render(<WPTerminal />);
});
