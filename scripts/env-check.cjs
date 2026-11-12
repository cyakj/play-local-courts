#!/usr/bin/env node
'use strict';
/**
 * Safe .env diagnostics: prints which variable NAMES are present, empty or
 * missing. It never prints a value, a prefix, or a length.
 *
 *   node scripts/env-check.cjs            (checks ./.env)
 *   node scripts/env-check.cjs <file>     (checks another dotenv-style file)
 *
 * Exit code: 0 when every required name is set, 1 otherwise, 2 if the file is missing.
 * Claude Code is configured to deny direct reads of .env files; use this instead.
 */
const fs = require('fs');
const path = require('path');

const REQUIRED = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_PRODUCT_MODE',
  'EXPO_PUBLIC_TENNIS_FEATURES_ENABLED',
];
const RECOMMENDED = ['EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN'];
const TEST_ACCOUNTS = ['TEST_EMAIL', 'TEST_PASSWORD', 'TEST_ADMIN_EMAIL', 'TEST_ADMIN_PASSWORD'];
const LEGACY_WEB = [
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_PROJECT_ID', 'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_PUBLIC_SITE_URL', 'VITE_TENNIS_FEATURES_ENABLED',
];
// Names that suggest a privileged credential that should not live in a client app's .env.
const PRIVILEGED_NAME = /(SERVICE_?ROLE|SECRET|PRIVATE_?KEY|DATABASE_URL|POSTGRES|DB_?PASS)/i;

/** Parse dotenv-style text into { NAME: 'set' | 'empty' } without keeping values. */
function parseNames(text) {
  const status = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    status[m[1]] = value === '' ? 'empty' : 'set';
  }
  return status;
}

function report(status) {
  const lines = [];
  const show = (title, names) => {
    lines.push(`${title}:`);
    for (const n of names) {
      const s = status[n] === 'set' ? 'OK     ' : status[n] === 'empty' ? 'EMPTY  ' : 'MISSING';
      lines.push(`  ${s} ${n}`);
    }
  };
  show('Required', REQUIRED);
  show('Recommended', RECOMMENDED);
  show('Test accounts (Playwright)', TEST_ACCOUNTS);
  show('Legacy web (unused by the native app)', LEGACY_WEB);
  const known = new Set([...REQUIRED, ...RECOMMENDED, ...TEST_ACCOUNTS, ...LEGACY_WEB]);
  const other = Object.keys(status).filter((n) => !known.has(n));
  lines.push(`Other names present (${other.length}): ${other.join(', ') || 'none'}`);
  const risky = Object.keys(status).filter((n) => PRIVILEGED_NAME.test(n));
  for (const n of risky) {
    lines.push(`WARN ${n}: the name suggests a privileged credential. Keep service-role or database secrets out of the app .env`);
  }
  const bundled = Object.keys(status).filter((n) => n.startsWith('EXPO_PUBLIC_') && PRIVILEGED_NAME.test(n));
  for (const n of bundled) lines.push(`WARN ${n}: EXPO_PUBLIC_ variables are bundled into the shipped app`);
  const missing = REQUIRED.filter((n) => status[n] !== 'set');
  lines.push(missing.length ? `RESULT: ${missing.length} required name(s) missing or empty` : 'RESULT: all required names are set');
  return { text: lines.join('\n'), ok: missing.length === 0 };
}

module.exports = { parseNames, report };

if (require.main === module) {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '..', '.env'));
  if (!fs.existsSync(file)) {
    console.log(`No such file: ${path.basename(file)}`);
    process.exit(2);
  }
  const { text, ok } = report(parseNames(fs.readFileSync(file, 'utf8')));
  console.log(`File: ${path.basename(file)}`);
  console.log(text);
  process.exit(ok ? 0 : 1);
}
