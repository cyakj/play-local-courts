/**
 * HOA Admin applicant flow: pure helpers (src/lib/hoaApplication.ts) plus static assertions on the unapplied
 * hardening migration. Node only:  npx playwright test -c playwright.logic.config.ts hoa-application-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  MAX_DOCUMENT_BYTES, base64ToBytes, documentPath, sniffDocumentMime, withExtension, isOwnDocumentPath, parseResidents, sanitizeFileName,
  validateApplicationInput, validateDocument,
} from '../src/lib/hoaApplication';

const base = {
  hoaName: 'Sunset Park HOA', communityLocation: 'San Juan, PR', estimatedResidents: '150',
  claimedRole: 'board_member', claimedRoleOther: '',
};

test.describe('validateApplicationInput', () => {
  test('accepts a complete application', () => {
    expect(validateApplicationInput(base)).toBeNull();
  });
  test('requires name, location, residents and role in that order', () => {
    expect(validateApplicationInput({ ...base, hoaName: '  ' })).toMatch(/HOA name/);
    expect(validateApplicationInput({ ...base, communityLocation: '' })).toMatch(/location/);
    expect(validateApplicationInput({ ...base, estimatedResidents: '' })).toMatch(/residents/);
    expect(validateApplicationInput({ ...base, claimedRole: '' })).toMatch(/role/);
  });
  test('"other" role needs a description', () => {
    expect(validateApplicationInput({ ...base, claimedRole: 'other', claimedRoleOther: ' ' })).toMatch(/describe/i);
    expect(validateApplicationInput({ ...base, claimedRole: 'other', claimedRoleOther: 'Community manager' })).toBeNull();
  });
});

test.describe('parseResidents', () => {
  test('whole numbers 1..100000 only (blank/garbage was silently stored as 0 before)', () => {
    expect(parseResidents('150')).toBe(150);
    expect(parseResidents(' 7 ')).toBe(7);
    for (const bad of ['', '0', '-3', '1.5', '12a', '100001', '1e3', '9999999']) expect(parseResidents(bad)).toBeNull();
  });
});

test.describe('document paths', () => {
  const uid = '11111111-2222-3333-4444-555555555555';
  test('path starts with the uploader id folder (what the bucket policy checks)', () => {
    const p = documentPath(uid, 'My Board Resolution (final).JPG', 1700000000000);
    expect(p.startsWith(`${uid}/1700000000000-`)).toBe(true);
    expect(isOwnDocumentPath(uid, p)).toBe(true);
  });
  test('file names cannot traverse or smuggle folders', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('a\\b\\c.png')).toBe('c.png');
    expect(sanitizeFileName('....')).toBe('document');
    expect(sanitizeFileName('')).toBe('document');
    expect(documentPath(uid, '../../other/x.png', 1)).not.toContain('..');
  });
  test("another user's folder or traversal is not an own path", () => {
    expect(isOwnDocumentPath(uid, '99999999-0000-0000-0000-000000000000/x.png')).toBe(false);
    expect(isOwnDocumentPath(uid, `${uid}/../x.png`)).toBe(false);
    expect(isOwnDocumentPath(uid, `${uid}/`)).toBe(false);
  });
});

test.describe('base64ToBytes (React Native upload body)', () => {
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
  test('round-trips arbitrary bytes, with and without padding and data: prefix', () => {
    for (const s of ['', 'a', 'ab', 'abc', 'abcd', 'Hello, TenisX!', '\u00e9\u00e8\u2603']) {
      if (!s) continue;
      expect(Array.from(base64ToBytes(b64(s))!)).toEqual(Array.from(Buffer.from(s, 'utf8')));
    }
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0x80]);
    expect(Array.from(base64ToBytes(`data:image/png;base64,${png.toString('base64')}`)!)).toEqual(Array.from(png));
    expect(Array.from(base64ToBytes(png.toString('base64').replace(/=+$/, ''))!)).toEqual(Array.from(png));
  });
  test('rejects empty and malformed input instead of uploading garbage', () => {
    for (const bad of ['', '   ', '!!!!', 'abc$', 'a', 'ab=c']) expect(base64ToBytes(bad)).toBeNull();
  });
});

test.describe('content-type sniffing (picker base64 is not always the source format)', () => {
  const bytes = (...n: number[]) => new Uint8Array(n);
  const text = (s: string, pad = 0) => new Uint8Array([...Buffer.from(s, 'latin1'), ...new Array(pad).fill(0)]);
  test('recognises JPEG, PNG, WEBP, HEIC and PDF by magic bytes and rejects everything else', () => {
    expect(sniffDocumentMime(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('image/jpeg');
    expect(sniffDocumentMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('image/png');
    expect(sniffDocumentMime(new Uint8Array([...Buffer.from('RIFF', 'latin1'), 0, 0, 0, 0, ...Buffer.from('WEBP', 'latin1')]))).toBe('image/webp');
    expect(sniffDocumentMime(new Uint8Array([0, 0, 0, 0x18, ...Buffer.from('ftypheic', 'latin1')]))).toBe('image/heic');
    expect(sniffDocumentMime(text('%PDF-1.7\n', 4))).toBe('application/pdf');
    expect(sniffDocumentMime(text('PK\u0003\u0004zipfile', 8))).toBeNull();
    expect(sniffDocumentMime(bytes())).toBeNull();
    expect(sniffDocumentMime(bytes(0xff, 0xd8))).toBeNull();
  });
  test('extension follows the real type, never the source file name', () => {
    expect(withExtension('IMG_0012.HEIC', 'image/jpeg')).toBe('IMG_0012.jpg');
    expect(withExtension('scan', 'application/pdf')).toBe('scan.pdf');
    expect(withExtension('../../a b.png', 'image/png')).toBe('a_b.png');
    expect(withExtension('x.jpeg', 'application/zip')).toBe('x.jpeg');
  });
});

test.describe('validateDocument', () => {
  test('allows images and PDF, rejects others and oversize', () => {
    for (const ok of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']) expect(validateDocument(ok, 1000)).toBeNull();
    expect(validateDocument('application/zip', 10)).not.toBeNull();
    expect(validateDocument(undefined, 10)).not.toBeNull();
    expect(validateDocument('image/png', MAX_DOCUMENT_BYTES + 1)).toMatch(/10 MB/);
    expect(validateDocument('image/png', MAX_DOCUMENT_BYTES)).toBeNull();
  });
});

test.describe('hardening migration (static)', () => {
  const sql = readFileSync('supabase/migrations/20261023110000_hoa_application_hardening.sql', 'utf8');
  test('guard trigger exempts only reviewers and the service role, and runs on INSERT and UPDATE', () => {
    expect(sql).toContain('auth.uid() IS NULL OR public.has_role(auth.uid(), \'platform_reviewer\'');
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.hoa_applications/);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS guard_hoa_application_write_trigger/);
  });
  test('applicant inserts must be pending and unreviewed', () => {
    expect(sql).toMatch(/NEW\.status IS DISTINCT FROM 'pending'/);
    for (const col of ['reviewed_at', 'reviewed_by', 'created_hoa_id']) expect(sql).toContain(`NEW.${col} IS NOT NULL`);
  });
  test('applicant updates cannot touch review fields or applicant_id', () => {
    for (const col of ['applicant_id', 'reviewed_at', 'reviewed_by', 'created_hoa_id', 'submitted_at']) {
      expect(sql).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`);
    }
  });
  test('document paths are confined to the applicant folder', () => {
    expect(sql).toContain("doc NOT LIKE auth.uid()::text || '/%'");
    expect(sql).toContain("doc LIKE '%..%'");
  });
  test('duplicate guard is partial, skippable, and bucket is restricted to images and PDF', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS hoa_applications_one_open_per_name/);
    expect(sql).toMatch(/WHERE status IN \('pending', 'needs_more_info'\)/);
    expect(sql).toMatch(/RAISE NOTICE 'hoa_applications_one_open_per_name NOT created/);
    expect(sql).toContain("UPDATE storage.buckets");
    expect(sql).toContain("'application/pdf'");
  });
  test('evidence is append-only for the applicant and capped at five', () => {
    expect(sql).toMatch(/array_remove\(array_remove\(COALESCE\(OLD\.verification_documents[^;]*?<@ COALESCE\(NEW\.verification_documents/s);
    expect(sql).toContain("RAISE EXCEPTION 'Existing documents cannot be removed'");
    expect(sql).toMatch(/cardinality\(COALESCE\(NEW\.verification_documents, '\{\}'::text\[\]\)\) > 5/);
    expect(sql).toContain("RAISE EXCEPTION 'At most 5 documents can be attached'");
  });
  test('NULL / empty document elements are rejected and legacy NULLs do not block resubmission', () => {
    expect(sql).toContain('doc IS NULL');
    expect(sql).toContain('length(doc) <= length(auth.uid()::text) + 1');
    expect(sql).toContain("array_remove(array_remove(COALESCE(OLD.verification_documents, '{}'::text[]), NULL), '')");
  });
  test('migration never loosens policies or grants', () => {
    expect(sql).not.toMatch(/GRANT /i);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).not.toMatch(/\bTO anon\b/i);
  });
});

test.describe('application screen wiring (static)', () => {
  const src = readFileSync('src/app/hoa-application.tsx', 'utf8');
  test('screen uploads to the private bucket, not a public one, and no longer hard-codes empty documents', () => {
    expect(src).toContain(".from('hoa-verification-documents')");
    expect(src).not.toContain('verification_documents: [],');
    expect(src).not.toMatch(/getPublicUrl/);
  });
  test('screen uploads ArrayBuffer bytes (Blob bodies do not work through supabase-js on React Native)', () => {
    expect(src).toContain('base64: true');
    expect(src).toContain('base64ToBytes(doc.base64)');
    expect(src).toContain('sniffDocumentMime(bytes)');
    expect(src).toContain('{ contentType, upsert: false }');
    expect(src).not.toContain('contentType: doc.mime');
    expect(src).toContain('bytes.buffer as ArrayBuffer');
    expect(src).not.toMatch(/\.blob\(\)/);
  });
  test('resubmission is optimistic-concurrency guarded and ignores legacy NULL document entries', () => {
    expect(src).toContain(".eq('updated_at', existingApplication!.updated_at)");
    expect(src).toContain("status, submitted_at, verification_documents, updated_at')");
    expect(src).toContain("filter((d): d is string => typeof d === 'string' && d.length > 0)");
  });
  test('attachment removal is locked while a submission is in flight', () => {
    expect(src).toMatch(/disabled=\{isSubmitting\}\s*\n\s*onPress=\{\(\) => \{ if \(!isSubmitting\) setDocuments/);
  });
  test('screen reuses uploads on retry and requires exactly one saved row', () => {
    expect(src).toContain('uploadedPaths.current[doc.uri]');
    expect(src).toContain('saved.length !== 1');
    expect(src).toMatch(/\.update\(\{ \.\.\.fields[^\n]*\n\s*\.eq\('id', existingApplication!\.id\)[\s\S]*?\.select\('id'\)/);
  });
  test('screen validates via the shared helper and maps a duplicate (23505) to a friendly message', () => {
    expect(src).toContain('validateApplicationInput(');
    expect(src).toContain("err?.code === '23505'");
    expect(src).not.toContain("parseInt(estimatedResidents || '0'");
  });
});
