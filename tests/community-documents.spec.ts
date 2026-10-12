/**
 * Community Documents — storage access logic + live signed-URL proof.
 *
 * Root cause being guarded: `hoa_documents.file_url` stores a *public* object URL,
 * but the `hoa-documents` bucket is private, so the public endpoint answers
 * `404 Bucket not found`. The fix signs the object path as the signed-in resident.
 *
 * Part 1 is pure Node. Part 2 hits the real Supabase project as the test resident
 * (TEST_EMAIL / TEST_PASSWORD) and downloads an actual PDF.
 */
import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import {
  canPreviewInApp,
  classifyStorageError,
  extractStoragePath,
  failureMessage,
  fileKind,
  formatBytes,
  safeFileName,
} from '../src/lib/communityDocuments';
dotenv.config();

const HOA = 'cb6a0752-dee0-4a01-b74a-6fb25f47de98';
const PUBLIC_URL =
  `https://x.supabase.co/storage/v1/object/public/hoa-documents/${HOA}/meeting_minutes/1774732034505_Circadian_Rhythm.pdf`;

test.describe('extractStoragePath', () => {
  test('recovers the object path from the stored public URL', () => {
    expect(extractStoragePath(PUBLIC_URL)).toBe(`${HOA}/meeting_minutes/1774732034505_Circadian_Rhythm.pdf`);
  });
  test('accepts sign/authenticated URLs and ignores query strings', () => {
    expect(extractStoragePath(`https://x.supabase.co/storage/v1/object/sign/hoa-documents/${HOA}/a/b.pdf?token=abc`))
      .toBe(`${HOA}/a/b.pdf`);
    expect(extractStoragePath(`https://x.supabase.co/object/authenticated/hoa-documents/${HOA}/a/b.pdf`))
      .toBe(`${HOA}/a/b.pdf`);
  });
  test('decodes encoded names', () => {
    expect(extractStoragePath(`https://x/storage/v1/object/public/hoa-documents/${HOA}/a/My%20Doc.pdf`))
      .toBe(`${HOA}/a/My Doc.pdf`);
  });
  test('missing file / invalid bucket / traversal → null', () => {
    expect(extractStoragePath(null)).toBeNull();
    expect(extractStoragePath('')).toBeNull();
    expect(extractStoragePath('https://x/storage/v1/object/public/some-other-bucket/a/b.pdf')).toBeNull();
    expect(extractStoragePath(`https://x/storage/v1/object/public/hoa-documents/${HOA}/../other/b.pdf`)).toBeNull();
  });
});

test.describe('classifyStorageError', () => {
  test('bucket / object missing → not-found', () => {
    expect(classifyStorageError({ message: 'Bucket not found' })).toBe('not-found');
    expect(classifyStorageError({ message: 'Object not found' })).toBe('not-found');
    expect(classifyStorageError({ status: 404 })).toBe('not-found');
  });
  test('expired signed URL / session → expired', () => {
    expect(classifyStorageError({ message: 'JWT expired' })).toBe('expired');
    expect(classifyStorageError({ message: '"exp" claim timestamp check failed' })).toBe('expired');
  });
  test('denied → unauthorized', () => {
    expect(classifyStorageError({ message: 'new row violates row-level security policy' })).toBe('unauthorized');
    expect(classifyStorageError({ status: 403 })).toBe('unauthorized');
    expect(classifyStorageError({ status: 401 })).toBe('unauthorized');
  });
  test('offline → network, anything else → unknown', () => {
    expect(classifyStorageError({ message: 'Network request failed' })).toBe('network');
    expect(classifyStorageError({ message: 'Failed to fetch' })).toBe('network');
    expect(classifyStorageError({ message: 'boom' })).toBe('unknown');
    expect(classifyStorageError(null)).toBe('unknown');
  });
  test('every failure has a resident-facing message with no raw error text', () => {
    for (const f of ['no-file', 'not-found', 'unauthorized', 'expired', 'network', 'unknown'] as const) {
      const m = failureMessage(f);
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.body).not.toMatch(/NoSuchBucket|404|bucket/i);
    }
  });
});

