import { supabase } from '@/integrations/supabase/client';

const extractStoragePath = (fileUrl: string): string | null => {
  const patterns = [
    /\/storage\/v1\/object\/(?:public|sign)\/hoa-documents\/(.+?)(?:\?|$)/,
    /\/object\/(?:public|sign)\/hoa-documents\/(.+?)(?:\?|$)/,
    /\/hoa-documents\/(.+?)(?:\?|$)/,
  ];

  for (const pattern of patterns) {
    const match = fileUrl.match(pattern);
    if (match) return decodeURIComponent(match[1]);
  }

  return null;
};

export const getSignedDocumentUrl = async (_documentId: string, fileUrl: string): Promise<string | null> => {
  const path = extractStoragePath(fileUrl);
  if (!path) {
    console.error('[DocumentUtils] Could not extract storage path');
    return null;
  }

  const { data, error } = await supabase.storage
    .from('hoa-documents')
    .download(path);

  if (error || !data) {
    console.error('[DocumentUtils] storage.download failed:', error?.message);
    return null;
  }

  return URL.createObjectURL(data);
};

export const downloadDocument = async (_documentId: string, fileUrl: string, originalFileName?: string) => {
  const path = extractStoragePath(fileUrl);
  if (!path) {
    console.error('[DocumentUtils] Could not extract storage path');
    return;
  }

  const { data, error } = await supabase.storage
    .from('hoa-documents')
    .download(path);

  if (error || !data) {
    console.error('[DocumentUtils] storage.download failed:', error?.message);
    return;
  }

  const objectUrl = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = path.split('/').pop() || 'document';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
