import { useState, useEffect } from "@wordpress/element";
import { TerminalOutput } from "react-terminal-ui";

const CHUNK = 4;

/**
 * Replaces the terminal line matching `key` with new content, or appends it
 * if no such line exists yet.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @param {string} key - React key identifying the line to update or append.
 * @param {string} content - New line content.
 * @returns {void}
 */
function upsertLine(setTerminalLines, key, content) {
  setTerminalLines((prev) => {
    const arr = [...prev];
    const last = arr.at(-1);
    if (last?.key === key) arr[arr.length - 1] = <TerminalOutput key={key}>{content}</TerminalOutput>;
    else arr.push(<TerminalOutput key={key}>{content}</TerminalOutput>);
    return arr;
  });
}

/**
 * Animates `text` into the terminal line `key`, a few characters at a time,
 * skipping over runs of spaces so words reveal together.
 * @param {string} key - React key for the animated line.
 * @param {string} text - Full text to reveal.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @param {{current: boolean}} cancelledRef - Set to true to abort the animation early.
 * @returns {Promise<void>} Resolves once the line is fully revealed (or animation is cancelled).
 */
function animateLine(key, text, setTerminalLines, cancelledRef) {
  return new Promise((resolve) => {
    let charIndex = 0;
    const tick = () => {
      if (cancelledRef.current) { resolve(); return; }
      for (let c = 0; c < CHUNK && charIndex < text.length; c++) {
        charIndex++;
        while (charIndex < text.length && text[charIndex] === " ") charIndex++;
      }
      upsertLine(setTerminalLines, key, text.slice(0, charIndex));
      if (charIndex < text.length) setTimeout(tick, 0);
      else resolve();
    };
    setTerminalLines((prev) => [...prev, <TerminalOutput key={key}>{""}</TerminalOutput>]);
    setTimeout(tick, 0);
  });
}

/**
 * Resolves after `ms` milliseconds.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>}
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Plays a phased intro item (multiple texts overwriting the same line in turn).
 * @param {{__phases: Array<{text:string,hold:number}>}} item - Intro item with phases.
 * @param {number} i - Item index, used to derive the React key.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @param {{current: boolean}} cancelledRef - Set to true to abort playback early.
 * @returns {Promise<void>} Resolves once all phases have played (or playback is cancelled).
 */
async function playPhases(item, i, setTerminalLines, cancelledRef) {
  const key = `intro-${i}`;
  const firstText = item.__phases[0].text;
  for (const { text: phaseText, hold } of item.__phases) {
    if (cancelledRef.current) break;
    if (phaseText === firstText) await animateLine(key, phaseText, setTerminalLines, cancelledRef);
    else upsertLine(setTerminalLines, key, phaseText);
    if (hold > 0) await wait(hold);
  }
}

/**
 * Plays a plain-text intro item: a blank spacer line or an animated line.
 * @param {{text?: string}} item - Intro item with plain text.
 * @param {number} i - Item index, used to derive the React key.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @param {{current: boolean}} cancelledRef - Set to true to abort playback early.
 * @returns {Promise<void>} Resolves once the item has played.
 */
async function playPlainItem(item, i, setTerminalLines, cancelledRef) {
  if (item.text === "" || item.text === " ") {
    setTerminalLines((prev) => [...prev, <TerminalOutput key={`intro-${i}`}>{" "}</TerminalOutput>]);
  } else {
    await animateLine(`intro-${i}`, item.text, setTerminalLines, cancelledRef);
  }
}

/**
 * Plays a single intro item, dispatching to phased or plain-text playback.
 * @param {Object} item - Intro item.
 * @param {number} i - Item index.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @param {{current: boolean}} cancelledRef - Set to true to abort playback early.
 * @returns {Promise<void>} Resolves once the item has played.
 */
async function playItem(item, i, setTerminalLines, cancelledRef) {
  if (item.__phases) {
    await playPhases(item, i, setTerminalLines, cancelledRef);
  } else if (item.text !== null && item.text !== undefined) {
    await playPlainItem(item, i, setTerminalLines, cancelledRef);
  }
}

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
    const cancelledRef = { current: false };

    (async () => {
      // A throw partway through (e.g. a malformed intro item) must not leave
      // introPlaying stuck true forever — onInput stays nulled until reload
      // if setIntroPlaying(false) is never reached.
      try {
        for (let i = 0; i < introItems.length; i++) {
          if (cancelledRef.current) break;
          const item = introItems[i];
          await wait(item.delay);
          if (cancelledRef.current) break;
          await playItem(item, i, setTerminalLines, cancelledRef);
        }
      } catch {
        // Swallow — a malformed item shouldn't crash the boot sequence.
      } finally {
        if (!cancelledRef.current) {
          setIntroPlaying(false);
          setTimeout(() => document.querySelector(".terminal-hidden-input")?.focus(), 50);
        }
      }
    })();

    return () => { cancelledRef.current = true; };
  }, []);

  return introPlaying;
}
