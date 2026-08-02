import { cosmeticRandom } from "../random.js";

const GLITCH = '▒░█▓╬╪╫╗╝╚╔║═╠╣▐▌▄▀■';

/**
 * Randomly replaces ~45% of non-space characters with glitch glyphs.
 * @param {string} t - Input string to corrupt.
 * @returns {string} String with random characters replaced by glitch symbols.
 */
function corrupt(t) {
  return t.split('').map(ch =>
    ch !== ' ' && cosmeticRandom() < 0.45
      ? GLITCH[Math.floor(cosmeticRandom() * GLITCH.length)] : ch
  ).join('');
}

/**
 * Idle sequence: flickers a neon sign title with glitch corruption,
 * then waits for a keypress to stabilise.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').RefObject<boolean>, signal:AbortSignal}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleNeonFlicker(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef, signal } = ctx;

  const FRAME_A = '   N E O N  -  N E X U S  ::  O N L I N E';
  const SEP = '======================================================================';

  const drop = Math.floor(30 + cosmeticRandom() * 25);
  append(key('l1'), `> SYSTEM IDLE LOOP DETECTED // VOLTAGE DROP: ${drop}%`);
  await wait(400);
  append(key('l2'), '');
  await wait(200);
  append(key('sep1'), SEP);
  const signKey = key('sign');
  append(signKey, FRAME_A);
  append(key('sep2'), SEP);
  await wait(500);

  const FLICKERS = 6 + Math.floor(cosmeticRandom() * 6);
  for (let f = 0; f < FLICKERS && idleActiveRef.current; f++) {
    update(signKey, corrupt(FRAME_A));
    scrollTerminal();
    await wait(40 + cosmeticRandom() * 80);
    if (!idleActiveRef.current) break;
    update(signKey, FRAME_A);
    await wait(200 + cosmeticRandom() * 400);
  }

  if (!idleActiveRef.current) return;

  append(key('l3'), '');
  await wait(300);
  append(key('l4'), '[!] ALERT: Backlight inverter failing.');
  await wait(300);
  append(key('l5'), '[!] Power grid stuttering in District 9...');
  await wait(500);
  append(key('l6'), '');
  append(key('warn'), '*** TOUCH THE DECK TO STABILIZE THE PHOTON STREAM ***');
  scrollTerminal();

  await new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, { capture: true, signal });
  });

  idleActiveRef.current = false;
  update(signKey, FRAME_A);
  update(key('warn'), '*** PHOTON STREAM STABILIZED ***');
  await wait(300);
  append(key('l7'), '[ OK ] Voltage restored. Carrier signal nominal.');
  append(key('l8'), '[ OK ] District 9 grid back online. All systems green.');
  append(key('done'), '');
  scrollTerminal();
}
