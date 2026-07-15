import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4176",
    browserName: "chromium",
    headless: true,
    launchOptions: process.platform === "darwin" ? {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    } : undefined,
  },
  webServer: {
    command: "npm run dev -- --port 4176",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: !process.env.CI,
  },
});