test.describe('file helpers', () => {
  test('fileKind / preview routing', () => {
    expect(fileKind('Rules.PDF')).toEqual({ kind: 'pdf', label: 'PDF' });
    expect(fileKind('a.docx').kind).toBe('doc');
    expect(fileKind('a.xlsx').kind).toBe('sheet');
    expect(fileKind('a.png').kind).toBe('image');
    expect(fileKind(null).kind).toBe('file');
    expect(canPreviewInApp('a.pdf')).toBe(true);
    expect(canPreviewInApp('a.docx')).toBe(false);
  });
  test('safeFileName strips path separators', () => {
    expect(safeFileName('../../etc/passwd')).toBe('.._.._etc_passwd');
    expect(safeFileName('  ')).toBe('document');
    expect(safeFileName('Meeting #1.pdf')).toBe('Meeting #1.pdf');
  });
  test('formatBytes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(284151)).toBe('277.5 KB');
  });
});

// ── Live proof ──────────────────────────────────────────────────────────────

const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const LIVE = !!(URL_BASE && ANON && process.env.TEST_EMAIL && process.env.TEST_PASSWORD);

test.describe('live storage access (resident test account)', () => {
  test.skip(!LIVE, 'needs Supabase env + TEST_EMAIL/TEST_PASSWORD');
  let token = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${URL_BASE}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON!, 'Content-Type': 'application/json' },
      data: { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    token = (await res.json()).access_token;
  });

  const sign = (request: any, path: string, bearer: string | null) =>
    request.post(`${URL_BASE}/storage/v1/object/sign/hoa-documents/${path}`, {
      headers: { apikey: ANON!, ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), 'Content-Type': 'application/json' },
      data: { expiresIn: 300 },
    });

  test('the stored public URL does NOT work (documents the reported 404)', async ({ request }) => {
    const res = await request.get(
      `${URL_BASE}/storage/v1/object/public/hoa-documents/${HOA}/meeting_minutes/1774732034505_Circadian_Rhythm.pdf`,
    );
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(await res.text()).toMatch(/Bucket not found/i);
  });

  test('valid document: signed URL downloads the real PDF', async ({ request }) => {
    const path = `${HOA}/meeting_minutes/1774732034505_Circadian_Rhythm.pdf`;
    const res = await sign(request, path, token);
    expect(res.ok()).toBeTruthy();
    const { signedURL } = await res.json();
    const file = await request.get(`${URL_BASE}/storage/v1${signedURL}`);
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toContain('application/pdf');
    const body = await file.body();
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
    expect(body.length).toBe(284151); // matches hoa_documents.file_size_bytes
  });

  test('second document also downloads', async ({ request }) => {
    const path = `${HOA}/rules_bylaws/1779114270395_Roman_Emprie_vs_Roman_Republic.pdf`;
    const res = await sign(request, path, token);
    expect(res.ok()).toBeTruthy();
    const { signedURL } = await res.json();
    const file = await request.get(`${URL_BASE}/storage/v1${signedURL}`);
    expect(file.status()).toBe(200);
    expect((await file.body()).length).toBe(59416);
  });

  test('missing file: sign request is rejected as not found', async ({ request }) => {
    const res = await sign(request, `${HOA}/meeting_minutes/does-not-exist.pdf`, token);
    expect(res.ok()).toBeFalsy();
    expect(classifyStorageError({ ...(await res.json()), status: res.status() })).toBe('not-found');
  });

  test('unauthorized: anonymous caller cannot sign', async ({ request }) => {
    const res = await sign(request, `${HOA}/meeting_minutes/1774732034505_Circadian_Rhythm.pdf`, null);
    expect(res.ok()).toBeFalsy();
  });

  test('unauthorized: another community\'s folder is not signable', async ({ request }) => {
    // The Fairways — resident is not a member, and no such object exists.
    const res = await sign(request, `3842ff13-36d8-4e9e-9f05-01bf4aeafc25/rules_bylaws/x.pdf`, token);
    expect(res.ok()).toBeFalsy();
  });

  test('expired URL: a tampered/expired token is rejected and classified', async ({ request }) => {
    const res = await sign(request, `${HOA}/meeting_minutes/1774732034505_Circadian_Rhythm.pdf`, token);
    const { signedURL } = await res.json();
    const broken = signedURL.replace(/token=[^&]+/, 'token=eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid');
    const file = await request.get(`${URL_BASE}/storage/v1${broken}`);
    expect(file.ok()).toBeFalsy();
    const body = await file.json().catch(() => ({}));
    expect(['expired', 'unauthorized', 'not-found']).toContain(
      classifyStorageError({ ...body, status: file.status() }),
    );
  });
});
