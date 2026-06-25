import { expect } from "vitest";

expect.extend({
  toContainLineWithText(received, text) {
    const pass = Array.isArray(received) && received.some((l) => typeof l === "string" && l.includes(text));
    return {
      pass,
      message: () =>
        `expected output to ${pass ? "not " : ""}contain a line with "${text}"\n` +
        `Received: ${JSON.stringify(received?.filter((l) => typeof l === "string").slice(0, 5))}`,
    };
  },

  toContainLineMatching(received, re) {
    const pass = Array.isArray(received) && received.some((l) => typeof l === "string" && re.test(l));
    return {
      pass,
      message: () =>
        `expected output to ${pass ? "not " : ""}contain a line matching ${re}`,
    };
  },

  toHavePagerType(received, expectedType) {
    const actual = received?.current?.type;
    const pass = actual === expectedType;
    return {
      pass,
      message: () =>
        `expected pager type to be "${expectedType}", got "${actual}"`,
    };
  },

  toHavePagerPage(received, expectedPage) {
    const actual = received?.current?.page;
    const pass = actual === expectedPage;
    return {
      pass,
      message: () =>
        `expected pager page to be ${expectedPage}, got ${actual}`,
    };
  },
});
