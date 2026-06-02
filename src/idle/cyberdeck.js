import { TerminalOutput } from "react-terminal-ui";

/**
 * Idle sequence: oscillating temperature bar (cyberdeck overheat heartbeat)
 * waiting for a keypress to discharge.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').RefObject<boolean>}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleCyberdeck(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

  const BAR_W = 24;
  const FILLED = '█';
  const EMPTY = '░';

  // Heartbeat wave: pct oscillates 60→84→60
  const WAVE = [60, 66, 72, 78, 84, 78, 72, 66, 60, 60];

  /**
   * Renders the temperature bar line.
   * @param {number} pct - Temperature percentage (0–100).
   * @returns {string} Formatted bar string with percentage and status label.
   */
  const renderBar = (pct) => {
    const filled = Math.round(pct / 100 * BAR_W);
    const bar = FILLED.repeat(filled) + EMPTY.repeat(BAR_W - filled);
    const level = pct >= 80 ? 'CRITICAL!!' : pct >= 70 ? 'WARNING   ' : 'ELEVATED  ';
    return `CORE-TEMP: [${bar}] ${pct}% // ${level}`;
  };

  /**
   * Returns a separator line style based on whether temperature is critical.
   * @param {number} pct - Temperature percentage.
   * @returns {string} `=` separator at critical levels, `-` separator otherwise.
   */
  const renderSep = (pct) => pct >= 80
    ? '=================================================='
    : '--------------------------------------------------';

  append(key('l1'), '[!] OVERHEATING PROTOCOL ENGAGED [!]');
  await wait(500);
  append(key('l2'), '');
  await wait(200);

  const barKey = key('bar');
  const sepKey = key('sep');
  append(barKey, renderBar(WAVE[0]));
  append(sepKey, renderSep(WAVE[0]));
  await wait(400);
  append(key('l3'), '');
  append(key('l4'), '> System breathing rate is syncing with your deck\'s capacitor...');
  await wait(500);
  append(key('l5'), '');
  append(key('cta'), '*** TAP ANY KEY TO DISCHARGE THE CYBERDECK ***');
  scrollTerminal();

  let aborted = false;
  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, true);
  });
  done.then(() => { aborted = true; });

  let waveIdx = 0;
  while (!aborted && idleActiveRef.current) {
    waveIdx = (waveIdx + 1) % WAVE.length;
    const pct = WAVE[waveIdx];
    update(barKey, renderBar(pct));
    update(sepKey, renderSep(pct));
    scrollTerminal();
    // slower at peaks, faster in middle — mimics a heartbeat
    const atPeak = pct >= 84 || pct <= 60;
    await wait(atPeak ? 300 : 150);
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  update(barKey, `CORE-TEMP: [${'█'.repeat(BAR_W)}] 100% // DISCHARGED`);
  update(sepKey, '--------------------------------------------------');
  update(key('cta'), '*** CYBERDECK DISCHARGED — THERMAL EQUILIBRIUM RESTORED ***');
  await wait(300);
  append(key('l6'), '');
  append(key('l7'), '[ OK ] Core temperature nominal. Capacitors flushed.');
  append(key('l8'), '[ OK ] Thermal throttle released. All cores online.');
  append(key('done'), '');
  scrollTerminal();
}
