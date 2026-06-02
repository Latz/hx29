import { useState, useEffect, useRef, useCallback } from "@wordpress/element";

// ─── Konfig ───────────────────────────────────────────────────────────────────
const WP_API = "https://your-wordpress-site.com/wp-json/wp/v2";
const SITE_NAME = "my-terminal";
const AUTHOR = "Admin";

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  wrapper: {
    width: "100%",
    height: "100%",
    minHeight: "100vh",
    backgroundColor: "#0d0d0d",
    color: "#00ff41",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "14px",
    lineHeight: "1.5",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    cursor: "text",
  },
  output: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    scrollbarWidth: "none",
  },
  line: {
    margin: "0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  prompt: {
    color: "#00ff41",
  },
  command: {
    color: "#c0c0c0",
  },
  error: {
    color: "#ff4444",
  },
  info: {
    color: "#00aaff",
  },
  muted: {
    color: "#555",
  },
  success: {
    color: "#00ff41",
  },
  inputLine: {
    display: "flex",
    alignItems: "center",
    margin: "0",
    whiteSpace: "pre",
  },
  promptLabel: {
    color: "#00ff41",
    flexShrink: 0,
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    pointerEvents: "none",
    width: "1px",
    height: "1px",
  },
  cursor: {
    display: "inline-block",
    width: "0.6em",
    height: "1.1em",
    backgroundColor: "#00ff41",
    verticalAlign: "text-bottom",
    animation: "blink 1s step-end infinite",
  },
};

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
}

