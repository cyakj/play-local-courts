// Binary helpers for uploading picked images from React Native. supabase-js cannot upload a Blob/File body on
// React Native (storage-js documents ArrayBuffer as the supported body), so images are read as base64 from
// expo-image-picker and decoded here. Pure, no dependencies.

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
