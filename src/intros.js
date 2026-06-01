import intros from "./intro.json";
import returning from "./returning.json";

const CORRUPT_CHARS = '▒░█▓╬╪╫╗╝╚╔║═╠╣╦╩╤╧▐▌▄▀■□▪▫◘◙';

function corrupt(text) {
  return text.split('').map(ch => {
    if (ch === ' ') return ch;
    return Math.random() < 0.45
      ? CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)]
      : ch;
  }).join('');
}

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

function loadSession() {
  let sig = localStorage.getItem('hx29_sig');
  if (!sig) {
    sig = 'SIG-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('hx29_sig', sig);
  }
  const visits = parseInt(localStorage.getItem('hx29_visits') || '0', 10) + 1;
  localStorage.setItem('hx29_visits', visits);
  const lastVisit = localStorage.getItem('hx29_last_visit') || null;
  localStorage.setItem('hx29_last_visit', new Date().toISOString());
  return { sig, visits, lastVisit };
}

function timeAgo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60)    return `${diff} seconds ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function formatTs(isoStr) {
  return new Date(isoStr).toLocaleString('sv-SE').slice(0, 19).replace('T', ' ');
}

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
  };
  return stageData.items.map(item => expandItem(item, vars));
}

export function getIntro(siteName) {
  const intro = intros[Math.floor(Math.random() * intros.length)];
  return intro.map(item => expandItem(item, { SITE_NAME: siteName }));
}
