import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import {
  DOCUMENTS_BUCKET,
  canPreviewInApp,
  classifyStorageError,
  extractStoragePath,
  mimeForFile,
  safeFileName,
  type DocumentFailure,
} from '@/lib/communityDocuments';

export interface DocumentRef {
  file_url: string | null;
  file_name: string | null;
  title: string;
}

export type DocumentResult = { ok: true } | { ok: false; failure: DocumentFailure };

// Signed URLs are only used immediately (viewer open / download start), so a
// short lifetime is enough and keeps leaked links useless.
const SIGNED_URL_TTL_SECONDS = 300;

type SignedUrlResult = { ok: true; url: string } | { ok: false; failure: DocumentFailure };

/**
 * The bucket is private: access is granted by the "Approved HOA members can read
 * HOA documents" storage policy, evaluated for the signed-in resident when the URL
 * is created. Nothing is made public.
 */
export async function getSignedDocumentUrl(fileUrl: string | null): Promise<SignedUrlResult> {
  const path = extractStoragePath(fileUrl);
  if (!path) return { ok: false, failure: 'no-file' };

  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      return { ok: false, failure: classifyStorageError(error as any) === 'unknown' ? 'not-found' : classifyStorageError(error as any) };
    }
    return { ok: true, url: data.signedUrl };
  } catch (e: any) {
    return { ok: false, failure: classifyStorageError({ message: e?.message }) };
  }
}

/** Downloads to the app cache, re-signing once if the first link is rejected as expired. */
async function downloadToCache(doc: DocumentRef): Promise<{ ok: true; uri: string } | { ok: false; failure: DocumentFailure }> {
  const name = safeFileName(doc.file_name ?? doc.title);
  for (let attempt = 0; attempt < 2; attempt++) {
    const signed = await getSignedDocumentUrl(doc.file_url);
    if (!signed.ok) return signed;
    try {
      const file = await File.downloadFileAsync(signed.url, new File(Paths.cache, name), { idempotent: true });
      return { ok: true, uri: file.uri };
    } catch (e: any) {
      const failure = classifyStorageError({ message: e?.message });
      if (failure === 'expired' && attempt === 0) continue;
      return { ok: false, failure: failure === 'unknown' ? 'network' : failure };
    }
  }
  return { ok: false, failure: 'expired' };
}

async function shareFile(uri: string, doc: DocumentRef): Promise<DocumentResult> {
  if (!(await Sharing.isAvailableAsync())) return { ok: false, failure: 'unknown' };
  await Sharing.shareAsync(uri, {
    mimeType: mimeForFile(doc.file_name),
    dialogTitle: doc.title,
  });
  return { ok: true };
}

/**
 * VIEW — PDFs/images open in the in-app browser sheet (SFSafariViewController on
 * iOS) over a short-lived signed URL. Office files can't be rendered by it, so
 * they are fetched to cache and opened through the system sheet instead.
 */
export async function viewDocument(doc: DocumentRef): Promise<DocumentResult> {
  if (canPreviewInApp(doc.file_name) || Platform.OS === 'web') {
    const signed = await getSignedDocumentUrl(doc.file_url);
    if (!signed.ok) return signed;
    try {
      if (Platform.OS === 'web') {
        window.open(signed.url, '_blank', 'noopener');
      } else {
        await WebBrowser.openBrowserAsync(signed.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          controlsColor: '#2DE0FF',
          toolbarColor: '#0C0F18',
        });
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, failure: classifyStorageError({ message: e?.message }) };
    }
  }

  const downloaded = await downloadToCache(doc);
  if (!downloaded.ok) return downloaded;
  try {
    return await shareFile(downloaded.uri, doc);
  } catch (e: any) {
    return { ok: false, failure: classifyStorageError({ message: e?.message }) };
  }
}

/**
 * DOWNLOAD — saves the real file. On iOS the file is fetched into the app cache
 * and the system share sheet is presented ("Save to Files", AirDrop, Mail…).
 * On web a normal browser download is triggered.
 */
export async function downloadDocument(doc: DocumentRef): Promise<DocumentResult> {
  if (Platform.OS === 'web') {
    const signed = await getSignedDocumentUrl(doc.file_url);
    if (!signed.ok) return signed;
    try {
      const res = await fetch(signed.url);
      if (!res.ok) return { ok: false, failure: classifyStorageError({ status: res.status }) };
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = safeFileName(doc.file_name ?? doc.title);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, failure: classifyStorageError({ message: e?.message }) };
    }
  }

  const downloaded = await downloadToCache(doc);
  if (!downloaded.ok) return downloaded;
  try {
    return await shareFile(downloaded.uri, doc);
  } catch (e: any) {
    return { ok: false, failure: classifyStorageError({ message: e?.message }) };
  }
}
