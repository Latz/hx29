import { TerminalOutput } from "react-terminal-ui";

export default async function idleVortex(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

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
