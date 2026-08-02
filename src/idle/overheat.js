import { cosmeticRandom } from "../random.js";

/**
 * Idle sequence: jittering temperature readout with a cycling voltage-dump bar,
 * resolved by a keypress triggering emergency cooling.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').RefObject<boolean>, signal:AbortSignal}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleOverheat(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef, signal } = ctx;

  const BAR_W = 43;
  const FRAMES = [
    { pct: 58, filled: Math.round(58 / 100 * BAR_W) },
    { pct: 46, filled: Math.round(46 / 100 * BAR_W) },
    { pct: 69, filled: Math.round(69 / 100 * BAR_W) },
  ];
  const renderBar = ({ pct, filled }) =>
    `  [${'█'.repeat(filled)}${'░'.repeat(BAR_W - filled)}] ${pct}% VOLTAGE DUMP`;

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  append(key('l1'), '[!] NEURAL-LINK WARNING: Idle loop detected in primary processing deck.');
  await wait(400);
  append(key('l2'), '[!] STATUS: Liquid nitrogen pump stalled. Core temperature rising.');
  await wait(600);
  append(key('l3'), '');
  await wait(200);

  const tempKey = key('temp');
  const coreKey = key('core');
  const ramKey  = key('ram');
  const barKey  = key('bar');
  const ctaKey  = key('cta');

  append(tempKey, `> [ ${now} ] - THERMAL CRITICAL: 93°C (Limit: 105°C)`);
  await wait(200);
  append(coreKey, '> Core #01 status: MELTING RISK');
  await wait(200);
  append(ramKey,  '> Shifting active RAM sectors to volatile flash cache to prevent burnout.');
  await wait(300);
  append(key('l4'), '');
  append(barKey, renderBar(FRAMES[0]));
  await wait(300);
  append(key('l5'), '');
  append(ctaKey, '*** VENTING HEAT... TOUCH KEYBOARD TO TRIGGER MANUAL EMERGENCY COOLING ***');
  scrollTerminal();

  let aborted = false;
  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, { capture: true, signal });
  });
  done.then(() => { aborted = true; });

  let frameIdx = 0;
  let tick = 0;
  while (!aborted && idleActiveRef.current) {
    await wait(150);
    if (aborted || !idleActiveRef.current) break;
    tick++;
    // temperature jitter every tick
    const temp = 93 + Math.floor(cosmeticRandom() * 5);
    update(tempKey, `> [ ${now} ] - THERMAL CRITICAL: ${temp}°C (Limit: 105°C)`);
    // bar cycles every other tick (~300ms)
    if (tick % 2 === 0) {
      frameIdx = (frameIdx + 1) % FRAMES.length;
      update(barKey, renderBar(FRAMES[frameIdx]));
    }
    scrollTerminal();
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  update(barKey, `  [${'█'.repeat(BAR_W)}] 100% VOLTAGE DUMP`);
  update(ctaKey, '*** EMERGENCY COOLING TRIGGERED — CORE TEMPERATURE DROPPING ***');
  await wait(300);
  append(key('l6'), '');
  append(key('l7'), '[ OK ] Liquid nitrogen pump restarted. Thermal threshold cleared.');
  append(key('l8'), '[ OK ] RAM sectors restored from volatile cache.');
  append(key('done'), '');
  scrollTerminal();
}
