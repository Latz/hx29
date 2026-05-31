import {
  useState,
  useEffect,
  useCallback,
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
async function fetchPosts() {
  const res = await apiFetch(`/posts?per_page=20&_fields=id,slug,title,date,excerpt`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPostBySlug(slug) {
  const res = await apiFetch(`/posts?slug=${encodeURIComponent(slug)}&_fields=title,date,content,author`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const posts = await res.json();
  if (!posts.length) return null;
  return posts[0];
}

async function fetchPages() {
  const res = await apiFetch(`/pages?per_page=20&_fields=slug,title`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Command-Handler ──────────────────────────────────────────────────────────
async function executeCommand(rawInput) {
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
        "  cat <slug>        – Post/Seite öffnen",
        "  whoami            – Über den Autor",
        "  date              – aktuelles Datum",
        "  clear             – Terminal leeren",
        "  help              – diese Hilfe",
        "",
        "Tipp: Pfeil-Tasten ↑↓ für Befehlshistorie",
      ];

    case "ls": {
      const target = args[0]?.toLowerCase();
      if (!target || target === "posts") {
        try {
          const posts = await fetchPosts();
          if (!posts.length) return ["Keine Posts gefunden."];
          return [
            `${posts.length} Posts gefunden:`,
            "",
            ...posts.map((p) => `  ${p.slug.padEnd(35)} ${formatDate(p.date)}  ${stripHtml(p.title.rendered)}`),
          ];
        } catch (e) {
          return [`Fehler: ${e.message}`];
        }
      }
      if (target === "pages") {
        try {
          const pages = await fetchPages();
          if (!pages.length) return ["Keine Seiten gefunden."];
          return [
            `${pages.length} Seiten:`,
            "",
            ...pages.map((p) => `  ${p.slug.padEnd(35)} ${stripHtml(p.title.rendered)}`),
          ];
        } catch (e) {
          return [`Fehler: ${e.message}`];
        }
      }
      return [`ls: '${target}' nicht gefunden. Versuche: ls posts, ls pages`];
    }

    case "cat": {
      const slug = args[0];
      if (!slug) return ["Verwendung: cat <slug>"];
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

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
function WPTerminal() {
  const [terminalLines, setTerminalLines] = useState([
    <TerminalOutput key="welcome">{`Willkommen auf ${SITE_NAME}`}</TerminalOutput>,
    <TerminalOutput key="hint">Tippe 'help' für verfügbare Befehle.</TerminalOutput>,
  ]);
  const [printing, setPrinting] = useState(false);

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

    const result = await executeCommand(raw);

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
