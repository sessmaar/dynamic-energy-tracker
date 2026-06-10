import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/__tests__/**/*.test.ts"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./lib/__tests__/setup.ts"],
  },
});
