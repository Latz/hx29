import { useState, useEffect, useCallback, useRef, createRoot } from "@wordpress/element";
import { useDebounce } from "@wordpress/compose";
import domReady from "@wordpress/dom-ready";
import Terminal, { ColorMode, TerminalOutput, TerminalInput } from "react-terminal-ui";
import { getSessionIntro } from "./intros";
import { t } from "./i18n/index.js";
import { SITE_NAME } from "./config.js";
import { executeCommand } from "./commands/registry.js";
import { applyCdPick } from "./commands/cmdCd.js";
import { loadConfig, loadHistory, pushHistory, applyConfig, scrollTerminal, followTerminal, maybeSyncTear } from "./utils.js";
import { cosmeticRandom } from "./random.js";
import useIntro from "./hooks/useIntro.js";
import useGlitch from "./hooks/useGlitch.js";
import useHumBar from "./hooks/useHumBar.js";
import useIdleSequence from "./hooks/useIdleSequence.js";
import useHistoryNav from "./hooks/useHistoryNav.js";

const _session = getSessionIntro(SITE_NAME);

const MAX_LINES = 500;
const LINE_DELAY = 1;

/**
 * Computes the per-character typing delay for animated output.
 * 9600 baud, 8N1 (10 bits/char): ~1.04ms/char baseline, with slight jitter.
 * @returns {number} Delay in milliseconds before printing the next character.
 */
function charDelay() {
  return 0.8 + cosmeticRandom() * 0.5;
}

/**
 * Resolves a pending `cd` disambiguation prompt using the user's numeric reply.
 * @param {{candidates: Array<{type:string,id:*,name:string,slug:string}>}} pending - Pending disambiguation state.
 * @param {string} raw - Raw user input (expected to be a 1-based index).
 * @param {import('react').RefObject<{category:Object|null,tag:Object|null}>} contextRef - Current cd context ref.
 * @param {function({category:Object|null,tag:Object|null}|null):void} setCtxDisplay - React state setter for the displayed cd context.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @param {import('react').RefObject<number>} lineId - Monotonic id ref used to derive React keys.
 * @returns {void}
 */
function resolvePendingCd(pending, raw, contextRef, setCtxDisplay, setTerminalLines, lineId) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isNaN(n) && pending.candidates[n - 1]) {
    const lines = applyCdPick(pending.candidates[n - 1], contextRef, setCtxDisplay);
    setTerminalLines((prev) => [...prev, ...lines.map((line) => <TerminalOutput key={`cd-${++lineId.current}`}>{line}</TerminalOutput>)].slice(-MAX_LINES));
  } else {
    setTerminalLines((prev) => [...prev, <TerminalOutput key={`cd-${++lineId.current}`}>{t.cd_cancelled}</TerminalOutput>].slice(-MAX_LINES));
  }
}

/**
 * Builds the `cd`-context path segment shown in the prompt from the active
 * category and/or tag slots.
 * @param {{category:{slug:string}|null,tag:{slug:string}|null}|null} ctx - Active prompt context display.
 * @returns {string|null} Path segment (without leading `~/`), or null when no context is active.
 */
function formatCtxPath(ctx) {
  if (!ctx || (!ctx.category && !ctx.tag)) return null;
  const parts = [];
  if (ctx.category) parts.push(`categories/${ctx.category.slug}`);
  if (ctx.tag) parts.push(ctx.category ? `tag/${ctx.tag.slug}` : `tags/${ctx.tag.slug}`);
  return parts.join("/");
}

/**
 * Prints a phased output line, overwriting it in place as each phase's hold
 * timer elapses.
 * @param {{__phases: Array<{text:string,hold:number}>}} text - Phased line descriptor.
 * @param {string} key - React key for the line.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @returns {Promise<void>} Resolves once all phases have printed.
 */
function printPhasedLine(text, key, setTerminalLines) {
  return new Promise((resolve) => {
    let p = 0;
    const step = () => {
      const { text: pt, hold } = text.__phases[p];
      setTerminalLines((prev) => {
        const arr = [...prev];
        const last = arr.at(-1);
        if (last?.key === key) arr[arr.length - 1] = <TerminalOutput key={key}>{pt}</TerminalOutput>;
        else arr.push(<TerminalOutput key={key}>{pt}</TerminalOutput>);
        return arr;
      });
      p++;
      if (p < text.__phases.length) setTimeout(step, hold);
      else resolve();
    };
    step();
  });
}

/**
 * Prints a line character-by-character with variable typing delay.
 * @param {string|{__animText:string,__suffix?:import('react').ReactNode,__final?:import('react').ReactNode}} text - Plain
 *   text or animated-text descriptor. `__suffix` is appended after the typed text; `__final`, if given, replaces the
 *   typed text entirely once done (e.g. to swap in styled link spans without skipping the animation).
 * @param {string} key - React key for the line.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @returns {Promise<void>} Resolves once the line has fully printed.
 */
function printAnimatedLine(text, key, setTerminalLines) {
  const animText = text?.__animText ?? text;
  const suffix = text?.__suffix ?? null;
  const final = text?.__final ?? null;

  return new Promise((resolve) => {
    let charIndex = 0;
    const tick = () => {
      charIndex++;
      while (charIndex < animText.length && animText[charIndex] === " ") charIndex++;
      const partial = animText.slice(0, charIndex);
      const isDone = charIndex >= animText.length;
      setTerminalLines((prev) => {
        const next = [...prev];
        const last = next.at(-1);
        const content = isDone && final ? final : (isDone && suffix ? <>{partial}{suffix}</> : partial);
        if (last?.key === key) {
          next[next.length - 1] = <TerminalOutput key={key}>{content}</TerminalOutput>;
        } else {
          next.push(<TerminalOutput key={key}>{content}</TerminalOutput>);
        }
        return next;
      });
      if (charIndex < animText.length) {
        setTimeout(tick, charDelay());
      } else {
        resolve();
      }
    };
    setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{""}</TerminalOutput>].slice(-MAX_LINES));
    setTimeout(tick, charDelay());
  });
}

