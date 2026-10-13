import { defineConfig } from '@playwright/test';

// Node-only logic tests: no web server, no browser, no auth, no network.
//   npx playwright test -c playwright.logic.config.ts
export default defineConfig({
  testDir: './tests',
  testMatch: /.*-logic\.spec\.ts/,
  reporter: 'list',
  timeout: 30000,
});
