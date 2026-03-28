import { supabase } from '@/integrations/supabase/client';

/**
 * Extracts the storage path from a Supabase storage URL.
 * e.g. ".../object/public/hoa-documents/abc/file.pdf" → "abc/file.pdf"
 */
export const extractStoragePath = (url: string): string | null => {
  // Match various Supabase URL patterns
  const patterns = [
    /\/storage\/v1\/object\/(?:public|sign)\/hoa-documents\/(.+?)(?:\?|$)/,
    /\/object\/(?:public|sign)\/hoa-documents\/(.+?)(?:\?|$)/,
    /\/hoa-documents\/(.+?)(?:\?|$)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const path = decodeURIComponent(match[1]);
      console.log('[DocumentUtils] Extracted path:', path, 'from:', url);
      return path;
    }
  }

  console.warn('[DocumentUtils] Could not extract path from:', url);
  return null;
};

/**
 * Creates a signed URL for a private hoa-documents file.
 * Returns null if it fails (so callers can show error state).
 */
export const getSignedDocumentUrl = async (fileUrl: string): Promise<string | null> => {
  const path = extractStoragePath(fileUrl);
  if (!path) {
    console.error('[DocumentUtils] No path extracted, cannot create signed URL');
    return null;
  }

  const { data, error } = await supabase.storage
    .from('hoa-documents')
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    console.error('[DocumentUtils] createSignedUrl failed:', error?.message);
    return null;
  }

  console.log('[DocumentUtils] Signed URL created successfully');
  return data.signedUrl;
};

/**
 * Opens a document in a new tab using a signed URL.
 */
export const downloadDocument = async (fileUrl: string) => {
  const url = await getSignedDocumentUrl(fileUrl);
  if (url) {
    window.open(url, '_blank');
  } else {
    // Last resort fallback
    window.open(fileUrl, '_blank');
  }
};
