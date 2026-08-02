/**
 * Non-cryptographic randomness for cosmetic terminal effects (glitch text,
 * idle animation timing/jitter). Never used for security-sensitive values,
 * so `Math.random` is intentional here rather than `crypto.getRandomValues`.
 * @returns {number} Pseudorandom float in [0, 1).
 */
export function cosmeticRandom() {
  return Math.random(); // NOSONAR javascript:S2245 - cosmetic use only, not security-sensitive
}
