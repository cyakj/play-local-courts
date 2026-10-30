import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { db } from '@/lib/untypedDb';
import { base64ToBytes, sniffDocumentMime } from '@/lib/imageBytes';
import { refreshProfileIdentity } from '@/hooks/useProfileIdentity';
import {
  PROFILE_PHOTO_BUCKET,
  avatarObjectPath,
  checkProfilePhoto,
  isOwnPhotoPath,
} from '@/lib/profilePhoto';

export type PhotoResult = { status: 'ok' } | { status: 'cancelled' } | { status: 'error'; message: string };

function friendlyStorageError(message: string): string {
  if (/bucket not found|not found/i.test(message)) return 'Profile photos are not enabled on this server yet. Please try again later.';
  if (/row-level security|not authorized|unauthorized|permission/i.test(message)) return 'You are not allowed to change this photo.';
  if (/payload too large|too large|exceeded/i.test(message)) return 'That photo is larger than 5 MB. Please choose a smaller one.';
  return `Photo upload failed: ${message}`;
}

async function currentAvatarPath(userId: string): Promise<string | null> {
  const { data, error } = await db.from('profiles').select('avatar_path').eq('id', userId).maybeSingle();
  return !error ? ((data?.avatar_path as string | null) ?? null) : null;
}

/** Best-effort removal of the previous photo; only ever deletes an object inside the user's own folder. */
async function deleteOldObject(userId: string, previous: string | null, keep: string | null) {
  if (!previous || previous === keep || !isOwnPhotoPath(previous, userId)) return;
  await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([previous]).catch(() => undefined);
}

/**
 * Pick a photo, validate it (sniffed type + size), upload to the private bucket and point the profile at it.
 * supabase-js reports no upload progress, so callers show an indeterminate "Uploading" state.
 */
export async function chooseAndUploadProfilePhoto(userId: string): Promise<PhotoResult> {
  if (Platform.OS !== 'web') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'error', message: 'TenisX needs access to your photos. You can allow it in your device settings.' };
    }
  }
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });
  if (picked.canceled || !picked.assets?.[0]) return { status: 'cancelled' };

  const bytes = picked.assets[0].base64 ? base64ToBytes(picked.assets[0].base64) : null;
  if (!bytes) return { status: 'error', message: 'That photo could not be read. Please choose another.' };
  const check = checkProfilePhoto(sniffDocumentMime(bytes), bytes.length);
  if (!check.ok) return { status: 'error', message: check.message };

  const previous = await currentAvatarPath(userId);
  const path = avatarObjectPath(userId, check.ext, Date.now());

  // ArrayBuffer body: a Blob body does not work through supabase-js on React Native.
  const up = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path, bytes.buffer as ArrayBuffer, { contentType: check.mime, upsert: false });
  if (up.error) return { status: 'error', message: friendlyStorageError(up.error.message) };

  // avatar_path (private) is what this app renders; avatar_url (legacy public URL read by Stage 2) is left alone.
  const upd = await db.from('profiles').update({ avatar_path: path }).eq('id', userId);
  if (upd.error) {
    await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([path]).catch(() => undefined); // do not orphan the upload
    return { status: 'error', message: `Your photo could not be saved: ${upd.error.message}` };
  }

  await deleteOldObject(userId, previous, path);
  await refreshProfileIdentity();
  return { status: 'ok' };
}

export async function removeProfilePhoto(userId: string): Promise<PhotoResult> {
  const previous = await currentAvatarPath(userId);
  // Removing the photo clears both: the private path and any legacy public URL, so no old picture lingers anywhere.
  const upd = await db.from('profiles').update({ avatar_path: null, avatar_url: null }).eq('id', userId);
  if (upd.error) return { status: 'error', message: `Your photo could not be removed: ${upd.error.message}` };
  await deleteOldObject(userId, previous, null);
  await refreshProfileIdentity();
  return { status: 'ok' };
}
