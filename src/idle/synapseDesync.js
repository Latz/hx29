import { TerminalOutput } from "react-terminal-ui";

/**
 * Idle sequence: neural sync-rate countdown with jittering chromatic aberration
 * overlay; reaching 0% clears the terminal via `ctx.clearAll()`.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').RefObject<boolean>, clearAll?:function():void}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleSynapseDesync(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef } = ctx;

  const BRACKET = '[ C H R O M A T I C   A B E R R A T I O N   E N A B L E D ]';
  const JITTER  = ['', ' ', '  '];

  append(key('l1'), '[!] ALERT: Neural-Link feedback loop stalling.');
  await wait(400);
  append(key('l2'), '[!] Biosensor status: Brainwave frequency dropping into deep delta-state.');
  await wait(600);
  append(key('l3'), '');
  await wait(200);
  append(key('l4'), "> Shifting Cyberware-Interface from 'Active Uplink' to 'Coma-Safe'");
  await wait(300);

  const syncKey    = key('sync');
  const jitterKey  = key('jitter');
  const ctaKey     = key('cta');

  let sync = 98;
  append(syncKey,   `> Sync-Rate: ${sync}% ... [SIGNAL DEGRADATION]`);
  await wait(200);
  append(key('l5'), '> Visual overlay losing chromatic alignment...');
  await wait(300);
  append(key('l6'), '');
  append(jitterKey, BRACKET);
  await wait(400);
  append(key('l7'), '');
  append(ctaKey,    '*** WARNING: Neural desync imminent. Tap any key to recalibrate the bio-link. ***');
  scrollTerminal();

  let aborted = false;
  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, true);
  });
  done.then(() => { aborted = true; });

  let jitterIdx = 0;
  let fastTick = 0;
  let lastSyncDrop = Date.now();

  while (!aborted && idleActiveRef.current) {
    await wait(80);
    if (aborted || !idleActiveRef.current) break;
    fastTick++;

    // Jitter the bracket left/right every tick
    jitterIdx = (jitterIdx + 1) % JITTER.length;
    update(jitterKey, JITTER[jitterIdx] + BRACKET);

    // Drop sync every 2 seconds
    if (Date.now() - lastSyncDrop >= 2000 && sync > 0) {
      sync = Math.max(0, sync - Math.floor(20 + Math.random() * 15));
      lastSyncDrop = Date.now();
      update(syncKey, `> Sync-Rate: ${sync}% ... [SIGNAL DEGRADATION]`);

      // At 0% — wipe the terminal
      if (sync <= 0) {
        await wait(500);
        if (!idleActiveRef.current) break;
        idleActiveRef.current = false;
        // Signal caller to clear by throwing a sentinel
        ctx.clearAll?.();
        return;
      }
    }

    scrollTerminal();
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  update(syncKey,   '> Sync-Rate: 100% ... [SIGNAL RESTORED]');
  update(jitterKey, BRACKET);
  update(ctaKey,    '*** BIO-LINK RECALIBRATED — NEURAL SYNC RESTORED ***');
  await wait(300);
  append(key('l8'), '');
  append(key('l9'), '[ OK ] Brainwave frequency stabilized. Active Uplink resumed.');
  append(key('l10'), '[ OK ] Chromatic overlay realigned. Visual feed nominal.');
  append(key('done'), '');
  scrollTerminal();
}