/**
 * Prints a single command-result line, dispatching to the blank/phased/plain/
 * animated printer depending on its shape.
 * @param {*} text - Line content (string, phased descriptor, or React node).
 * @param {string} key - React key for the line.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @returns {Promise<void>} Resolves once the line has fully printed.
 */
async function printLine(text, key, setTerminalLines) {
  if (!text) {
    setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{" "}</TerminalOutput>].slice(-MAX_LINES));
    return;
  }
  if (text?.__phases) {
    await printPhasedLine(text, key, setTerminalLines);
    return;
  }
  if (typeof text !== "string" && !text?.__animText) {
    setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{text}</TerminalOutput>].slice(-MAX_LINES));
    return;
  }
  await printAnimatedLine(text, key, setTerminalLines);
  maybeSyncTear();
}

/**
 * Prints each result line in sequence with a short delay between lines.
 * @param {Array<*>} lines - Result lines to print.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @param {import('react').RefObject<number>} lineId - Monotonic id ref used to derive React keys.
 * @returns {Promise<void>} Resolves once all lines have printed.
 */
async function printLines(lines, setTerminalLines, lineId) {
  for (const text of lines) {
    await new Promise((resolve) => setTimeout(resolve, LINE_DELAY));
    const key = `out-${++lineId.current}`;
    await printLine(text, key, setTerminalLines);
    followTerminal();
  }
}

/**
 * Root terminal React component. Wires together all hooks and renders
 * the `react-terminal-ui` `<Terminal>` with animated output printing,
 * intro sequence, idle effects, and command dispatch.
 * @returns {import('react').ReactElement}
 */
function WPTerminal() {
  const [terminalLines, setTerminalLines] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [ctxDisplay, setCtxDisplay] = useState(null);
  const [pendingPrompt, setPendingPrompt] = useState(null);

  const visitStage = _session.stage;
  const lineId = useRef(0);
  const pager = useRef(null);
  const configRef = useRef(loadConfig());
  const contextRef = useRef({ category: null, tag: null });
  const historyRef = useRef(loadHistory());
  const pendingRef = useRef(null);
  const introPlayingRef = useRef(true);
  const printingRef = useRef(false);

  const debouncedScroll = useDebounce(scrollTerminal, 50);

  useEffect(() => { applyConfig(configRef.current); }, []);
  useEffect(() => {
    debouncedScroll();
  }, [terminalLines, printing, debouncedScroll]);

  const introPlaying = useIntro(_session.items, setTerminalLines);
  useEffect(() => { introPlayingRef.current = introPlaying; }, [introPlaying]);

  const glitchTimerRef = useGlitch(introPlayingRef, printingRef, setTerminalLines);
  useHumBar();
  const { idleTimerRef, idleActiveRef } = useIdleSequence(introPlayingRef, printingRef, setTerminalLines);
  const { reset: resetHistoryPos } = useHistoryNav(historyRef, printingRef, introPlayingRef, pager, () => setTerminalLines([]));

  const handleInput = useCallback(async (input) => {
    if (introPlayingRef.current) return;
    idleActiveRef.current = false;
    idleTimerRef.schedule?.();
    if (glitchTimerRef.reschedule) { glitchTimerRef.reschedule(); glitchTimerRef.reschedule = null; }

    const raw = input.trim();
    setTerminalLines((prev) => [...prev, <TerminalInput key={`in-${++lineId.current}`}>{raw}</TerminalInput>].slice(-MAX_LINES));

    if (!raw && !pendingRef.current) return;

    // Handle pending cd disambiguation
    if (pendingRef.current) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      setPendingPrompt(null);
      resolvePendingCd(pending, raw, contextRef, setCtxDisplay, setTerminalLines, lineId);
      return;
    }

    resetHistoryPos();
    pushHistory(historyRef, raw);
    const result = await executeCommand(raw, pager, configRef, contextRef, historyRef, setCtxDisplay, pendingRef);

    if (result === "__CLEAR__") {
      setTerminalLines([]);
      return;
    }

    let lines = result;
    if (Array.isArray(result) && result[0] === "__REPLACE__") {
      setTerminalLines([]);
      lines = result.slice(1);
    }

    setPrinting(true);
    printingRef.current = true;

    await printLines(lines, setTerminalLines, lineId);

    setPrinting(false);
    printingRef.current = false;
    if (pendingRef.current) setPendingPrompt(t.cd_select_prompt);
  }, []);

  const prompt = pendingPrompt ?? (() => {
    const STAGE_PROMPTS = [
      { prefix: "guest@aeon-gateway", home: "~", suffix: "$" },
      { prefix: "intruder@aeon-gateway", home: "", suffix: "#" },
      { prefix: "anon@apex-mainframe", home: "", suffix: "#" },
      { prefix: "operator@aeon-core", home: "", suffix: "#" },
    ];
    const { prefix, home, suffix } = STAGE_PROMPTS[visitStage - 1];
    const path = formatCtxPath(ctxDisplay);
    return `${prefix}:${path ? `~/${path}` : home}${suffix}`;
  })();

  return (
    <Terminal
      name=""
      prompt={prompt}
      colorMode={ColorMode.Dark}
      height="100%"
      onInput={printing || introPlaying ? null : handleInput}
      TopButtonsPanel={() => null}
    >
      {terminalLines}
    </Terminal>
  );
}

domReady(() => {
  const el = document.getElementById("hx29-root");
  if (el) createRoot(el).render(<WPTerminal />);
});
