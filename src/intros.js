import intros from "./intro.json";

export function getIntro(siteName) {
  const intro = intros[Math.floor(Math.random() * intros.length)];
  return intro.map((item) => ({
    ...item,
    text: item.text ? item.text.replace("{{SITE_NAME}}", siteName) : item.text,
  }));
}
