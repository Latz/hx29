import intros from "./intro.json";
import returning from "./returning.json";
import { t } from "./i18n/index.js";

const CORRUPT_CHARS = '▒░█▓╬╪╫╗╝╚╔║═╠╣╦╩╤╧▐▌▄▀■□▪▫◘◙';

/**
 * Randomly replaces ~45% of non-space characters with box-drawing glitch glyphs.
 * @param {string} text - Input text.
 * @returns {string} Corrupted text string.
 */
function corrupt(text) {
  return text.split('').map(ch => {
    if (ch === ' ') return ch;
    return Math.random() < 0.45
      ? CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)]
      : ch;
  }).join('');
}

/**
 * Expands `{{var}}` placeholders in an intro item's text, and wraps phased items
 * with a corruption middle-frame for a glitch transition effect.
 * @param {{text?:string,delay:number,__phases?:Array<{text:string,hold:number}>}} item - Raw intro item.
 * @param {Object<string,string>} vars - Placeholder → value map.
 * @returns {{text?:string,delay:number,__phases?:Array<{text:string,hold:number}>}} Expanded item.
 */
function expandItem(item, vars) {
  if (item.__phases) {
    const first = item.__phases[0];
    const last = item.__phases[item.__phases.length - 1];
    return {
      ...item,
      __phases: [
        { text: first.text, hold: 200 + Math.floor(Math.random() * 300) },
        { text: corrupt(first.text), hold: 100 + Math.floor(Math.random() * 200) },
        { text: last.text, hold: last.hold },
      ],
    };
  }
  if (!item.text) return item;
  let text = item.text;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{{${k}}}`, v);
  }
  return { ...item, text };
}

/**
 * Loads or initialises persistent session data from `localStorage`:
 * a stable visitor signature, visit count, and last-visit timestamp.
 * Increments the visit counter once per hour.
 * @returns {{sig:string, visits:number, lastVisit:string|null}}
 */
function loadSession() {
  let sig = localStorage.getItem('hx29_sig');
  if (!sig) {
    const rnd = new Uint32Array(1);
    crypto.getRandomValues(rnd);
    sig = 'SIG-' + rnd[0].toString(16).slice(0, 6).toUpperCase();
    localStorage.setItem('hx29_sig', sig);
  }
  const lastVisit = localStorage.getItem('hx29_last_visit') || null;
  const hourPassed = lastVisit && (Date.now() - new Date(lastVisit)) >= 3600_000;
  const isFirstVisit = !lastVisit;
  let visits = parseInt(localStorage.getItem('hx29_visits') || '0', 10);
  if (isFirstVisit || hourPassed) {
    visits += 1;
    localStorage.setItem('hx29_visits', visits);
    localStorage.setItem('hx29_last_visit', new Date().toISOString());
  }
  return { sig, visits: Math.max(visits, 1), lastVisit };
}

/**
 * Returns a localised relative time string for an ISO timestamp (e.g. "3 minutes ago").
 * @param {string} isoStr - ISO 8601 date string.
 * @returns {string} Localised relative time description.
 */
function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60)    return t.time_seconds_ago(diff);
  if (diff < 3600)  return t.time_minutes_ago(Math.floor(diff / 60));
  if (diff < 86400) return t.time_hours_ago(Math.floor(diff / 3600));
  return t.time_days_ago(Math.floor(diff / 86400));
}

/**
 * Formats an ISO timestamp as `YYYY-MM-DD HH:MM:SS` (Swedish locale, space separator).
 * @param {string} isoStr - ISO 8601 date string.
 * @returns {string} Formatted timestamp string.
 */
function formatTs(isoStr) {
  return new Date(isoStr).toLocaleString('sv-SE').slice(0, 19).replace('T', ' ');
}

/**
 * Returns the intro sequence and visit stage for the current session.
 * Selects the appropriate returning-visitor stage (1–4) from `returning.json`
 * and expands all template variables.
 * @param {string} siteName - Site name injected via `window.hx29.site_name`.
 * @returns {{stage:number, items:Array<{text?:string,delay:number,__phases?:Array}>}} Stage number and expanded intro items.
 */
export function getSessionIntro(siteName) {
  const { sig, visits, lastVisit } = loadSession();
  const stage = Math.min(visits, 4);
  const stageData = returning.find(s => s.stage === stage);
  const vars = {
    SIG: sig,
    VISITS: visits,
    SITE_NAME: siteName,
    LAST_VISIT: lastVisit ? formatTs(lastVisit) : '---',
    TIME_AGO: lastVisit ? timeAgo(lastVisit) : '---',
    HELP_TIP: t.help_tip_boot,
  };
  return { stage, items: stageData.items.map(item => expandItem(item, vars)) };
}

/**
 * Returns a randomly selected intro sequence from `intro.json` with variables expanded.
 * @param {string} siteName - Site name for `{{SITE_NAME}}` substitution.
 * @returns {Array<{text?:string,delay:number,__phases?:Array}>} Expanded intro items.
 */
export function getIntro(siteName) {
  const intro = intros[Math.floor(Math.random() * intros.length)];
  return intro.map(item => expandItem(item, { SITE_NAME: siteName, HELP_TIP: t.help_tip_boot }));
}
