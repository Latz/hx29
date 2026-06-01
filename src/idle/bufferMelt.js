import { TerminalOutput } from "react-terminal-ui";

export default async function idleBufferMelt(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

  const DROPS = ['░', '▒', '█', '▓'];
  const ORIGIN = 'GRID_STATUS: STABLE_CONNECTIVITY_ESTABLISHED';

  const melt = (chars, intensity) => {
    const out = [...chars];
    const candidates = out.reduce((acc, ch, i) => {
      if (ch !== ' ' && !DROPS.includes(ch)) acc.push(i);
      return acc;
    }, []);
    const count = Math.min(3 + Math.floor(Math.random() * (intensity + 2)), candidates.length);
    for (let n = 0; n < count; n++) {
      const idx = candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0];
      out[idx] = DROPS[Math.floor(Math.random() * DROPS.length)];
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
    document.addEventListener('keydown', onKey, true);
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
