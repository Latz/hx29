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

// ─── Animation 2: Memory Dump Upload ─────────────────────────────────────────
export async function idleMemoryDump(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

  const USERS = ['Lars', 'Admin', 'User', 'Johannes', 'Max'];
  const user = USERS[Math.floor(Math.random() * USERS.length)];
  const FILLED = '▓';
  const PARTIAL = ['░', '▒'];
  const BAR_W = 45;

  const renderBar = (p, speed) => {
    const filled = Math.floor(p / 100 * BAR_W);
    const bar = FILLED.repeat(filled) + PARTIAL[Math.floor(Math.random() * 2)].repeat(BAR_W - filled);
    return `  [${bar}] ${p}% (${speed} MB/s)`;
  };

  append(key('l1'), '[!] TIMEOUT: Operator heartbeat lost.');
  await wait(400);
  append(key('l2'), '[!] Initiating automatic memory dump to prevent data loss.');
  await wait(700);
  append(key('l3'), '');
  await wait(300);
  append(key('l4'), `> Uploading 'C:/Users/${user}/Documents/Personal_Vault.rar' -> Tor-Node #4`);
  await wait(300);

  const barKey = key('bar');
  let pct = 0;
  append(barKey, renderBar(0, '0.0'));

  while (pct < 100 && idleActiveRef.current) {
    await wait(80 + Math.random() * 220);
    if (!idleActiveRef.current) break;
    pct = Math.min(100, pct + Math.floor(1 + Math.random() * 7));
    const speed = (8 + Math.random() * 12).toFixed(1);
    update(barKey, renderBar(pct, speed));
    scrollTerminal();
  }

  if (!idleActiveRef.current) return;

  await wait(300);
  append(key('l5'), '');
  append(key('warn'), '*** TOUCH THE DECK TO ABORT UPLINK IMMEDIATELY ***');
  scrollTerminal();

  await new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, true);
  });

  idleActiveRef.current = false;
  update(key('warn'), '*** UPLINK ABORTED BY OPERATOR ***');
  await wait(300);
  append(key('l6'), '[ OK ] Uplink terminated. Memory buffer cleared.');
  append(key('l7'), '[ OK ] Encryption keys rotated. Trace routes flushed.');
  append(key('done'), '');
  scrollTerminal();
}
