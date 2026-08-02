import { useEffect, useRef } from "@wordpress/element";
import { TerminalOutput } from "react-terminal-ui";
import { scrollTerminal } from "../utils.js";
import { cosmeticRandom } from "../random.js";

const IDLE_MS = 5 * 60 * 1000;

const SEQUENCE_LOADERS = [
  () => import(/* webpackChunkName: "idle-neon", webpackPrefetch: true */ "../idle/neonFlicker").then((m) => m.default),
  () => import(/* webpackChunkName: "idle-vortex", webpackPrefetch: true */ "../idle/vortex").then((m) => m.default),
  () => import(/* webpackChunkName: "idle-melt", webpackPrefetch: true */ "../idle/bufferMelt").then((m) => m.default),
  () => import(/* webpackChunkName: "idle-cyberdeck", webpackPrefetch: true */ "../idle/cyberdeck").then((m) => m.default),
  () => import(/* webpackChunkName: "idle-overheat", webpackPrefetch: true */ "../idle/overheat").then((m) => m.default),
  () => import(/* webpackChunkName: "idle-gridglitch"*/ "../idle/gridGlitch").then((m) => m.default),
  () => import(/* webpackChunkName: "idle-synapse", webpackPrefetch: true */ "../idle/synapseDesync").then((m) => m.default),
  () => import(/* webpackChunkName: "idle-memleak", webpackPrefetch: true */ "../idle/memoryLeak").then((m) => m.default),
];

/**
 * Runs a randomly-selected idle animation sequence after 5 minutes of inactivity.
 * Sequences are lazy-loaded chunks. The timer is restarted by calling `idleTimerRef.schedule()`.
 * @param {import('react').RefObject<boolean>} introPlayingRef - True while the intro is running; delays idle start.
 * @param {import('react').RefObject<boolean>} printingRef - True while a command result is printing; delays idle start.
 * @param {function(function(Array):Array):void} setTerminalLines - React state setter for terminal lines.
 * @returns {{idleTimerRef: import('react').RefObject<ReturnType<typeof setTimeout>|null>, idleActiveRef: import('react').RefObject<boolean>}}
 */
export default function useIdleSequence(introPlayingRef, printingRef, setTerminalLines) {
  const idleTimerRef = useRef(null);
  const idleActiveRef = useRef(false);

  useEffect(() => {
    let lastSeq = -1;
    let ts = 0;
    const controller = new AbortController();

    const key = (suffix) => `idle-${ts}-${suffix}`;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const append = (k, text) => setTerminalLines((prev) => [...prev, <TerminalOutput key={k}>{text}</TerminalOutput>]);
    const findByKey = (l, k) => l?.key === k;
    const update = (k, text) => setTerminalLines((prev) => {
      const arr = [...prev];
      const i = arr.findIndex((l) => findByKey(l, k));
      if (i !== -1) arr[i] = <TerminalOutput key={k}>{text}</TerminalOutput>;
      return arr;
    });

    const pickSequence = () => {
      let pick;
      do { pick = Math.floor(cosmeticRandom() * SEQUENCE_LOADERS.length); } while (pick === lastSeq && SEQUENCE_LOADERS.length > 1);
      return pick;
    };

    const runIdleSequence = async () => {
      if (introPlayingRef.current || printingRef.current) {
        scheduleIdle();
        return;
      }
      idleActiveRef.current = true;

      const pick = pickSequence();
      lastSeq = pick;
      ts = Date.now();

      const seq = await SEQUENCE_LOADERS[pick]();
      await seq({ key, wait, append, update, scrollTerminal, idleActiveRef, signal: controller.signal });
    };

    const scheduleIdle = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(runIdleSequence, IDLE_MS);
    };

    idleTimerRef.schedule = scheduleIdle;
    scheduleIdle();

    return () => {
      clearTimeout(idleTimerRef.current);
      idleActiveRef.current = false;
      controller.abort();
    };
  }, []);

  return { idleTimerRef, idleActiveRef };
}
