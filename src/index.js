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
const AUTHOR = HX29.author || "Admin";

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

// ─── WordPress API ────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

async function fetchPosts(page = 1) {
  const res = await apiFetch(`/posts?per_page=${PAGE_SIZE}&page=${page}&_fields=id,slug,title,date`);
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

async function fetchPages(page = 1) {
  const res = await apiFetch(`/pages?per_page=${PAGE_SIZE}&page=${page}&_fields=slug,title`);
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

function fmtLine(n, title, date) {
  const num = String(n).padStart(NUM_W - 1) + ' ';
  const t = title.length > TITLE_W ? title.slice(0, TITLE_W - 1) + '…' : title;
  return num + t.padEnd(TITLE_W) + '  ' + date;
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
async function executeCommand(rawInput, pager) {
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
        "  m                 – weitere Einträge / nächste Seite",
        "  read <n>, r <n>   – Artikel nach Nummer lesen",
        "  cat <slug>        – Post/Seite öffnen",
        "  whoami            – Über den Autor",
        "  date              – aktuelles Datum",
        "  clear             – Terminal leeren",
        "  help              – diese Hilfe",
        "",
        "Tipp: Pfeil-Tasten ↑↓ für Befehlshistorie",
      ];

    case "m": {
      if (!pager.current) return ["Kein aktiver Pager."];
      const { type, page, total, slugMap } = pager.current;

      if (type === "article") {
        const { lines, offset } = pager.current;
        const pageLines = getPageLines();
        const slice = lines.slice(offset, offset + pageLines);
        const nextOffset = offset + pageLines;
        const hasMore = nextOffset < lines.length;
        pager.current = hasMore ? { type: "article", lines, offset: nextOffset } : null;
        return [...slice, ...(hasMore ? ["", "[m]ore"] : [""])];
      }
      const nextPage = page + 1;
      const offset = page * PAGE_SIZE;
      try {
        if (type === "posts") {
          const { posts, total: t } = await fetchPosts(nextPage);
          const shown = nextPage * PAGE_SIZE;
          const hasMore = shown < (total ?? t);
          posts.forEach((p, i) => { slugMap[offset + i + 1] = p.slug; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? t, slugMap } : null;
          return [
            ...posts.map((p, i) => fmtLine(offset + i + 1, stripHtml(p.title.rendered), formatDate(p.date))),
            ...(hasMore ? ["", "[m]ore"] : [""]),
          ];
        }
        if (type === "pages") {
          const { pages, total: t } = await fetchPages(nextPage);
          const shown = nextPage * PAGE_SIZE;
          const hasMore = shown < (total ?? t);
          pages.forEach((p, i) => { slugMap[offset + i + 1] = p.slug; });
          pager.current = hasMore ? { type, page: nextPage, total: total ?? t, slugMap } : null;
          return [
            ...pages.map((p, i) => fmtLine(offset + i + 1, stripHtml(p.title.rendered), '')),
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
      const target = args[0]?.toLowerCase();
      if (!target || target === "posts") {
        try {
          const { posts, total } = await fetchPosts(1);
          if (!posts.length) return ["Keine Posts gefunden."];
          const hasMore = total > PAGE_SIZE;
          const slugMap = {};
          posts.forEach((p, i) => { slugMap[i + 1] = p.slug; });
          if (hasMore) pager.current = { type: "posts", page: 1, total, slugMap };
          else pager.current = { type: "posts", page: 1, total, slugMap };
          return [
            `${total} Posts gefunden:`,
            "",
            ...posts.map((p, i) => fmtLine(i + 1, stripHtml(p.title.rendered), formatDate(p.date))),
            ...(hasMore ? ["", "[m]ore"] : []),
          ];
        } catch (e) {
          return [`Fehler: ${e.message}`];
        }
      }
      if (target === "pages") {
        try {
          const { pages, total } = await fetchPages(1);
          if (!pages.length) return ["Keine Seiten gefunden."];
          const hasMore = total > PAGE_SIZE;
          const slugMap = {};
          pages.forEach((p, i) => { slugMap[i + 1] = p.slug; });
          if (hasMore) pager.current = { type: "pages", page: 1, total, slugMap };
          else pager.current = { type: "pages", page: 1, total, slugMap };
          return [
            `${total} Seiten:`,
            "",
            ...pages.map((p, i) => fmtLine(i + 1, stripHtml(p.title.rendered), '')),
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
      if (!isNaN(num) && pager.current?.slugMap?.[num]) {
        slug = pager.current.slugMap[num];
      }
      try {
        const post = await fetchPostBySlug(slug);
        if (!post) return [`read: ${slug}: Kein Post gefunden`];
        const body = stripHtml(post.content.rendered);
        const bodyLines = wrapLines(body.split("\n").filter((l) => l.trim()), LINE_W);
        const allLines = [
          "─".repeat(LINE_W),
          ...wordWrap(stripHtml(post.title.rendered), LINE_W),
          `Veröffentlicht: ${formatDate(post.date)}`,
          "─".repeat(LINE_W),
          "",
          ...bodyLines,
          "",
        ];
        const pageLines = getPageLines();
        const hasMore = allLines.length > pageLines;
        const slice = allLines.slice(0, pageLines);
        pager.current = hasMore
          ? { ...(pager.current || {}), type: "article", lines: allLines, offset: pageLines }
          : pager.current;
        return [...slice, ...(hasMore ? ["", "[m]ore"] : [])];
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

    case "whoami":
      return [
        AUTHOR,
        `uid=1000(${AUTHOR}) gid=1000(writers) groups=1000(writers),4(adm)`,
      ];

    case "date":
      return [new Date().toString()];

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

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
function WPTerminal() {
  const [terminalLines, setTerminalLines] = useState([
    <TerminalOutput key="welcome">{`Willkommen auf ${SITE_NAME}`}</TerminalOutput>,
    <TerminalOutput key="hint">Tippe 'help' für verfügbare Befehle.</TerminalOutput>,
  ]);
  const [printing, setPrinting] = useState(false);
  const pager = useRef(null);

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

    const result = await executeCommand(raw, pager);

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
