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
  return new Date(iso).toLocaleDateString("de-DE", {
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

const MAN_PAGES = {
  ls: [
    "NAME",
    "  ls – Inhalte auflisten",
    "",
    "SYNTAX",
    "  ls posts [asc|desc]",
    "  ls pages",
    "",
    "BESCHREIBUNG",
    "  Listet alle Blogposts oder Seiten auf.",
    "  Jeder Eintrag erhält eine Nummer, die mit read / r verwendet werden kann.",
    "",
    "  ls posts        – neueste zuerst (Standard oder config-order)",
    "  ls posts asc    – älteste zuerst",
    "  ls posts desc   – neueste zuerst",
    "  ls pages        – alle statischen Seiten",
    "",
    "PAGINIERUNG",
    "  Nach der Liste erscheint [m]ore – weitere Einträge laden.",
    "",
    "VERWANDT",
    "  read, config --order",
  ],
  read: [
    "NAME",
    "  read, r – Artikel lesen",
    "",
    "SYNTAX",
    "  read <n>",
    "  r <n>",
    "",
    "BESCHREIBUNG",
    "  Öffnet den Artikel mit der Nummer n aus der letzten ls-Liste.",
    "  Ohne vorherige ls-Liste wird Artikel n nach Datum (neueste zuerst) geladen.",
    "",
    "PAGINIERUNG",
    "  Langer Text wird seitenweise ausgegeben.",
    "  [m]ore zeigt die nächste Seite.",
    "",
    "LINKS",
    "  Enthaltene Links werden als Fußnoten nummeriert.",
    "  l <n> öffnet den n-ten Link im Browser.",
    "",
    "VERWANDT",
    "  ls, l, link",
  ],
  search: [
    "NAME",
    "  search – Posts nach Titel durchsuchen",
    "",
    "SYNTAX",
    "  search <suchbegriff>",
    "",
    "BESCHREIBUNG",
    "  Durchsucht Post-Titel über die WordPress REST API.",
    "  Gibt eine nummerierte Liste passender Beiträge aus.",
    "  Die Nummern können mit read / r verwendet werden.",
    "",
    "VERWANDT",
    "  grep, read",
  ],
  grep: [
    "NAME",
    "  grep – Volltext in Posts durchsuchen",
    "",
    "SYNTAX",
    "  grep <suchbegriff>",
    "",
    "BESCHREIBUNG",
    "  Durchsucht den Volltext aller Posts.",
    "  Für jeden Treffer werden Post-Titel und passende Textauszüge angezeigt.",
    "  Treffer im Text sind invers hervorgehoben.",
    "",
    "PAGINIERUNG",
    "  [m]ore zeigt weitere Treffer blockweise.",
    "",
    "VERWANDT",
    "  search",
  ],
  link: [
    "NAME",
    "  link, l – Link öffnen",
    "",
    "SYNTAX",
    "  link <n>",
    "  l <n>",
    "",
    "BESCHREIBUNG",
    "  Öffnet Link Nummer n im Browser (neuer Tab).",
    "  n bezieht sich auf die Fußnotenliste des aktuell gelesenen Artikels.",
    "  Außerhalb eines Artikels öffnet l <n> den n-ten Post aus der ls-Liste.",
    "",
    "VERWANDT",
    "  read",
  ],
  comments: [
    "NAME",
    "  comments – Kommentare anzeigen",
    "",
    "SYNTAX",
    "  comments <n>",
    "",
    "BESCHREIBUNG",
    "  Zeigt alle Kommentare zu Beitrag n an.",
    "  n ist die Nummer aus der letzten ls posts-Liste.",
    "",
    "VERWANDT",
    "  comment, c",
  ],
  comment: [
    "NAME",
    "  comment, c – Kommentar schreiben",
    "",
    "SYNTAX",
    "  comment <n> <Name>: <Text>",
    "  c <n> <Name>: <Text>",
    "",
    "BEISPIEL",
    "  c 1 Ada: Toller Artikel!",
    "",
    "BESCHREIBUNG",
    "  Schreibt einen Kommentar zu Beitrag n.",
    "  Name und Text werden durch einen Doppelpunkt getrennt.",
    "",
    "VERWANDT",
    "  comments",
  ],
  config: [
    "NAME",
    "  config – Einstellungen anzeigen und ändern",
    "",
    "SYNTAX",
    "  config",
    "  config --theme <a|b|c|d|e>",
    "  config --font <px>",
    "  config --posts <n>",
    "  config --order <asc|desc>",
    "",
    "BESCHREIBUNG",
    "  Ohne Argument: zeigt aktuelle Einstellungen.",
    "",
    "  --theme   Farbschema wechseln",
    "            a = VT100 Grün  b = GitHub Dark",
    "            c = Lila        d = Solarized Light",
    "            e = Amber (orange Phosphor)",
    "  --font    Schriftgröße in Pixeln (Standard: 22)",
    "  --posts   Posts pro Seite (Standard: 10)",
    "  --order   Sortierreihenfolge für ls posts",
    "            asc = älteste zuerst, desc = neueste zuerst",
    "",
    "PERSISTENZ",
    "  Einstellungen werden als Cookie gespeichert (1 Jahr).",
  ],
  history: [
    "NAME",
    "  history – Befehlshistorie anzeigen",
    "",
    "SYNTAX",
    "  history",
    "",
    "BESCHREIBUNG",
    "  Zeigt die zuletzt eingegebenen Befehle.",
    "  Mit ↑ / ↓ kann durch die Historie navigiert werden.",
  ],
  clear: [
    "NAME",
    "  clear – Terminal leeren",
    "",
    "SYNTAX",
    "  clear",
    "",
    "BESCHREIBUNG",
    "  Löscht alle bisherigen Ausgaben im Terminal.",
  ],
  help: [
    "NAME",
    "  help – Befehlsübersicht",
    "",
    "SYNTAX",
    "  help",
    "",
    "BESCHREIBUNG",
    "  Zeigt eine kurze Liste aller verfügbaren Befehle.",
    "  Für ausführliche Hilfe zu einem Befehl: man <befehl>",
  ],
  man: [
    "NAME",
    "  man – Handbuchseite anzeigen",
    "",
    "SYNTAX",
    "  man <befehl>",
    "",
    "BESCHREIBUNG",
    "  Zeigt eine ausführliche Beschreibung des angegebenen Befehls.",
    "",
    "BEISPIELE",
    "  man ls",
    "  man config",
    "  man grep",
  ],
};

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
async function fetchPosts(page = 1, pageSize = 10, order = 'desc') {
  const res = await apiFetch(`/posts?per_page=${pageSize}&page=${page}&orderby=date&order=${order}&_fields=id,slug,title,date,link`);
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
async function executeCommand(rawInput, pager, configRef, historyRef) {
  const parts = rawInput.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "help":
      return [
        "Verfügbare Befehle:",
        "",
        "  ls posts [asc|desc]  – alle Blogposts anzeigen",
        "  ls pages          – alle Seiten anzeigen",
        "  read <n>, r <n>   – Artikel nach Nummer lesen",
        "  link <n>, l <n>   – Post im Browser öffnen",
        "  search <…>        – Posts durchsuchen",
        "  grep <…>          – Volltext in Posts durchsuchen",
        "  comments <n>      – Kommentare zu Beitrag n anzeigen",
        "  comment <n> <…>, c <n> <…>   – Kommentar zu Beitrag n schreiben",
        "  history           – Befehlshistorie anzeigen",

        "  config            – Einstellungen anzeigen / ändern",
        "  clear             – Terminal leeren",
        "  help              – diese Hilfe",
        "  man <befehl>      – ausführliche Hilfe zu einem Befehl",
        "",
        "Tipp: Pfeil-Tasten ↑↓ für Befehlshistorie",
      ];

    case "m": {
      if (!pager.current) return ["Kein aktiver Pager."];
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
          return [...slice, "", `[m]ore  (${charsLeft} Zeichen verbleibend)`];
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
          return [...nextPage, `[m]ore  (${remaining} weitere Treffer)`];
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
          const t = parseInt(res.headers.get("X-WP-Total") || "0", 10);
          const posts = await res.json();
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? t);
          posts.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? t, slugMap, searchTerm } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(posts.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
            ...(hasMore ? ["", `[m]ore  (${(total ?? t) - shown} weitere)`] : [""]),
          ];
        }
        if (type === "posts") {
          const ord = pager.current.order || 'desc';
          const { posts, total: t } = await fetchPosts(nextPage, ps, ord);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? t);
          posts.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? t, slugMap, order: ord } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(posts.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
            ...(hasMore ? ["", "[m]ore"] : [""]),
          ];
        }
        if (type === "pages") {
          const { pages, total: t } = await fetchPages(nextPage, ps);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? t);
          pages.forEach((p, i) => { slugMap[offset + i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? t, slugMap } : null;
          const cols = getLineWidth();
          return [
            ...batchFmtLineEls(pages.map((p, i) => ({ n: offset + i + 1, title: stripHtml(p.title.rendered), date: '' })), cols),
            ...(hasMore ? ["", "[m]ore"] : [""]),
          ];
        }
      } catch (e) {
        return [`Fehler: ${e.message}`];
      }
      return [];
    }

    case "ls": {
      pager.current = null;
      const ps = configRef.current.posts;
      const cols = getLineWidth();
      const target = args[0]?.toLowerCase();
      if (!target || target === "posts") {
        const orderArg = args[1]?.toLowerCase();
        const order = (orderArg === 'asc' || orderArg === 'desc') ? orderArg : configRef.current.order;
        try {
          const { posts, total } = await fetchPosts(1, ps, order);
          if (!posts.length) return ["Keine Posts gefunden."];
          const hasMore = total > ps;
          const slugMap = {};
          posts.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = { type: "posts", page: 1, total, slugMap, order };
          return [
            `${total} Posts gefunden:`,
            "",
            ...batchFmtLineEls(posts.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
            ...(hasMore ? ["", "[m]ore"] : []),
          ];
        } catch (e) {
          return [`Fehler: ${e.message}`];
        }
      }
      if (target === "pages") {
        try {
          const { pages, total } = await fetchPages(1, ps);
          if (!pages.length) return ["Keine Seiten gefunden."];
          const hasMore = total > ps;
          const slugMap = {};
          pages.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
          pager.current = { type: "pages", page: 1, total, slugMap };
          return [
            `${total} Seiten:`,
            "",
            ...batchFmtLineEls(pages.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: '' })), cols),
            ...(hasMore ? ["", "[m]ore"] : []),
          ];
        } catch (e) {
          return [`Fehler: ${e.message}`];
        }
      }
      return [`ls: '${target}' nicht gefunden. Versuche: ls posts, ls pages`];
    }

    case "read":
    case "r": {
      let slug = args[0];
      if (!slug) return ["Verwendung: read <nummer> oder r <nummer>"];
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
        if (!post) return [`read: ${slug}: Kein Post gefunden`];
        const cols = getLineWidth();
        const { lines: bodyLines, footerLines, footnotes } = parseBodyWithLinks(post.content.rendered, cols);
        const titleLines = wordWrap(stripHtml(post.title.rendered), cols);
        const dateLine = `Veröffentlicht: ${formatDate(post.date)}`;
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
          more = ["", `[m]ore  (${charsLeft} Zeichen verbleibend)`];
        }
        return [...slice, ...more];
      } catch (e) {
        return [`Fehler: ${e.message}`];
      }
    }

    case "cat":
      return executeCommand('read ' + args.join(' '), pager, configRef, historyRef);

    case "l":
    case "link": {
      const n = parseInt(args[0], 10);
      if (isNaN(n)) return ["Verwendung: link <nummer>"];
      // Article footnotes take priority when reading an article
      const footnotes = pager.current?.footnotes;
      let url = footnotes && footnotes[n - 1] ? footnotes[n - 1] : null;
      if (!url) {
        const entry = pager.current?.slugMap?.[n];
        if (!entry) return [`Nummer ${n} nicht bekannt.`];
        url = typeof entry === "object" ? entry.url : null;
      }
      if (!url) return ["Keine URL verfügbar."];
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return [`Öffne: ${url}`];
    }

    case "search": {
      if (!args.length) return ["Verwendung: search <suchbegriff>"];
      const term = args.join(" ");
      const ps = configRef.current.posts;
      try {
        const res = await apiFetch(`/posts?search=${encodeURIComponent(term)}&per_page=${ps}&_fields=id,slug,title,date,link`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
        const posts = await res.json();
        if (!posts.length) return [`Keine Ergebnisse für "${term}".`];
        const hasMore = total > ps;
        const slugMap = {};
        posts.forEach((p, i) => { slugMap[i + 1] = { slug: p.slug, id: p.id, url: p.link }; });
        pager.current = hasMore ? { type: "search", page: 1, total, slugMap, searchTerm: term } : null;
        const cols = getLineWidth();
        return [
          `${total} Treffer für "${term}":`,
          "",
          ...batchFmtLineEls(posts.map((p, i) => ({ n: i + 1, title: stripHtml(p.title.rendered), date: formatDate(p.date) })), cols),
          ...(hasMore ? ["", `[m]ore  (${total - ps} weitere)`] : []),
        ];
      } catch (e) {
        return [`Fehler: ${e.message}`];
      }
    }

    case "grep": {
      if (!args.length) return ["Verwendung: grep <suchbegriff>"];
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
        if (!blocks.length) return [`Keine Treffer für "${term}".`];
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
        const header = [`${blocks.length} Treffer für "${term}":`, ""];
        if (remainingBlocks > 0) {
          return [...header, ...firstPage, `[m]ore  (${remainingBlocks} weitere Treffer)`];
        }
        pager.current = { type: "grep", blocks: [], shownBlocks: blocks.length, slugMap };
        return [...header, ...firstPage];
      } catch (e) {
        return [`Fehler: ${e.message}`];
      }
    }

    case "comments": {
      const n = parseInt(args[0], 10);
      if (isNaN(n)) return ["Verwendung: comments <nummer>"];
      const entry = pager.current?.slugMap?.[n];
      if (!entry) return [`Nummer ${n} nicht bekannt. Erst 'ls posts' ausführen.`];
      const id = typeof entry === "object" ? entry.id : null;
      if (!id) return ["Post-ID nicht verfügbar."];
      try {
        const list = await fetchComments(id);
        if (!list.length) return ["Keine Kommentare."];
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
        return [`Fehler: ${e.message}`];
      }
    }

    case "c":
    case "comment": {
      const n = parseInt(args[0], 10);
      if (isNaN(n) || args.length < 2) return ["Verwendung: comment <nummer> <text>"];
      const text = args.slice(1).join(" ").trim();
      if (!text) return ["Kein Kommentartext angegeben."];
      const entry = pager.current?.slugMap?.[n];
      if (!entry) return [`Nummer ${n} nicht bekannt. Erst 'ls posts' ausführen.`];
      const id = typeof entry === "object" ? entry.id : null;
      if (!id) return ["Post-ID nicht verfügbar."];
      try {
        await postComment(id, HX29.uid || "guest", text);
        return ["Kommentar gespeichert."];
      } catch (e) {
        return [`Fehler: ${e.message}`];
      }
    }

    case "history": {
      const h = historyRef.current;
      if (!h.length) return ["Keine Befehlshistorie."];
      return [
        "Befehlshistorie:",
        "",
        ...h.slice().reverse().map((cmd, i) => `  ${String(i + 1).padStart(3)}  ${cmd}`),
      ];
    }



    case "man": {
      const topic = args[0]?.toLowerCase();
      if (!topic) return [
        "Verwendung: man <befehl>",
        "Verfügbare Handbuchseiten: " + Object.keys(MAN_PAGES).join(", "),
      ];
      const aliases = { r: "read", l: "link", link: "link", c: "comment" };
      const resolved = aliases[topic] ?? topic;
      const page = MAN_PAGES[resolved];
      if (!page) return [
        `Keine Handbuchseite für '${topic}'.`,
        "Verfügbar: " + Object.keys(MAN_PAGES).join(", "),
      ];
      return page;
    }

    case "config": {
      const cfg = { ...configRef.current };
      if (!args.length) {
        return [
          "Aktuelle Konfiguration:",
          "",
          `  --font   ${cfg.font}px`,
          `  --posts  ${cfg.posts}`,
          `  --theme  ${cfg.theme}  (a=grün, b=dunkel, c=lila, d=hell, e=amber)`,
          `  --order  ${cfg.order}  (asc=älteste zuerst, desc=neueste zuerst)`,
          "",
          "Verwendung: config --font <px> --posts <n> --theme <a|b|c|d|e> --order <asc|desc>",
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
        return ["Konfiguration gespeichert."];
      }
      return ["Unbekannte Option. Versuche: config --font 22 --posts 10 --theme a --order desc"];
    }

    case "clear":
      return "__CLEAR__";

    case "":
      return [];

    default:
      return [`${cmd}: Befehl nicht gefunden. Tippe 'help' für Hilfe.`];
  }
}

