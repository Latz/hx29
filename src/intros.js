import intros from "./intro.json";

const CORRUPT_CHARS = '▒░█▓╬╪╫╗╝╚╔║═╠╣╦╩╤╧▐▌▄▀■□▪▫◘◙';

function corrupt(text) {
  return text.split('').map(ch => {
    if (ch === ' ') return ch;
    return Math.random() < 0.45
      ? CORRUPT_CHARS[Math.floor(Math.random() * CORRUPT_CHARS.length)]
      : ch;
  }).join('');
}

export function getIntro(siteName) {
  const intro = intros[Math.floor(Math.random() * intros.length)];
  return intro.map((item) => {
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
    return {
      ...item,
      text: item.text ? item.text.replace('{{SITE_NAME}}', siteName) : item.text,
    };
  });
}
