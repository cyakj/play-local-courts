import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

// Admin UI specs. They sign in as TEST_ADMIN_* themselves (read-only: no mutations) so they do not
// depend on the resident auth setup project. Start the app first, then:
//   PLAYWRIGHT_BASE_URL=http://localhost:8082 npx playwright test -c playwright.admin.config.ts
export default defineConfig({
  testDir: './tests',
  testMatch: /admin-.*\.ui\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  timeout: 180000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
});
