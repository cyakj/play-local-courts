// Pure helpers for the HOA Admin applicant flow (src/app/hoa-application.tsx). No React / Supabase imports so
// they can be unit-tested in Node (tests/hoa-application-logic.spec.ts).

// Shared with the report-photo upload; re-exported so existing imports keep working.
export { base64ToBytes, sniffDocumentMime } from './imageBytes';

export const MAX_APPLICATION_DOCUMENTS = 5;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // matches the bucket's file_size_limit (10 MB)
export const ALLOWED_DOCUMENT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;
export const MAX_ESTIMATED_RESIDENTS = 100000;

export interface ApplicationInput {
  hoaName: string;
  communityLocation: string;
  estimatedResidents: string;
  claimedRole: string;
  claimedRoleOther: string;
}

/** First problem found, as a user-facing sentence, or null when the input is submittable. */
export function validateApplicationInput(i: ApplicationInput): string | null {
  if (!i.hoaName.trim()) return 'Please enter your HOA name.';
  if (!i.communityLocation.trim()) return 'Please enter the community location.';
  const residents = parseResidents(i.estimatedResidents);
  if (residents === null) return `Enter the approximate number of residents (1 to ${MAX_ESTIMATED_RESIDENTS.toLocaleString('en-US')}).`;
  if (!i.claimedRole) return 'Please select your role.';
  if (i.claimedRole === 'other' && !i.claimedRoleOther.trim()) return 'Please describe your role.';
  return null;
}

/** Whole number in 1..MAX_ESTIMATED_RESIDENTS, else null. (The old code silently stored 0 for blank/garbage.) */
export function parseResidents(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= MAX_ESTIMATED_RESIDENTS ? n : null;
}

export function sanitizeFileName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? '').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/\.{2,}/g, '.');
  const trimmed = base.replace(/^[._]+/, '').slice(-80);
  return trimmed || 'document';
}

/** Storage object path. The first folder MUST be the uploader's user id: that is what the bucket policy checks. */
export function documentPath(userId: string, fileName: string, nowMs: number): string {
  return `${userId}/${nowMs}-${sanitizeFileName(fileName)}`;
}

export function isOwnDocumentPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..') && path.length > userId.length + 1;
}

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'application/pdf': 'pdf',
};

/** Replace (or add) the file extension so it matches the content type that is actually uploaded. */
export function withExtension(fileName: string, mime: string): string {
  const ext = MIME_EXTENSION[mime];
  const stem = sanitizeFileName(fileName).replace(/\.[A-Za-z0-9]{1,5}$/, '');
  return ext ? `${stem || 'document'}.${ext}` : sanitizeFileName(fileName);
}

export function validateDocument(mime: string | null | undefined, sizeBytes: number | null | undefined): string | null {
  if (!mime || !(ALLOWED_DOCUMENT_MIME as readonly string[]).includes(mime.toLowerCase())) {
    return 'Use a JPG, PNG, WEBP, HEIC or PDF file.';
  }
  if (sizeBytes != null && sizeBytes > MAX_DOCUMENT_BYTES) return 'Each file must be 10 MB or smaller.';
  return null;
}
