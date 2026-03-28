import { supabase } from '@/integrations/supabase/client';

/**
 * Extracts the storage path from a Supabase storage URL.
 * e.g. ".../object/public/hoa-documents/abc/file.pdf" → "abc/file.pdf"
 */
export const extractStoragePath = (url: string): string | null => {
  const match = url.match(/\/(?:object|storage\/v1\/object)\/(?:public|sign)\/hoa-documents\/(.+?)(?:\?|$)/);
  if (match) return decodeURIComponent(match[1]);
  
  // Simpler fallback: match after /hoa-documents/
  const fallback = url.match(/\/hoa-documents\/(.+?)(?:\?|$)/);
  if (fallback) return decodeURIComponent(fallback[1]);

  return null;
};

/**
 * Creates a signed URL for a private hoa-documents file.
 * Falls back to the original URL if path extraction fails.
 */
export const getSignedDocumentUrl = async (fileUrl: string): Promise<string> => {
  const path = extractStoragePath(fileUrl);
  if (!path) return fileUrl;

  const { data, error } = await supabase.storage
    .from('hoa-documents')
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL:', error);
    return fileUrl;
  }

  return data.signedUrl;
};

/**
 * Opens a document in a new tab using a signed URL.
 */
export const downloadDocument = async (fileUrl: string) => {
  const url = await getSignedDocumentUrl(fileUrl);
  window.open(url, '_blank');
};
