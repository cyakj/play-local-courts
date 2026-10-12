#!/usr/bin/env node
// Generates src/data/openSourceLicenses.json from the *installed* production dependency
// tree (package-lock.json minus dev-only packages), reading each package's own
// package.json + LICENSE file. Nothing is invented: a package with no license file keeps
// its declared SPDX identifier and an empty text, and is reported at the end.
//
// Usage: node scripts/generate-licenses.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

const LICENSE_FILES = [
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt',
  'license', 'license.md', 'license.txt', 'License.md', 'License.txt', 'COPYING', 'COPYING.txt',
];

function readLicenseText(dir) {
  for (const f of LICENSE_FILES) {
    const p = path.join(dir, f);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return fs.readFileSync(p, 'utf8').trim();
  }
  return '';
}

function declaredLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type || l).join(' OR ');
  return 'UNKNOWN';
}

function repoUrl(pkg) {
  let r = pkg.repository;
  if (!r) return pkg.homepage || null;
  if (typeof r === 'object') r = r.url;
  if (!r) return pkg.homepage || null;
  return String(r).replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/\.git$/, '');
}

const entries = [];
const textByHash = new Map();
const missingText = [];
const seen = new Set();

for (const [key, meta] of Object.entries(lock.packages)) {
  if (!key.startsWith('node_modules/')) continue;     // skip the root project
  if (meta.dev || meta.devOptional) continue;          // production tree only
  const dir = path.join(root, key);
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;               // optional platform binary not installed here
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const id = `${pkg.name}@${pkg.version}`;
  if (seen.has(id)) continue;
  seen.add(id);

  const text = readLicenseText(dir);
  let hash = null;
  if (text) {
    hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);
    if (!textByHash.has(hash)) textByHash.set(hash, text);
  } else {
    missingText.push(id);
  }
  const copyright = text.split('\n').find((l) => /copyright/i.test(l));

  entries.push({
    name: pkg.name,
    version: pkg.version,
    license: declaredLicense(pkg),
    repository: repoUrl(pkg),
    copyright: copyright ? copyright.trim().slice(0, 200) : null,
    textId: hash,
  });
}

entries.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

const out = {
  generatedFrom: 'package-lock.json (production dependency tree, installed versions)',
  packageCount: entries.length,
  packages: entries,
  texts: Object.fromEntries(textByHash),
};

const dest = path.join(root, 'src', 'data', 'openSourceLicenses.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));

const byLicense = entries.reduce((m, e) => ((m[e.license] = (m[e.license] || 0) + 1), m), {});
console.log(`packages: ${entries.length}, distinct license texts: ${textByHash.size}`);
console.log('by license:', JSON.stringify(byLicense));
console.log(`size: ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
if (missingText.length) console.log(`no LICENSE file found for ${missingText.length} package(s):`, missingText.join(', '));
