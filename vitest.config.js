import { defineConfig } from "vitest/config";

export default defineConfig({
  // Several src/**/*.js files (idle effects, hooks) use JSX; the build (webpack +
  // babel-loader) already handles that, but Vite's oxc transform only parses JSX
  // in .jsx/.tsx by default, so those files were silently unimportable by tests.
  oxc: {
    lang: "jsx",
    include: /\.[jt]sx?$/,
    exclude: [],
  },
  resolve: {
    alias: {
      "@wordpress/element": "react",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/vitest.setup.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "cobertura", "lcov"],
      reportsDirectory: "coverage",
      reportOnFailure: true,
    },
  },
});
