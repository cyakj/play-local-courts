// Pure rules for resident profile photos (V1-005). No React / Supabase so they run in Node tests.
//
// Storage model: a PRIVATE bucket ('profile-photos', migration 20261030120000) with owner-only policies. The
// profile row stores the OBJECT PATH ('<uid>/avatar-<timestamp>.<ext>'), never a URL; screens render a short-lived
// signed URL. A value that is already an http(s) URL is a legacy public-bucket value and is rendered as-is until the
// resident replaces or removes it.

export const PROFILE_PHOTO_BUCKET = 'profile-photos';
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024; // matches the bucket's file_size_limit
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

export const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type PhotoMime = (typeof ALLOWED_PHOTO_MIME)[number];

const EXT: Record<PhotoMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type PhotoCheck = { ok: true; mime: PhotoMime; ext: string } | { ok: false; message: string };

/** `mime` must be the SNIFFED content type (magic bytes), not the picker's metadata. */
export function checkProfilePhoto(mime: string | null, sizeBytes: number): PhotoCheck {
  if (!mime || !(ALLOWED_PHOTO_MIME as readonly string[]).includes(mime)) {
    return { ok: false, message: 'That file type is not supported. Please choose a JPEG, PNG or WebP photo.' };
  }
  if (sizeBytes <= 0) return { ok: false, message: 'That photo could not be read. Please choose another.' };
  if (sizeBytes > MAX_PROFILE_PHOTO_BYTES) {
    return { ok: false, message: 'That photo is larger than 5 MB. Please choose a smaller one.' };
  }
  return { ok: true, mime: mime as PhotoMime, ext: EXT[mime as PhotoMime] };
}

/** A fresh object name per upload, so replacing never serves a cached old image. */
export function avatarObjectPath(userId: string, ext: string, nowMs: number): string {
  return `${userId}/avatar-${nowMs}.${ext}`;
}

/** True when the value is an object path inside the user's own folder (the only thing we ever write or delete). */
export function isOwnPhotoPath(value: string | null | undefined, userId: string): boolean {
  return !!value && new RegExp(`^${userId}/avatar-\\d+\\.(jpg|png|webp)$`).test(value);
}

export type AvatarSource =
  | { kind: 'none' }
  | { kind: 'legacy-url'; url: string }
  | { kind: 'storage-path'; path: string };

export function classifyAvatarValue(value: string | null | undefined): AvatarSource {
  const v = value?.trim();
  if (!v) return { kind: 'none' };
  if (/^https?:\/\//i.test(v)) return { kind: 'legacy-url', url: v };
  return { kind: 'storage-path', path: v };
}

export function initialsFor(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Maps a storage error to resident wording. Only a missing BUCKET means "not enabled on this server"; other "not found" errors are not misreported as that. */
export function friendlyStorageError(message: string): string {
  if (/bucket not found/i.test(message)) return 'Profile photos are not enabled on this server yet. Please try again later.';
  if (/row-level security|not authorized|unauthorized|permission/i.test(message)) return 'You are not allowed to change this photo.';
  if (/payload too large|too large|exceeded/i.test(message)) return 'That photo is larger than 5 MB. Please choose a smaller one.';
  return `Photo upload failed: ${message}`;
}
