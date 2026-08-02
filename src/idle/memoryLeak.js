import { cosmeticRandom } from "../random.js";

/**
 * Idle sequence: visually "shreds" a list of filenames character-by-character,
 * simulating a forced RAM purge until the user interrupts.
 * @param {{key:function(string):string, wait:function(number):Promise<void>, append:function(string,*):void, update:function(string,*):void, scrollTerminal:function():void, idleActiveRef:import('react').RefObject<boolean>, signal:AbortSignal}} ctx - Idle sequence context.
 * @returns {Promise<void>}
 */
export default async function idleMemoryLeak(ctx) {
  const { key, wait, append, update, scrollTerminal, idleActiveRef, signal } = ctx;

  const FILES = [
    'neon_glow_render_effects.dll',
    'local_proxy_mask.bin',
    'neural_uplink_cache.dat',
    'cyberware_api_bridge.so',
    'grid_texture_atlas_v2.pak',
  ];
  const BAR_W = 10;
  const HASH = '#';

  /**
   * Renders a shred-progress bar.
   * @param {number} destroyed - Number of characters already destroyed.
   * @param {number} total - Total characters in the filename.
   * @returns {string} Bracket-enclosed progress bar string.
   */
  const renderProgress = (destroyed, total) => {
    const filled = Math.round(destroyed / total * BAR_W);
    return `[${'▒'.repeat(filled)}${'░'.repeat(BAR_W - filled)}]`;
  };

  append(key('l1'), '[!] NOTICE: Operator heartbeat timeout. Reclaiming unallocated cyber-deck memory.');
  await wait(400);
  append(key('l2'), "[!] Initiating forced RAM-purge via 'Neon-Shredder' v4.9");
  await wait(600);
  append(key('l3'), '');
  await wait(200);
  append(key('l4'), '> Dissolving interface assets...');
  await wait(400);

  const fileKey = key('file');
  const barKey  = key('bar');
  const ctaKey  = key('cta');

  append(fileKey, '');
  append(barKey,  '');
  await wait(200);
  append(key('l5'), '');
  append(key('l6'), '> If memory allocation hits 0%, the session will collapse into cyber-space.');
  await wait(400);
  append(key('l7'), '');
  append(ctaKey, '*** STRIKE KEYBOARD TO HALT THE DIGITAL GARBAGE COLLECTOR ***');
  scrollTerminal();

  let aborted = false;
  const done = new Promise((res) => {
    const onKey = () => { document.removeEventListener('keydown', onKey, true); res(); };
    document.addEventListener('keydown', onKey, { capture: true, signal });
  });
  done.then(() => { aborted = true; });

  for (const file of FILES) {
    if (aborted || !idleActiveRef.current) break;

    // Show full filename, wait before shredding
    update(fileKey, `  [PURGING]: ${file}`);
    update(barKey,  `  [STATUS ]: ${renderProgress(0, file.length)}`);
    scrollTerminal();
    await wait(600);

    // Shred right-to-left
    let destroyed = 0;
    while (destroyed < file.length && idleActiveRef.current) {
      const interrupted = await Promise.race([wait(50).then(() => false), done.then(() => true)]);
      if (interrupted || !idleActiveRef.current) break;
      destroyed = Math.min(file.length, destroyed + Math.floor(1 + cosmeticRandom() * 3));
      const visible = file.slice(0, file.length - destroyed);
      const hashes  = HASH.repeat(destroyed);
      update(fileKey, `  [PURGING]: ${visible}${hashes}`);
      update(barKey,  `  [STATUS ]: ${renderProgress(destroyed, file.length)}`);
      scrollTerminal();
    }

    if (aborted || !idleActiveRef.current) break;

    // Show wiped state briefly
    update(fileKey, `  [PURGING]: [ WIPED FROM RAM ]`);
    update(barKey,  `  [STATUS ]: ${'█'.repeat(BAR_W)} CLEARED`);
    scrollTerminal();
    await wait(400);
  }

  if (!idleActiveRef.current) return;
  idleActiveRef.current = false;

  update(ctaKey, '*** GARBAGE COLLECTOR HALTED — MEMORY SECTORS SEALED ***');
  await wait(300);
  append(key('l8'), '');
  append(key('l9'), '[ OK ] RAM-purge aborted. Interface assets preserved.');
  append(key('l10'), '[ OK ] Neon-Shredder v4.9 suspended. Session integrity intact.');
  append(key('done'), '');
  scrollTerminal();
}
