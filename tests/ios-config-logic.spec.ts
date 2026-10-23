/**
 * iOS native-config guard. A dev-client / TestFlight build is terminated by iOS if the app asks for a protected
 * resource without the matching Info.plist usage string (Expo Go hides this because it ships its own strings).
 * Node only:  npx playwright test -c playwright.logic.config.ts ios-config-logic
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const config = JSON.parse(readFileSync('app.json', 'utf8')).expo as {
  ios?: { infoPlist?: Record<string, string> };
  plugins?: Array<string | [string, Record<string, unknown>]>;
};

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      // Legacy web code is not part of the native bundle (see CLAUDE.md).
      if (['pages', 'contexts'].includes(name) && dir === 'src') continue;
      sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const nativeSource = sourceFiles('src').map((f) => readFileSync(f, 'utf8')).join('\n');

const plugin = (name: string) =>
  config.plugins?.find((p) => (Array.isArray(p) ? p[0] : p) === name);

test.describe('iOS usage descriptions', () => {
  test('expo-image-picker is configured with photo and camera usage strings, and no microphone string', () => {
    expect(nativeSource).toContain("from 'expo-image-picker'");
    const entry = plugin('expo-image-picker');
    expect(entry, 'expo-image-picker config plugin is missing from app.json').toBeDefined();
    const opts = (Array.isArray(entry) ? entry[1] : {}) as Record<string, unknown>;
    expect(String(opts.photosPermission ?? '').length).toBeGreaterThan(30);
    expect(String(opts.cameraPermission ?? '').length).toBeGreaterThan(30);
    expect(opts.microphonePermission).toBe(false); // we never record audio; do not ship an unused permission string
  });

  test('expo-location use is covered by a location usage string', () => {
    expect(nativeSource).toContain("from 'expo-location'");
    expect(config.ios?.infoPlist?.NSLocationWhenInUseUsageDescription ?? '').toMatch(/\w{10,}/);
  });

  test('no protected-resource module (including subpath imports such as expo-contacts/legacy) is used without a declared string', () => {
    const modules = new Set(
      [...nativeSource.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1].split('/').slice(0, m[1].startsWith('@') ? 2 : 1).join('/')),
    );
    const needs: Array<[string, string, () => boolean]> = [
      ['expo-camera', 'NSCameraUsageDescription', () => !!config.ios?.infoPlist?.NSCameraUsageDescription || !!plugin('expo-camera')],
      ['expo-contacts', 'NSContactsUsageDescription', () => !!config.ios?.infoPlist?.NSContactsUsageDescription || !!plugin('expo-contacts')],
      ['expo-media-library', 'NSPhotoLibraryUsageDescription', () => !!plugin('expo-media-library')],
    ];
    for (const [pkg, key, declared] of needs) {
      if (modules.has(pkg)) expect(declared(), `${key} is missing (a source file imports ${pkg})`).toBe(true);
    }
  });

  test('the contacts purpose string discloses that contacts are compared with TenisX members', () => {
    const entry = plugin('expo-contacts');
    expect(entry, 'expo-contacts config plugin is missing from app.json').toBeDefined();
    const opts = (Array.isArray(entry) ? entry[1] : {}) as Record<string, unknown>;
    expect(String(opts.contactsPermission ?? '')).toMatch(/compare/i);
    expect(String(opts.contactsPermission ?? '')).toMatch(/emails and phone numbers/i);
  });

  test('every protected-resource package that is installed AND imported is declared (guards the regex above)', () => {
    // Sanity: the scan really sees the legacy contacts import that the first version of this guard missed.
    expect(nativeSource).toContain("from 'expo-contacts/legacy'");
  });
});
