import { TerminalOutput } from "react-terminal-ui";

/**
 * Idle sequence: scrolling ticker, hex-swap, and glitch-code animation
 * simulating grid noise leaking into the TTY stream.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').MutableRefObject<boolean>}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleGridGlitch(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

  const GLITCH = '▒░█▓╬╪╫╗╝╚╔║═╠╣▐▌▄▀■';
  const HEX_VALS = ['FF', 'AA', '3C', 'D4', 'B7', '0E', 'F2', '91'];
  const CODES = ['404_SUBNET_MAPPED', 'GATE_WAY_ERR', 'NULL_POINTER', 'SEG_FAULT_0x9', 'OVERFLOW_TTY'];
  const TICKER = 'Neon-District billboards switching to mainframe override...';

  /**
   * Generates a random string of block/box-drawing glitch characters.
   * @param {number} len - Number of characters to generate.
   * @returns {string} Random glitch character string of the given length.
   */
  const randGlitch = (len) => Array.from({ length: len }, () =>
    GLITCH[Math.floor(Math.random() * GLITCH.length)]
  ).join('');

  append(key('l1'), '> CRITICAL: Sub-net barrier degrading due to operator inactivity.');
  await wait(400);
  append(key('l2'), '> Raw Grid-Noise is leaking into local TTY stream...');
  await wait(600);
  append(key('l3'), '');
  await wait(200);

  const hexKey    = key('hex');
  const tickerKey = key('ticker');
  const codeKey   = key('code');

  append(hexKey,    `  \\x00\\xFF --> [NEO_CITY_TRAFFIC_FEED] -> STACK OVERFLOW`);
  await wait(200);
  append(tickerKey, `  [${new Date().toTimeString().slice(0,8)}] INTERCEPT: "${TICKER.slice(0, 40)}"`);
  await wait(200);
  append(codeKey,   `  \\x09\\x12 [GLITCH] █▓▒░░ ${CODES[0]} ░░▒▓█`);
  await wait(300);
  append(key('l4'), '');
  append(key('l5'), '> Terminal interface drowning in raw telemetry packets.');
  await wait(200);
  append(key('l6'), '> Dropping unhandled data packets to buffer_0x7...');
  await wait(400);
  append(key('l7'), '');
  append(key('cta'), '*** TOUCH INPUT TO RE-INITIALIZE THE FIREWALL RECEPTORS ***');
  scrollTerminal();

  let aborted = false;
  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, true);
  });
  done.then(() => { aborted = true; });

  let tickerOffset = 0;
  let tick = 0;
  while (!aborted && idleActiveRef.current) {
    await wait(100);
    if (aborted || !idleActiveRef.current) break;
    tick++;

    // Hex swap every tick
    const h1 = HEX_VALS[Math.floor(Math.random() * HEX_VALS.length)];
    const h2 = HEX_VALS[Math.floor(Math.random() * HEX_VALS.length)];
    update(hexKey, `  \\x00\\x${h1} --> [NEO_CITY_TRAFFIC_FEED] -> STACK OVERFLOW`);

    // Ticker scroll every tick
    tickerOffset = (tickerOffset + 1) % TICKER.length;
    const scrolled = (TICKER + TICKER).slice(tickerOffset, tickerOffset + 40);
    update(tickerKey, `  [${new Date().toTimeString().slice(0,8)}] INTERCEPT: "${scrolled}"`);

    // Code swap every 3 ticks (~300ms)
    if (tick % 3 === 0) {
      const code = CODES[Math.floor(Math.random() * CODES.length)];
      const g1 = randGlitch(5);
      const g2 = randGlitch(5);
      update(codeKey, `  \\x09\\x12 [GLITCH] ${g1} ${code} ${g2}`);
    }

    scrollTerminal();
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  update(codeKey,   '  \\x09\\x12 [GLITCH] █████ FIREWALL_RESTORED █████');
  update(key('cta'), '*** FIREWALL RECEPTORS ONLINE — GRID NOISE FILTERED ***');
  await wait(300);
  append(key('l8'), '');
  append(key('l9'), '[ OK ] Sub-net barrier restored. TTY stream clean.');
  append(key('l10'), '[ OK ] Telemetry packets routed to /dev/null.');
  append(key('done'), '');
  scrollTerminal();
}
