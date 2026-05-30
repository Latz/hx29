import {
  useState,
  useEffect,
  useRef,
  useCallback,
  createRoot,
} from "@wordpress/element";

// ─── Konfig ───────────────────────────────────────────────────────────────────
// Eigene Site, relativ — von functions.php via wp_localize_script geliefert.
const HX29 = typeof window !== "undefined" && window.hx29 ? window.hx29 : {};
const WP_API = (HX29.rest_root || "/wp-json/").replace(/\/$/, "") + "/wp/v2";
const NONCE = HX29.nonce || "";
const SITE_NAME = HX29.site_name || "my-terminal";
const AUTHOR = HX29.author || "Admin";

// Same-Origin-Requests an die WP-REST-API; Nonce für authentifizierte Anfragen.
function apiFetch(path) {
  return fetch(`${WP_API}${path}`, {
    headers: NONCE ? { "X-WP-Nonce": NONCE } : {},
    credentials: "same-origin",
  });
}

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
  },
  titleBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    backgroundColor: "#1a1a1a",
    borderBottom: "1px solid #333",
    flexShrink: 0,
  },
  dot: (color) => ({
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    backgroundColor: color,
  }),
  titleText: {
    color: "#888",
    fontSize: "12px",
    marginLeft: "8px",
  },
  output: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
    scrollbarWidth: "thin",
    scrollbarColor: "#333 #0d0d0d",
  },
  line: {
    margin: "2px 0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  prompt: {
    color: "#00ff41",
  },
  command: {
    color: "#ffffff",
  },
  error: {
    color: "#ff4444",
  },
  info: {
    color: "#00aaff",
  },
  muted: {
    color: "#666",
  },
  success: {
    color: "#00ff41",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    borderTop: "1px solid #1a1a1a",
    flexShrink: 0,
  },
  promptLabel: {
    color: "#00ff41",
    marginRight: "8px",
    whiteSpace: "nowrap",
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#ffffff",
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "14px",
    caretColor: "#00ff41",
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
  const res = await apiFetch(
    `/posts?per_page=20&_fields=id,slug,title,date,excerpt`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchPostBySlug(slug) {
  const res = await apiFetch(
    `/posts?slug=${encodeURIComponent(slug)}&_fields=title,date,content,author`
  );
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

    case "ls": {
      const target = args[0]?.toLowerCase();
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

    case "cat": {
      const slug = args[0];
      if (!slug) return [{ text: "Verwendung: cat <slug>", style: "error" }];
      try {
        const post = await fetchPostBySlug(slug);
        if (!post) return [{ text: `cat: ${slug}: Kein Post gefunden`, style: "error" }];
        const body = stripHtml(post.content.rendered);
        const lines = body.split("\n").filter((l) => l.trim());
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

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────
function WPTerminal() {
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

  // Responsive: ResizeObserver passt fontSize an
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
  }, [lines]);

  // Fokus beim Klick ins Terminal
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

    // Eingabe anzeigen
    setLines((prev) => [
      ...prev,
      { text: `guest@${SITE_NAME}:~$ ${raw}`, style: "prompt" },
    ]);

    if (!raw) return;

    // Zur History hinzufügen
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
      {/* Titel-Leiste */}
      <div style={styles.titleBar}>
        <div style={styles.dot("#ff5f57")} />
        <div style={styles.dot("#febc2e")} />
        <div style={styles.dot("#28c840")} />
        <span style={styles.titleText}>{SITE_NAME} — bash</span>
      </div>

      {/* Output */}
      <div ref={outputRef} style={styles.output}>
        {lines.map((line, i) => (
          <div key={i} style={{ ...styles.line, ...styles[line.style || "command"] }}>
            {line.text}
          </div>
        ))}
        {loading && <div style={{ ...styles.line, ...styles.muted }}>…</div>}
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <span style={styles.promptLabel}>guest@{SITE_NAME}:~$</span>
        <input
          ref={inputRef}
          style={styles.input}
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
    </div>
  );
}

// ─── Mount ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("hx29-root");
  if (el) createRoot(el).render(<WPTerminal />);
});