// ─── WordPress API ────────────────────────────────────────────────────────────
async function fetchPosts() {
  const res = await fetch(`${WP_API}/posts?per_page=20&_fields=id,slug,title,date,excerpt`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPostBySlug(slug) {
  const res = await fetch(`${WP_API}/posts?slug=${slug}&_fields=title,date,content,author`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const posts = await res.json();
  if (!posts.length) return null;
  return posts[0];
}

async function fetchPages() {
  const res = await fetch(`${WP_API}/pages?per_page=20&_fields=slug,title`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Command-Handler ──────────────────────────────────────────────────────────
async function cmdLs(target) {
  if (!target || target === "posts") {
    try {
      const posts = await fetchPosts();
      if (!posts.length) return [{ text: "Keine Posts gefunden.", style: "muted" }];
      return [
        { text: `${posts.length} Posts gefunden:`, style: "info" },
        { text: "" },
        ...posts.map((p) => ({
          text: `  ${p.slug.padEnd(35)} ${formatDate(p.date)}  ${stripHtml(p.title.rendered)}`,
          style: "success",
        })),
      ];
    } catch (e) {
      return [{ text: `Fehler: ${e.message}`, style: "error" }];
    }
  }
  if (target === "pages") {
    try {
      const pages = await fetchPages();
      if (!pages.length) return [{ text: "Keine Seiten gefunden.", style: "muted" }];
      return [
        { text: `${pages.length} Seiten:`, style: "info" },
        { text: "" },
        ...pages.map((p) => ({
          text: `  ${p.slug.padEnd(35)} ${stripHtml(p.title.rendered)}`,
          style: "success",
        })),
      ];
    } catch (e) {
      return [{ text: `Fehler: ${e.message}`, style: "error" }];
    }
  }
  return [{ text: `ls: '${target}' nicht gefunden. Versuche: ls posts, ls pages`, style: "error" }];
}

async function cmdCat(slug) {
  if (!slug) return [{ text: "Verwendung: cat <slug>", style: "error" }];
  try {
    const post = await fetchPostBySlug(slug);
    if (!post) return [{ text: `cat: ${slug}: Kein Post gefunden`, style: "error" }];
    const lines = stripHtml(post.content.rendered).split("\n").filter((l) => l.trim());
    return [
      { text: "─".repeat(60), style: "muted" },
      { text: stripHtml(post.title.rendered), style: "info" },
      { text: `Veröffentlicht: ${formatDate(post.date)}`, style: "muted" },
      { text: "─".repeat(60), style: "muted" },
      { text: "" },
      ...lines.map((l) => ({ text: l, style: "command" })),
      { text: "" },
    ];
  } catch (e) {
    return [{ text: `Fehler: ${e.message}`, style: "error" }];
  }
}

async function executeCommand(rawInput) {
  const parts = rawInput.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "help":
      return [
        { text: "Verfügbare Befehle:", style: "info" },
        { text: "" },
        { text: "  ls posts          – alle Blogposts anzeigen", style: "success" },
        { text: "  ls pages          – alle Seiten anzeigen", style: "success" },
        { text: "  cat <slug>        – Post/Seite öffnen", style: "success" },
        { text: "  whoami            – Über den Autor", style: "success" },
        { text: "  date              – aktuelles Datum", style: "success" },
        { text: "  clear             – Terminal leeren", style: "success" },
        { text: "  help              – diese Hilfe", style: "success" },
        { text: "" },
        { text: "Tipp: Pfeil-Tasten ↑↓ für Befehlshistorie", style: "muted" },
      ];
    case "ls":
      return cmdLs(args[0]?.toLowerCase());
    case "cat":
      return cmdCat(args[0]);
    case "whoami":
      return [
        { text: AUTHOR, style: "success" },
        { text: `uid=1000(${AUTHOR}) gid=1000(writers) groups=1000(writers),4(adm)`, style: "muted" },
      ];
    case "date":
      return [{ text: new Date().toString(), style: "success" }];
    case "clear":
      return "__CLEAR__";
    case "":
      return [];
    default:
      return [
        { text: `${cmd}: Befehl nicht gefunden. Tippe 'help' für Hilfe.`, style: "error" },
      ];
  }
}

// ─── Blink-Keyframe einmalig injizieren ───────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("vt-blink")) {
  const s = document.createElement("style");
  s.id = "vt-blink";
  s.textContent = "@keyframes blink { 50% { opacity: 0; } }";
  document.head.appendChild(s);
}

const PROMPT = `guest@${SITE_NAME}:~$ `;

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function WPTerminal() {
  const [lines, setLines] = useState([
    { text: `Willkommen auf ${SITE_NAME}`, style: "success" },
    { text: `Tippe 'help' für verfügbare Befehle.`, style: "muted" },
    { text: "" },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  const outputRef = useRef(null);
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);

  // Responsive fontSize
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const size = Math.max(11, Math.min(16, Math.floor(width / 60)));
        wrapperRef.current.style.fontSize = `${size}px`;
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, input, loading]);

  const handleWrapperClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const addLines = useCallback((newLines) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const raw = input.trim();
    setInput("");
    setHistoryIndex(-1);

    setLines((prev) => [
      ...prev,
      { text: `${PROMPT}${raw}`, style: "prompt" },
    ]);

    if (!raw) return;

    setHistory((prev) => [raw, ...prev.slice(0, 49)]);

    setLoading(true);
    const result = await executeCommand(raw);
    setLoading(false);

    if (result === "__CLEAR__") {
      setLines([]);
      return;
    }
    addLines(result);
  }, [input, addLines]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHistoryIndex((prev) => {
          const next = Math.min(prev + 1, history.length - 1);
          setInput(history[next] ?? "");
          return next;
        });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHistoryIndex((prev) => {
          const next = Math.max(prev - 1, -1);
          setInput(next === -1 ? "" : history[next] ?? "");
          return next;
        });
      }
    },
    [handleSubmit, history]
  );

  return (
    <div ref={wrapperRef} style={styles.wrapper} onClick={handleWrapperClick}>
      <div ref={outputRef} style={styles.output}>
        {lines.map((line, i) => (
          <div key={i} style={{ ...styles.line, ...styles[line.style || "command"] }}>
            {line.text}
          </div>
        ))}

        {loading ? (
          <div style={{ ...styles.line, ...styles.muted }}>{PROMPT}</div>
        ) : (
          <div style={styles.inputLine}>
            <span style={styles.promptLabel}>{PROMPT}</span>
            <span style={{ color: "#c0c0c0" }}>{input}</span>
            <span style={styles.cursor} />
          </div>
        )}
      </div>

      {/* Hidden real input to capture keyboard */}
      <input
        ref={inputRef}
        style={styles.hiddenInput}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Terminal-Eingabe"
      />
    </div>
  );
}
