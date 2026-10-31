// Pure. Must stay in step with the report-photos bucket (20261030140000): 5 MB, JPEG / PNG / WebP.
export const MAX_REPORT_PHOTO_BYTES = 5 * 1024 * 1024;
export const REPORT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Returns a user-facing message when the photo cannot be uploaded, otherwise null. `type` may be empty (native picker). */
export function reportPhotoProblem(bytes: number, type: string | null | undefined): string | null {
  if (type && !REPORT_PHOTO_TYPES.includes(type.toLowerCase())) return 'Photos must be JPG, PNG or WebP.';
  if (bytes > MAX_REPORT_PHOTO_BYTES) return 'That photo is larger than 5 MB. Choose a smaller one.';
  return null;
}

/** Decoded size of a base64 string without decoding it. */
export function base64DecodedBytes(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