function scrollTerminal() {
  const el = document.querySelector(".react-terminal");
  if (el) el.scrollTop = el.scrollHeight;
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
    const SYSTEM_USER = ['Lars', 'Admin', 'User', 'Johannes', 'Max'][Math.floor(Math.random() * 5)];

    const runIdleSequence = async () => {
      if (introPlayingRef.current || printingRef.current) {
        scheduleIdle();
        return;
      }
      idleActiveRef.current = true;

      const key = (suffix) => `idle-${Date.now()}-${suffix}`;
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      const append = (k, text) => setTerminalLines((prev) => [...prev, <TerminalOutput key={k}>{text}</TerminalOutput>]);
      const update = (k, text) => setTerminalLines((prev) => {
        const arr = [...prev];
        const i = arr.findIndex(l => l?.key === k);
        if (i !== -1) arr[i] = <TerminalOutput key={k}>{text}</TerminalOutput>;
        return arr;
      });

      append(key('l1'), '[!] TIMEOUT: Operator heartbeat lost.');
      await wait(400);
      append(key('l2'), '[!] Initiating automatic memory dump to prevent data loss.');
      await wait(700);
      append(key('l3'), '');
      await wait(300);

      const file1 = `C:/Users/${SYSTEM_USER}/Documents/Personal_Vault.rar`;
      append(key('l4'), `> Uploading '${file1}' -> Tor-Node #4`);
      await wait(300);

      // Animated progress bar
      const barKey = key('bar');
      let pct = 0;
      const FILLED = '▓';
      const PARTIAL = ['░', '▒'];
      const BAR_W = 45;

      const renderBar = (p, speed) => {
        const filled = Math.floor(p / 100 * BAR_W);
        const bar = FILLED.repeat(filled) + PARTIAL[Math.floor(Math.random() * 2)].repeat(BAR_W - filled);
        return `  [${bar}] ${p}% (${speed} MB/s)`;
      };

      append(barKey, renderBar(0, '0.0'));

      while (pct < 100 && idleActiveRef.current) {
        await wait(80 + Math.random() * 220);
        if (!idleActiveRef.current) break;
        pct = Math.min(100, pct + Math.floor(1 + Math.random() * 7));
        const speed = (8 + Math.random() * 12).toFixed(1);
        update(barKey, renderBar(pct, speed));
        scrollTerminal();
      }

      if (!idleActiveRef.current) {
        append(key('abort'), '');
        append(key('abort2'), '*** UPLINK ABORTED BY OPERATOR ***');
        scrollTerminal();
        scheduleIdle();
        return;
      }

      await wait(300);
      append(key('l5'), '');
      append(key('l6'), `> Next in queue: Chrome_Saved_Passwords.db (Target: Public Ledger)`);
      await wait(500);
      append(key('l7'), '');
      append(key('warn'), '*** PRESS ANY KEY TO ABORT UPLINK IMMEDIATELY ***');
      scrollTerminal();

      // Wait for keypress to abort
      await new Promise((res) => {
        const onKey = () => {
          document.removeEventListener('keydown', onKey, true);
          idleActiveRef.current = false;
          res();
        };
        document.addEventListener('keydown', onKey, true);
      });

      setTerminalLines((prev) => {
        const arr = [...prev];
        const i = arr.findIndex(l => l?.key === key('warn'));
        if (i !== -1) arr[i] = <TerminalOutput key={key('warn2')}>{'*** UPLINK ABORTED BY OPERATOR ***'}</TerminalOutput>;
        return arr;
      });
      append(key('done'), '');
      scrollTerminal();
      scheduleIdle();
    };

    const scheduleIdle = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(runIdleSequence, IDLE_MS);
    };

    scheduleIdle();

    const resetIdle = () => {
      if (idleActiveRef.current) return;
      scheduleIdle();
    };
    document.addEventListener('keydown', resetIdle, true);

    return () => {
      clearTimeout(idleTimerRef.current);
      document.removeEventListener('keydown', resetIdle, true);
    };
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
    const raw = input.trim();

    setTerminalLines((prev) => [
      ...prev,
      <TerminalInput key={`in-${Date.now()}`}>{raw}</TerminalInput>,
    ]);

    historyPosRef.current = -1;

    if (!raw) return;

    pushHistory(historyRef, raw);
    const result = await executeCommand(raw, pager, configRef, historyRef);

    if (result === "__CLEAR__") {
      setTerminalLines([]);
      return;
    }

    const charDelay = () => Math.random() < 0.03 ? 15 + Math.random() * 20 : 0;
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
            setTimeout(tick, charDelay());
          } else {
            resolve();
          }
        };
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{""}</TerminalOutput>]);
        setTimeout(tick, charDelay());
      });

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
      prompt={[
        `guest@aeon-gateway:~$`,
        `intruder@aeon-gateway:#`,
        `anon@apex-mainframe:#`,
        `operator@aeon-core:#`,
      ][visitStage - 1]}
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
