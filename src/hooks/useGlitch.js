import { useEffect, useRef } from "@wordpress/element";
import { TerminalOutput } from "react-terminal-ui";
import glitches from "../glitches.json";
import { scrollTerminal } from "../utils.js";
import { cosmeticRandom } from "../random.js";

/**
 * Periodically appends a random glitch message to the terminal (every 90–150 s).
 * The timer pauses while the intro or a command is printing, then reschedules
 * on the next user input via `timerRef.reschedule`.
 * @param {import('react').RefObject<boolean>} introPlayingRef - True while the intro animation is running.
 * @param {import('react').RefObject<boolean>} printingRef - True while a command result is being printed.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @returns {import('react').RefObject<ReturnType<typeof setTimeout>|null>} Timer ref; callers may set `.reschedule` to restart after input.
 */
export default function useGlitch(introPlayingRef, printingRef, setTerminalLines) {
  const timerRef = useRef(null);

  useEffect(() => {
    const schedule = () => {
      const delay = 90000 + cosmeticRandom() * 60000;
      return setTimeout(() => {
        if (!introPlayingRef.current && !printingRef.current) {
          const msg = glitches[Math.floor(cosmeticRandom() * glitches.length)];
          setTerminalLines((prev) => [...prev, <TerminalOutput key={`glitch-${prev.length}`}>{msg}</TerminalOutput>]);
          setTimeout(scrollTerminal, 50);
          timerRef.current = null;
          timerRef.reschedule = () => { timerRef.current = schedule(); };
        } else {
          timerRef.current = schedule();
        }
      }, delay);
    };
    timerRef.current = schedule();
    return () => clearTimeout(timerRef.current);
  }, []);

  return timerRef;
}
