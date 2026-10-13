#!/usr/bin/env node
/**
 * Capture a signed-in browser session for end-to-end tests WITHOUT the password ever passing through
 * the terminal, a script argument, an environment variable, or an AI assistant.
 *
 *   node scripts/capture-session.cjs reviewer      -> .playwright/reviewer.json
 *   node scripts/capture-session.cjs admin         -> .playwright/admin.json
 *
 * What happens: the app is started in community mode on :8082 if it is not already running, a REAL
 * (visible) browser window opens on the login page, and YOU type your email and password into it.
 * When the app navigates away from /login the session is saved to .playwright/<name>.json
 * (git-ignored: it holds a live access + refresh token, treat it like a password) and the window closes.
 * Nothing is read from or written to .env, and the password is never seen by this script.
 *
 * Revoke a captured session at any time with: Supabase dashboard > Authentication > Users > the user >
 * "Sign out" (or just delete the file; the refresh token expires on its own).
 */
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.cwd(), 'node_modules', '@playwright', 'test'));

const name = process.argv[2];
if (!/^[a-z][a-z0-9-]{1,30}$/.test(name || '')) {
  console.error('Usage: node scripts/capture-session.cjs <name>   e.g. reviewer');
  process.exit(2);
}
const PORT = 8082;
const BASE = `http://localhost:${PORT}`;
const out = path.join('.playwright', `${name}.json`);

function portOpen() {
  return new Promise((resolve) => {
    const s = net.connect(PORT, '127.0.0.1');
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}

(async () => {
  let server = null;
  if (!(await portOpen())) {
    console.log(`Starting the app on :${PORT} (community mode)...`);
    server = spawn('npx', ['expo', 'start', '--web', '--port', String(PORT)], {
      shell: true, stdio: 'ignore', env: { ...process.env, EXPO_PUBLIC_PRODUCT_MODE: 'community' },
    });
    for (let i = 0; i < 120 && !(await portOpen()); i += 1) await new Promise((r) => setTimeout(r, 2000));
    if (!(await portOpen())) { console.error('The app did not start in time.'); process.exit(1); }
  }

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  console.log('\n>>> Sign in as the', name, 'account in the browser window that just opened.');
  console.log('>>> You have 10 minutes. Do not close the window; it closes itself when you are signed in.\n');

  await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(4000); // let the role redirect and token persistence settle
  fs.mkdirSync('.playwright', { recursive: true });
  await ctx.storageState({ path: out });

  // Report only non-secret facts: where the app routed you, and the first 8 chars of the user id.
  const state = JSON.parse(fs.readFileSync(out, 'utf8'));
  let sub = '(not found)';
  for (const o of state.origins || []) {
    for (const it of o.localStorage || []) {
      if (/auth-token/.test(it.name)) {
        try {
          const v = JSON.parse(it.value);
          sub = JSON.parse(Buffer.from(v.access_token.split('.')[1], 'base64').toString()).sub.slice(0, 8);
        } catch { /* ignore */ }
      }
    }
  }
  console.log(`Saved ${out}`);
  console.log(`Landed on: ${new URL(page.url()).pathname}`);
  console.log(`Signed-in user id starts with: ${sub}`);
  await browser.close();
  if (server) server.kill();
  process.exit(0);
})().catch((e) => { console.error('Capture failed:', e.message); process.exit(1); });
