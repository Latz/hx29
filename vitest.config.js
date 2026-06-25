import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@wordpress/element": "react",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "cobertura"],
      reportsDirectory: "coverage",
      reportOnFailure: true,
    },
  },
});
