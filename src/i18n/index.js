import de from './de.js';
import en from './en.js';

const wpLocale = typeof window !== 'undefined' ? window.hx29?.locale : undefined;
const browserLocale = typeof navigator !== 'undefined' ? navigator.language : 'en';
const lang = (wpLocale ?? browserLocale)?.slice(0, 2).toLowerCase();

export const t = lang === 'de' ? de : en;
