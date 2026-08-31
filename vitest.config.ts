import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/**", "node_modules/**"],
    setupFiles: ["./src/test/setup.ts"],
    reporters: ["default", "junit"],
    outputFile: {
      junit: "./junit-report.xml",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        "src/test/**",
        "**/*.d.ts",
        "tests/**", // Playwright E2E
        "src/vite-env.d.ts",
      ],
    },
  },
});
