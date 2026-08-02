import { useEffect } from "@wordpress/element";
import { cosmeticRandom } from "../random.js";

/**
 * Periodically adds the `hum-bar-active` class to `<html>` to trigger a CRT
 * horizontal-hum CSS animation (every 60–120 s, lasting 3.1 s each time).
 * @returns {void}
 */
export default function useHumBar() {
  useEffect(() => {
    const runHumBar = () => {
      document.documentElement.classList.add("hum-bar-active");
      setTimeout(() => document.documentElement.classList.remove("hum-bar-active"), 3100);
      setTimeout(runHumBar, 60000 + cosmeticRandom() * 60000);
    };
    const t = setTimeout(runHumBar, 60000 + cosmeticRandom() * 60000);
    return () => clearTimeout(t);
  }, []);
}
