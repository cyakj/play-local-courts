// Pure helpers for the HOA Admin applicant flow (src/app/hoa-application.tsx). No React / Supabase imports so
// they can be unit-tested in Node (tests/hoa-application-logic.spec.ts).

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

/**
 * Decode base64 (optionally a data: URL) to bytes. React Native cannot upload a Blob/File body through
 * supabase-js (storage-js documents this); ArrayBuffer is the supported body. Returns null when malformed.
 */
export function base64ToBytes(input: string): Uint8Array | null {
  const raw = input.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '');
  if (!raw || raw.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) return null;
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const unpadded = raw.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((unpadded.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < unpadded.length; i++) {
    buffer = (buffer << 6) | table.indexOf(unpadded[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }
  return out;
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...Array.from(b.subarray(from, to)));

/**
 * The real content type, from magic bytes. expo-image-picker's `base64` output is JPEG re-encoded on some
 * platforms while the asset's mimeType/fileName still describe the source file, so metadata cannot be trusted
 * for the upload's contentType or extension.
 */
export function sniffDocumentMime(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && ascii(b, 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ascii(b, 8, 12))) return 'image/heic';
  if (b.length >= 5 && ascii(b, 0, 5) === '%PDF-') return 'application/pdf';
  return null;
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
