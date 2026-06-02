import { useState, useEffect } from "@wordpress/element";
import { TerminalOutput } from "react-terminal-ui";

/**
 * Plays the intro animation sequence on mount, character-by-character.
 * Supports phased lines (overwriting the same line) and plain text lines.
 * Focuses the hidden input and sets `introPlaying` to false when done.
 * @param {Array<{text?:string,delay:number,__phases?:Array<{text:string,hold:number}>}>} introItems - Intro sequence items.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @returns {boolean} `true` while the animation is still playing.
 */
export default function useIntro(introItems, setTerminalLines) {
  const [introPlaying, setIntroPlaying] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const animateLine = (key, text) =>
      new Promise((resolve) => {
        let charIndex = 0;
        const CHUNK = 4;
        const tick = () => {
          if (cancelled) { resolve(); return; }
          for (let c = 0; c < CHUNK && charIndex < text.length; c++) {
            charIndex++;
            while (charIndex < text.length && text[charIndex] === " ") charIndex++;
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
      for (let i = 0; i < introItems.length; i++) {
        if (cancelled) break;
        const item = introItems[i];
        await wait(item.delay);
        if (cancelled) break;

        if (item.__phases) {
          const key = `intro-${i}`;
          for (const { text: pt, hold } of item.__phases) {
            if (cancelled) break;
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
          if (item.text === "" || item.text === " ") {
            setTerminalLines((prev) => [...prev, <TerminalOutput key={`intro-${i}`}>{" "}</TerminalOutput>]);
          } else {
            await animateLine(`intro-${i}`, item.text);
          }
        }
      }
      if (!cancelled) {
        setIntroPlaying(false);
        setTimeout(() => document.querySelector(".terminal-hidden-input")?.focus(), 50);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return introPlaying;
}
