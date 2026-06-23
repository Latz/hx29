import { useState, useEffect, useCallback, useRef, createRoot } from "@wordpress/element";
import Terminal, { ColorMode, TerminalOutput, TerminalInput } from "react-terminal-ui";
import { getSessionIntro } from "./intros";
import { t } from "./i18n/index.js";
import { SITE_NAME } from "./config.js";
import { executeCommand } from "./commands/registry.js";
import { loadConfig, loadHistory, pushHistory, applyConfig, scrollTerminal, maybeSyncTear } from "./utils.js";
import useIntro from "./hooks/useIntro.js";
import useGlitch from "./hooks/useGlitch.js";
import useHumBar from "./hooks/useHumBar.js";
import useIdleSequence from "./hooks/useIdleSequence.js";
import useHistoryNav from "./hooks/useHistoryNav.js";

const _session = getSessionIntro(SITE_NAME);

/**
 * Root terminal React component. Wires together all hooks and renders
 * the `react-terminal-ui` `<Terminal>` with animated output printing,
 * intro sequence, idle effects, and command dispatch.
 * @returns {import('react').ReactElement}
 */
const MAX_LINES = 500;

function WPTerminal() {
  const [terminalLines, setTerminalLines] = useState([]);
  const [printing, setPrinting] = useState(false);
  const [ctxDisplay, setCtxDisplay] = useState(null);
  const [pendingPrompt, setPendingPrompt] = useState(null);

  const visitStage = _session.stage;
  const lineId = useRef(0);
  const pager = useRef(null);
  const configRef = useRef(loadConfig());
  const contextRef = useRef({ type: null, id: null, name: null });
  const historyRef = useRef(loadHistory());
  const pendingRef = useRef(null);
  const introPlayingRef = useRef(true);
  const printingRef = useRef(false);

  const scrollDebounceRef = useRef(null);

  useEffect(() => { applyConfig(configRef.current); }, []);
  useEffect(() => {
    clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(scrollTerminal, 50);
  }, [terminalLines]);

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

    if (!raw) return;

    // Handle pending cd disambiguation
    if (pendingRef.current) {
      const pending = pendingRef.current;
      pendingRef.current = null;
      setPendingPrompt(null);
      const n = parseInt(raw, 10);
      if (!isNaN(n) && pending.candidates[n - 1]) {
        const pick = pending.candidates[n - 1];
        contextRef.current = { type: pick.type, id: pick.id, name: pick.name };
        setCtxDisplay({ type: pick.type, name: pick.slug });
        const lines = [t.cd_now_in(pick.name, pick.type)];
        if (pick.type === "category") lines.push(t.cd_hint_combine);
        setTerminalLines((prev) => [...prev, ...lines.map((line) => <TerminalOutput key={`cd-${++lineId.current}`}>{line}</TerminalOutput>)].slice(-MAX_LINES));
      } else {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={`cd-${++lineId.current}`}>{t.cd_cancelled}</TerminalOutput>].slice(-MAX_LINES));
      }
      return;
    }

    resetHistoryPos();
    pushHistory(historyRef, raw);
    const result = await executeCommand(raw, pager, configRef, contextRef, historyRef, setCtxDisplay, pendingRef);

    if (result === "__CLEAR__") {
      setTerminalLines([]);
      return;
    }

    const charDelay = (ch, nextCh) => {
      const base = 6 + Math.random() * 4;
      const midWord = ch !== " " && nextCh && nextCh !== " ";
      if (midWord && Math.random() < 0.02) return base + 100 + Math.random() * 150;
      return base;
    };
    const LINE_DELAY = 8;

    setPrinting(true);
    printingRef.current = true;

    for (let i = 0; i < result.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, LINE_DELAY));
      const text = result[i];
      const key = `out-${++lineId.current}`;

      if (!text) {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{" "}</TerminalOutput>].slice(-MAX_LINES));
        continue;
      }

      if (text?.__phases) {
        await new Promise((resolve) => {
          let p = 0;
          const step = () => {
            const { text: pt, hold } = text.__phases[p];
            setTerminalLines((prev) => {
              const arr = [...prev];
              const last = arr[arr.length - 1];
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
        continue;
      }

      if (typeof text !== "string" && !text?.__animText) {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{text}</TerminalOutput>].slice(-MAX_LINES));
        continue;
      }

      const animText = text?.__animText ?? text;
      const suffix = text?.__suffix ?? null;

      await new Promise((resolve) => {
        let charIndex = 0;
        const tick = () => {
          charIndex++;
          while (charIndex < animText.length && animText[charIndex] === " ") charIndex++;
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
        setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{""}</TerminalOutput>].slice(-MAX_LINES));
        setTimeout(tick, charDelay());
      });

      maybeSyncTear();
    }

    setPrinting(false);
    printingRef.current = false;
    if (pendingRef.current) setPendingPrompt(t.cd_select_prompt);
  }, []);

  const prompt = pendingPrompt ?? (() => {
    const base = [
      `guest@aeon-gateway:~$`,
      `intruder@aeon-gateway:#`,
      `anon@apex-mainframe:#`,
      `operator@aeon-core:#`,
    ][visitStage - 1];
    return ctxDisplay ? base.replace("~", `~/${ctxDisplay.name}`) : base;
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

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("hx29-root");
  if (el) createRoot(el).render(<WPTerminal />);
});
