import de from './de.js';
import en from './en.js';

const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en')
  ?.slice(0, 2).toLowerCase();

export const t = lang === 'de' ? de : en;
