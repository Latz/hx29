import { cosmeticRandom } from "../random.js";

/**
 * Idle sequence: spinning ASCII vortex with a buffer-fill counter and
 * thread-desync messages, dismissed by any keypress.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').RefObject<boolean>, signal:AbortSignal}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleVortex(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef, signal } = ctx;

  // A single trailing backslash can't be expressed via String.raw (a lone
  // backslash immediately before the closing backtick escapes the delimiter
  // instead of terminating the string), so this stays an escaped string.
  const SPINNERS = ['|', '/', '-', '\\']; // NOSONAR javascript:S7780
  const VORTEX_FRAMES = [
    [String.raw`        / \ `, String.raw`       /   \    `, String.raw`       \   /    `, String.raw`        \ / `],
    ['        | | ', '       |   |    ', '       |   |    ', '        | | '],
    [String.raw`        \ / `, String.raw`       \   /    `, String.raw`       /   \    `, String.raw`        / \ `],
    ['        - - ', '       -   -    ', '       -   -    ', '        - - '],
  ];

  append(key('l1'), '[!] NOTICE: Neural pipeline sitting idle.');
  await wait(400);
  append(key('l2'), '[!] Routing ambient background noise into the vortex...');
  await wait(600);
  append(key('l3'), '');
  await wait(200);

  const vk = [key('v0'), key('v1'), key('v2'), key('v3')];
  const statusKey = key('status');
  const threadKey = key('thread');

  VORTEX_FRAMES[0].forEach((line, i) => append(vk[i], line));
  append(statusKey, '');
  append(threadKey, '');
  scrollTerminal();

  let frame = 0;
  let buf = 0;

  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, { capture: true, signal });
  });

  while (idleActiveRef.current) {
    frame = (frame + 1) % 4;
    buf = Math.min(100, buf + Math.floor(1 + cosmeticRandom() * 4));
    const spinner = SPINNERS[frame];
    const vf = VORTEX_FRAMES[frame];

    vf.forEach((line, i) => update(vk[i], line));
    update(statusKey, `       [   ${spinner}   ]  CYCLING DATA PORT_FALLBACK    Buffer fill: ${buf}%`);
    if (buf > 30 && frame % 2 === 0) {
      const thread = Math.floor(cosmeticRandom() * 16).toString().padStart(2, '0');
      update(threadKey, `> Thread #${thread} spinning out of sync...`);
    }
    scrollTerminal();
    const interrupted = await Promise.race([wait(100).then(() => false), done.then(() => true)]);
    if (interrupted || !idleActiveRef.current) break;
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  update(vk[0], '        * * ');
  update(vk[1], '       *   *    [ VORTEX COLLAPSED ]');
  update(vk[2], '       *   *    ');
  update(vk[3], '        * * ');
  update(statusKey, '');
  update(threadKey, '');
  await wait(300);
  append(key('l4'), '');
  append(key('l5'), '[ OK ] Vortex dissipated. Ambient noise rerouted to /dev/null.');
  append(key('l6'), '[ OK ] Neural pipeline flushed. Thread synchronization restored.');
  append(key('done'), '');
  scrollTerminal();
}
