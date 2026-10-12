#!/usr/bin/env node
/**
 * Checks the configured Mapbox token the way the native app uses it: plain HTTPS requests
 * with NO Referer header. Reads EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN from .env; never prints it.
 *
 *   node scripts/verify-mapbox.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envFile = path.join(__dirname, '..', '.env');
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const match = env.match(/^EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=(.*)$/m);
const token = (match ? match[1] : process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '').trim().replace(/^["']|["']$/g, '');

if (!token) {
  console.error('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is not set in .env');
  process.exit(2);
}
if (!token.startsWith('pk.')) {
  console.error('Token does not start with "pk." — only PUBLIC tokens may be used in the app. Secret (sk.) tokens must never be in client code.');
  process.exit(2);
}

const BASE = 'https://api.mapbox.com/search/searchbox/v1';
const session = crypto.randomUUID();
const queries = ['Dorado', 'San Juan', '1600 Pennsylvania Ave NW Washington', 'Calle Fortaleza San Juan'];
let failed = 0;

(async () => {
  for (const q of queries) {
    const params = new URLSearchParams({
      q,
      access_token: token,
      session_token: session,
      language: 'en',
      limit: '6',
      types: 'place,locality,neighborhood,address,postcode,region',
    });
    const res = await fetch(`${BASE}/suggest?${params}`); // no Referer, like native fetch
    if (!res.ok) {
      failed++;
      console.log(`FAIL  "${q}" -> HTTP ${res.status}`);
      continue;
    }
    const json = await res.json();
    const list = (json.suggestions || []).map((s) => `${s.name} (${s.feature_type})`);
    if (!list.length) failed++;
    console.log(`${list.length ? 'OK  ' : 'FAIL'}  "${q}" -> ${list.length} result(s): ${list.slice(0, 3).join(' | ')}`);

    // Retrieve the first hit to prove coordinates + context come back.
    if (json.suggestions && json.suggestions[0]) {
      const r = await fetch(`${BASE}/retrieve/${json.suggestions[0].mapbox_id}?${new URLSearchParams({ access_token: token, session_token: session })}`);
      const f = r.ok ? (await r.json()).features?.[0] : null;
      const c = f?.properties?.context ?? {};
      console.log(`      retrieve -> HTTP ${r.status}, ${f ? `${c.place?.name ?? c.locality?.name ?? '-'}, ${c.region?.name ?? '-'}, ${c.country?.name ?? '-'}` : 'no feature'}`);
      if (!f) failed++;
    }
  }
  console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})();
