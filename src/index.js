import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createRoot,
} from "@wordpress/element";
import Terminal, { ColorMode, TerminalOutput, TerminalInput } from "react-terminal-ui";

// ─── Konfig ───────────────────────────────────────────────────────────────────
const HX29 = typeof window !== "undefined" && window.hx29 ? window.hx29 : {};
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
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ─── User config (cookie) ─────────────────────────────────────────────────────
const CONFIG_DEFAULTS = { font: 22, posts: 10 };

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
}

// ─── WordPress API ────────────────────────────────────────────────────────────
async function fetchPosts(page = 1, pageSize = 10) {
  const res = await apiFetch(`/posts?per_page=${pageSize}&page=${page}&_fields=id,slug,title,date`);
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
  const res = await apiFetch(`/pages?per_page=${pageSize}&page=${page}&_fields=slug,title`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = parseInt(res.headers.get("X-WP-Total") || "0", 10);
  const pages = await res.json();
  return { pages, total };
}

// ─── Formatting ───────────────────────────────────────────────────────────────
const LINE_W  = 72;
const DATE_W  = 12;
const NUM_W   = 4;
const TITLE_W = LINE_W - DATE_W - NUM_W - 2;

function fmtLine(n, title, date, cols) {
  const titleW = (cols || LINE_W) - DATE_W - NUM_W - 2;
  const num = String(n).padStart(NUM_W - 1) + ' ';
  const t = title.length > titleW ? title.slice(0, titleW - 1) + '…' : title;
  return num + t.padEnd(titleW) + '  ' + date;
}

function wordWrap(text, width) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
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
        "  ls posts          – alle Blogposts anzeigen",
        "  ls pages          – alle Seiten anzeigen",
        "  read <n>, r <n>   – Artikel nach Nummer lesen",
        "  cat <slug>        – Post/Seite öffnen",
        "  about             – über dieses Terminal",
        "  history           – Befehlshistorie anzeigen",
        "  status            – Systemstatus prüfen",
        "  config            – Einstellungen anzeigen / ändern",
        "  clear             – Terminal leeren",
        "  help              – diese Hilfe",
        "",
        "Tipp: Pfeil-Tasten ↑↓ für Befehlshistorie",
      ];

    case "m": {
      if (!pager.current) return ["Kein aktiver Pager."];
      const { type, page, total, slugMap } = pager.current;

      if (type === "article") {
        const { lines, offset, slugMap: articleSlugMap } = pager.current;
        const pageLines = getPageLines();
        const slice = lines.slice(offset, offset + pageLines);
        const nextOffset = offset + pageLines;
        const hasMore = nextOffset < lines.length;
        pager.current = hasMore
          ? { type: "article", lines, offset: nextOffset, slugMap: articleSlugMap }
          : { type: "article", lines: [], offset: 0, slugMap: articleSlugMap };
        let more = [""];
        if (hasMore) {
          const charsLeft = lines.slice(nextOffset).reduce((s, l) => s + l.length, 0);
          more = ["", `[m]ore  (${charsLeft} Zeichen verbleibend)`];
        }
        return [...slice, ...more];
      }
      const ps = configRef.current.posts;
      const nextPage = page + 1;
      const offset = page * ps;
      try {
        if (type === "posts") {
          const { posts, total: t } = await fetchPosts(nextPage, ps);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? t);
          posts.forEach((p, i) => { slugMap[offset + i + 1] = p.slug; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? t, slugMap } : null;
          const cols = getLineWidth();
          return [
            ...posts.map((p, i) => fmtLine(offset + i + 1, stripHtml(p.title.rendered), formatDate(p.date), cols)),
            ...(hasMore ? ["", "[m]ore"] : [""]),
          ];
        }
        if (type === "pages") {
          const { pages, total: t } = await fetchPages(nextPage, ps);
          const shown = nextPage * ps;
          const hasMore = shown < (total ?? t);
          pages.forEach((p, i) => { slugMap[offset + i + 1] = p.slug; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? t, slugMap } : null;
          const cols = getLineWidth();
          return [
            ...pages.map((p, i) => fmtLine(offset + i + 1, stripHtml(p.title.rendered), '', cols)),
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
        try {
          const { posts, total } = await fetchPosts(1, ps);
          if (!posts.length) return ["Keine Posts gefunden."];
          const hasMore = total > ps;
          const slugMap = {};
          posts.forEach((p, i) => { slugMap[i + 1] = p.slug; });
          pager.current = { type: "posts", page: 1, total, slugMap };
          return [
            `${total} Posts gefunden:`,
            "",
            ...posts.map((p, i) => fmtLine(i + 1, stripHtml(p.title.rendered), formatDate(p.date), cols)),
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
          pages.forEach((p, i) => { slugMap[i + 1] = p.slug; });
          pager.current = { type: "pages", page: 1, total, slugMap };
          return [
            `${total} Seiten:`,
            "",
            ...pages.map((p, i) => fmtLine(i + 1, stripHtml(p.title.rendered), '', cols)),
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
        slug = savedSlugMap[num];
      }
      try {
        const post = await fetchPostBySlug(slug);
        if (!post) return [`read: ${slug}: Kein Post gefunden`];
        const cols = getLineWidth();
        const body = stripHtml(post.content.rendered);
        const bodyLines = wrapLines(body.split("\n").filter((l) => l.trim()), cols);
        const allLines = [
          "─".repeat(cols),
          ...wordWrap(stripHtml(post.title.rendered), cols),
          `Veröffentlicht: ${formatDate(post.date)}`,
          "─".repeat(cols),
          "",
          ...bodyLines,
          "",
        ];
        const pageLines = getPageLines();
        const hasMore = allLines.length > pageLines;
        const slice = allLines.slice(0, pageLines);
        pager.current = hasMore
          ? { type: "article", lines: allLines, offset: pageLines, slugMap: savedSlugMap }
          : { type: "article", lines: [], offset: 0, slugMap: savedSlugMap };
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

    case "cat": {
      let slug = args[0];
      if (!slug) return ["Verwendung: cat <slug> oder cat <nummer>"];
      const num = parseInt(slug, 10);
      if (!isNaN(num) && pager.current?.slugMap?.[num]) {
        slug = pager.current.slugMap[num];
      }
      try {
        const post = await fetchPostBySlug(slug);
        if (!post) return [`cat: ${slug}: Kein Post gefunden`];
        const body = stripHtml(post.content.rendered);
        const lines = body.split("\n").filter((l) => l.trim());
        return [
          "─".repeat(60),
          stripHtml(post.title.rendered),
          `Veröffentlicht: ${formatDate(post.date)}`,
          "─".repeat(60),
          "",
          ...lines,
          "",
        ];
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

    case "status": {
      const lines = ["Systemstatus...", ""];
      const check = async (label, fn) => {
        try {
          const result = await fn();
          lines.push(`  [✓] ${label}${result ? ": " + result : ""}`);
        } catch (e) {
          lines.push(`  [✗] ${label}: ${e.message}`);
        }
      };
      await check("WordPress REST API", async () => {
        const res = await fetch(HX29.rest_root || "/wp-json/");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return "erreichbar";
      });
      await check("Authentifizierung", async () => {
        if (!NONCE) throw new Error("kein Nonce");
        return "Nonce vorhanden";
      });
      await check("Beiträge", async () => {
        const { total } = await fetchPosts(1, 1);
        return `${total} veröffentlicht`;
      });
      await check("Seiten", async () => {
        const { total } = await fetchPages(1, 1);
        return `${total} veröffentlicht`;
      });
      await check("Schrift", async () => {
        const fonts = document.fonts ? [...document.fonts].map(f => f.family) : [];
        if (fonts.some(f => f.includes("GlassTTY"))) return "Glass TTY VT220 geladen";
        throw new Error("nicht geladen");
      });
      lines.push("", "Alle Systeme betriebsbereit.");
      return lines;
    }

    case "about":
      return [
        `${SITE_NAME} — HX29 Terminal`,
        "═".repeat(40),
        "",
        "Ein WordPress-Theme mit terminalbasierter",
        "Oberfläche auf Basis von React (wp-element).",
        "",
        "Befehle:",
        "  ls posts / ls pages   Inhalte auflisten",
        "  read <n> / r <n>      Artikel lesen",
        "  cat <slug>            Artikel per Slug öffnen",
        "  config                Einstellungen",
        "  clear                 Terminal leeren",
        "",
        "Schrift: Glass TTY VT220 (Public Domain)",
        "Farben:  VT100 Phosphorgrün",
      ];

    case "config": {
      const cfg = { ...configRef.current };
      if (!args.length) {
        return [
          "Aktuelle Konfiguration:",
          "",
          `  --font   ${cfg.font}px`,
          `  --posts  ${cfg.posts}`,
          "",
          "Verwendung: config --font <px> --posts <n>",
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
        }
      }
      if (changed) {
        configRef.current = cfg;
        saveConfig(cfg);
        applyConfig(cfg);
        return ["Konfiguration gespeichert."];
      }
      return ["Unbekannte Option. Versuche: config --font 22 --posts 10"];
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
  const [terminalLines, setTerminalLines] = useState([
    <TerminalOutput key="welcome">{`Willkommen auf ${SITE_NAME}`}</TerminalOutput>,
    <TerminalOutput key="hint">Tippe 'help' für verfügbare Befehle.</TerminalOutput>,
  ]);
  const [printing, setPrinting] = useState(false);
  const pager = useRef(null);
  const configRef = useRef(loadConfig());
  const historyRef = useRef(loadHistory());

  useEffect(() => { applyConfig(configRef.current); }, []);
  useEffect(() => {
    scrollTerminal();
  }, [terminalLines]);

  const handleInput = useCallback(async (input) => {
    const raw = input.trim();

    setTerminalLines((prev) => [
      ...prev,
      <TerminalInput key={`in-${Date.now()}`}>{raw}</TerminalInput>,
    ]);

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
    for (let i = 0; i < result.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, LINE_DELAY));
      const text = result[i];
      const key = `out-${Date.now()}-${i}`;

      if (!text) {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{" "}</TerminalOutput>]);
        continue;
      }

      await new Promise((resolve) => {
        let charIndex = 0;
        const tick = () => {
          charIndex++;
          // skip over whitespace runs instantly
          while (charIndex < text.length && text[charIndex] === ' ') charIndex++;
          const partial = text.slice(0, charIndex);
          setTerminalLines((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.key === key) {
              next[next.length - 1] = <TerminalOutput key={key}>{partial}</TerminalOutput>;
            } else {
              next.push(<TerminalOutput key={key}>{partial}</TerminalOutput>);
            }
            return next;
          });
          if (charIndex < text.length) {
            setTimeout(tick, charDelay());
          } else {
            resolve();
          }
        };
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{""}</TerminalOutput>]);
        setTimeout(tick, charDelay());
      });
    }
    setPrinting(false);
  }, []);

  return (
    <Terminal
      name=""
      prompt={`guest@${SITE_NAME}:~$`}
      colorMode={ColorMode.Dark}
      height="100%"
      onInput={printing ? null : handleInput}
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
