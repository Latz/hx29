import { TerminalOutput } from "react-terminal-ui";

const GLITCH = '▒░█▓╬╪╫╗╝╚╔║═╠╣▐▌▄▀■';

function corrupt(t) {
  return t.split('').map(ch =>
    ch !== ' ' && Math.random() < 0.45
      ? GLITCH[Math.floor(Math.random() * GLITCH.length)] : ch
  ).join('');
}

// ─── Animation 1: Neon Sign Flickering ───────────────────────────────────────
export async function idleNeonFlicker(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

  const FRAME_A = '   N E O N  -  N E X U S  ::  O N L I N E';
  const SEP = '======================================================================';

  const drop = Math.floor(30 + Math.random() * 25);
  append(key('l1'), `> SYSTEM IDLE LOOP DETECTED // VOLTAGE DROP: ${drop}%`);
  await wait(400);
  append(key('l2'), '');
  await wait(200);
  append(key('sep1'), SEP);
  const signKey = key('sign');
  append(signKey, FRAME_A);
  append(key('sep2'), SEP);
  await wait(500);

  const FLICKERS = 6 + Math.floor(Math.random() * 6);
  for (let f = 0; f < FLICKERS && idleActiveRef.current; f++) {
    update(signKey, corrupt(FRAME_A));
    scrollTerminal();
    await wait(40 + Math.random() * 80);
    if (!idleActiveRef.current) break;
    update(signKey, FRAME_A);
    await wait(200 + Math.random() * 400);
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
    document.addEventListener('keydown', onKey, true);
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

// ─── Animation 2: Network Vortex ─────────────────────────────────────────────
export async function idleVortex(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

  // Vortex frames: 4 rotational states for both spinner and box shape
  const SPINNERS = ['|', '/', '-', '\\'];
  const VORTEX_FRAMES = [
    ['        / \\ ', '       /   \\    ', '       \\   /    ', '        \\ / '],
    ['        | | ', '       |   |    ', '       |   |    ', '        | | '],
    ['        \\ / ', '       \\   /    ', '       /   \\    ', '        / \\ '],
    ['        - - ', '       -   -    ', '       -   -    ', '        - - '],
  ];

  append(key('l1'), '[!] NOTICE: Neural pipeline sitting idle.');
  await wait(400);
  append(key('l2'), '[!] Routing ambient background noise into the vortex...');
  await wait(600);
  append(key('l3'), '');
  await wait(200);

  // Append the 4 vortex lines + status line
  const vk = [key('v0'), key('v1'), key('v2'), key('v3')];
  const statusKey = key('status');
  const threadKey = key('thread');

  VORTEX_FRAMES[0].forEach((line, i) => append(vk[i], line));
  append(statusKey, '');
  append(threadKey, '');
  scrollTerminal();

  // Animate until keypress
  let frame = 0;
  let buf = 0;

  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, true);
  });

  let aborted = false;
  done.then(() => { aborted = true; });

  while (!aborted && idleActiveRef.current) {
    frame = (frame + 1) % 4;
    buf = Math.min(100, buf + Math.floor(1 + Math.random() * 4));
    const spinner = SPINNERS[frame];
    const vf = VORTEX_FRAMES[frame];

    vf.forEach((line, i) => update(vk[i], line));
    update(statusKey, `       [   ${spinner}   ]  CYCLING DATA PORT_FALLBACK    Buffer fill: ${buf}%`);
    if (buf > 30 && frame % 2 === 0) {
      const thread = Math.floor(Math.random() * 16).toString().padStart(2, '0');
      update(threadKey, `> Thread #${thread} spinning out of sync...`);
    }
    scrollTerminal();
    await wait(100);
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  // Replace warn line, show resolution
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
