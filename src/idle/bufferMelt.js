import { cosmeticRandom } from "../random.js";

/**
 * Idle sequence: progressively corrupts a status string with block-drawing glyphs
 * until the user presses a key, then restores it.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').RefObject<boolean>, signal:AbortSignal}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleBufferMelt(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef, signal } = ctx;

  const DROPS = ['░', '▒', '█', '▓'];
  const ORIGIN = 'GRID_STATUS: STABLE_CONNECTIVITY_ESTABLISHED';

  /**
   * Randomly replaces non-space characters with block-drawing glyphs.
   * @param {string[]} chars - Current character array.
   * @param {number} intensity - Controls how many characters are replaced per frame.
   * @returns {string[]} New character array with some positions melted.
   */
  const melt = (chars, intensity) => {
    const out = [...chars];
    const candidates = out.reduce((acc, ch, i) => {
      if (ch !== ' ' && !DROPS.includes(ch)) acc.push(i);
      return acc;
    }, []);
    const count = Math.min(3 + Math.floor(cosmeticRandom() * (intensity + 2)), candidates.length);
    for (let n = 0; n < count; n++) {
      const idx = candidates.splice(Math.floor(cosmeticRandom() * candidates.length), 1)[0];
      out[idx] = DROPS[Math.floor(cosmeticRandom() * DROPS.length)];
    }
    return out;
  };

  append(key('l1'), '> CRITICAL: Sub-net barrier degrading.');
  await wait(400);
  append(key('l2'), '> Terminal buffer memory is leaking down the grid...');
  await wait(600);
  append(key('l3'), '');
  await wait(300);

  const lineKey = key('melt');
  let chars = ORIGIN.split('');
  append(lineKey, chars.join(''));
  await wait(500);
  append(key('l4'), '');
  append(key('warn'), '[!] Connection drowning in raw entropy.');
  await wait(400);
  append(key('l5'), '');
  append(key('cta'), '*** STRIKE KEYBOARD TO DRY THE BUFFER ***');
  scrollTerminal();

  let aborted = false;
  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, { capture: true, signal });
  });
  done.then(() => { aborted = true; });

  let frame = 0;
  while (!aborted && idleActiveRef.current) {
    await wait(150);
    if (aborted || !idleActiveRef.current) break;
    chars = melt(chars, Math.floor(frame / 3));
    update(lineKey, chars.join(''));
    scrollTerminal();
    frame++;
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  update(lineKey, ORIGIN);
  update(key('cta'), '*** BUFFER DRIED — GRID RESTORED ***');
  await wait(200);
  append(key('l6'), '');
  append(key('l7'), '[ OK ] Buffer dried. Grid connectivity re-established.');
  append(key('l8'), '[ OK ] Sub-net barrier integrity restored.');
  append(key('done'), '');
  scrollTerminal();
}
