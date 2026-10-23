/**
 * Static guards for two silent-failure traps:
 *  1. Resident report photos must upload an ArrayBuffer on React Native (a Blob body does not work through supabase-js).
 *  2. A join request with no pending membership behind it must never be marked "approved" (the resident would get no access).
 * Node only:  npx playwright test -c playwright.logic.config.ts upload-approval-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { base64ToBytes, sniffDocumentMime } from '../src/lib/imageBytes';

const report = readFileSync('src/app/(resident)/report.tsx', 'utf8');
const approvals = readFileSync('src/app/(admin)/pending-requests.tsx', 'utf8');

test.describe('report photo upload (React Native)', () => {
  test('native branch uploads decoded bytes, not a fetched Blob', () => {
    expect(report).not.toContain('fetch(photoUri)');
    expect(report).not.toMatch(/\.blob\(\)/);
    expect(report).toContain('base64ToBytes(photoBase64.current)');
    expect(report).toContain('bytes.buffer as ArrayBuffer');
  });
  test('both pickers request base64 and keep it with the chosen photo', () => {
    expect(report.match(/base64: true/g)).toHaveLength(2);
    expect(report.match(/photoBase64\.current = result\.assets\[0\]\.base64 \?\? null/g)).toHaveLength(2);
  });
  test('content type comes from the bytes and must be an image', () => {
    expect(report).toContain('sniffDocumentMime(bytes)');
    expect(report).toContain("contentType.startsWith('image/')");
    expect(report).toContain('{ upsert: true, contentType }');
  });
  test('a failed photo is reported on the success screen (the report itself still saved)', () => {
    expect(report).toContain("setPhotoWarning('Your report was submitted, but the photo could not be attached.");
    expect(report.match(/testID="photo-warning"/g)).toHaveLength(2); // both layouts' success views
    expect(report).toContain('setPhotoWarning(null)'); // cleared by resetForm
    expect(report).not.toContain('submitErrorRef');
  });
  test('the photo is attached through the reporter-only RPC, never a direct UPDATE (residents have no UPDATE policy)', () => {
    expect(report).toContain("db.rpc('attach_report_photo'");
    expect(report).not.toMatch(/\.update\(\{ photo_url/);
    expect(report).toContain('attached?.data === true');
  });
  test('attach_report_photo migration: object path only, must exist in our bucket, URL built server-side, reporter-only set-once', () => {
    const sql = readFileSync('supabase/migrations/20261023130000_report_photo_attach.sql', 'utf8');
    expect(sql).toContain('attach_report_photo(p_report_id uuid, p_object_path text)');
    expect(sql).not.toContain('p_photo_url');
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path TO 'public'/);
    expect(sql).toContain("p_object_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]+$')");
    expect(sql).toContain("p_object_path LIKE '%..%'");
    expect(sql).toMatch(/FROM storage\.objects\s+WHERE bucket_id = 'report-photos' AND name = p_object_path/);
    expect(sql).toContain("NULLIF(current_setting('request.headers', true), '')::json ->> 'host'");
    expect(sql).toContain("public_url := api_scheme || '://' || api_host || '/storage/v1/object/public/report-photos/' || p_object_path;");
    expect(sql).toContain("->> 'x-forwarded-proto', 'https'");
    expect(sql).toContain("api_scheme NOT IN ('http', 'https')");
    expect(sql).toMatch(/WHERE id = p_report_id\s+AND reporter_id = auth\.uid\(\)\s+AND photo_url IS NULL/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.attach_report_photo\(uuid, text\) FROM PUBLIC, anon;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.attach_report_photo\(uuid, text\) TO authenticated;/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });
  test('client sends only the object path it uploaded to, and the warning promises no unsupported recovery', () => {
    expect(report).toContain("p_object_path: `${userId}/${inserted.id}.jpg`");
    expect(report).not.toContain('p_photo_url');
    expect(report).not.toMatch(/You can add details when you open the report/);
    expect(report).toContain("const path = `${userId}/${reportId}.${ext}`");
  });
  test('web path (File object) is unchanged', () => {
    expect(report).toContain("contentType: file.type");
  });
  test('shared helpers decode and sniff a real JPEG header', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const bytes = base64ToBytes(jpeg.toString('base64'));
    expect(bytes).not.toBeNull();
    expect(sniffDocumentMime(bytes!)).toBe('image/jpeg');
  });
});

test.describe('membership approval', () => {
  test('approving a request without a membership is refused with an explanation and writes nothing', () => {
    const fn = approvals.slice(approvals.indexOf('async function updateMember'), approvals.indexOf('async function reviewReservation'));
    const from = fn.indexOf("} else if (action === 'approved') {");
    const branch = fn.slice(from, fn.indexOf('} else {', from + 1));
    expect(branch).toContain('no matching membership record');
    // Declining does not unblock a retry (join RPCs refuse a new request after a decision), so never advise it.
    expect(branch).not.toMatch(/request to join again/i);
    expect(branch).toMatch(/TenisX support/);
    expect(branch).not.toContain('.update(');
    expect(branch).not.toContain('.rpc(');
  });
  test('declining a request without a membership still works', () => {
    const fn = approvals.slice(approvals.indexOf('async function updateMember'), approvals.indexOf('async function reviewReservation'));
    expect(fn).toMatch(/} else \{\s*const \{ error: jrErr \} = await supabase\s*\.from\('community_join_requests'\)\.update\(\{ status: action/);
  });
  test('approval with a membership still goes through the SECURITY DEFINER RPCs first', () => {
    expect(approvals).toContain("'approve_hoa_membership'");
    expect(approvals).toContain("'reject_hoa_membership'");
  });
});
