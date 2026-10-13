import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

// End-to-end specs for community messaging, Platform Admin approval and their authorisation boundaries.
//
//   node scripts/capture-session.cjs reviewer      (once: YOU sign in as the platform reviewer in a real window)
//   npx playwright test -c playwright.e2e.config.ts
//
// SAFETY: these specs only use the community Messages screens, the HOA application flow and direct REST calls.
// They never create bookings, never open booking/maintenance flows and never call an edge function, so no email,
// SMS or push notification can be triggered. Rows they create are prefixed "e2e-" so they can be removed after.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  timeout: 240000,
  use: {
    baseURL: 'http://localhost:8082',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx expo start --web --port 8082',
    url: 'http://localhost:8082',
    reuseExistingServer: true,
    timeout: 300000,
    env: { EXPO_PUBLIC_PRODUCT_MODE: 'community' },
  },
});
