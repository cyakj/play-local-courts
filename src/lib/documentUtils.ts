import { supabase } from '@/integrations/supabase/client';

export const getSignedDocumentUrl = async (documentId: string, fileUrl: string): Promise<string | null> => {
  const { data, error } = await supabase.functions.invoke('get-document-signed-url', {
    body: { documentId, fileUrl },
  });

  if (error || !data?.signedUrl) {
    console.error('[DocumentUtils] get-document-signed-url failed:', error?.message || data?.error);
    return null;
  }

  return data.signedUrl;
};

export const downloadDocument = async (documentId: string, fileUrl: string) => {
  const url = await getSignedDocumentUrl(documentId, fileUrl);
  if (url) {
    window.open(url, '_blank');
  }
};
