import { defineConfig } from "vitest/config";

// Only the pure, framework-free logic under src/onboarding (and any future
// src/**/*.test.ts that avoids React Native imports) is unit-tested here.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
