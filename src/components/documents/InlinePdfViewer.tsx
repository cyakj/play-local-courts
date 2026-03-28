import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface InlinePdfViewerProps {
  document: {
    id: string;
    title: string;
    file_url: string;
  };
  userId: string;
  onClose: () => void;
  onViewed?: () => void;
}

/**
 * Extracts the storage path from a full Supabase public URL.
 * e.g. ".../object/public/hoa-documents/abc/file.pdf" → "abc/file.pdf"
 */
const extractStoragePath = (url: string): string | null => {
  // Match /object/public/hoa-documents/... or /object/sign/hoa-documents/...
  const match = url.match(/\/object\/(?:public|sign)\/hoa-documents\/(.+)$/);
  if (match) return decodeURIComponent(match[1]);

  // Also handle /storage/v1/object/public/hoa-documents/...
  const match2 = url.match(/\/storage\/v1\/object\/(?:public|sign)\/hoa-documents\/(.+)$/);
  if (match2) return decodeURIComponent(match2[1]);

  return null;
};

const InlinePdfViewer: React.FC<InlinePdfViewerProps> = ({ document, userId, onClose, onViewed }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Mark as read
      try {
        await supabase
          .from('document_views' as any)
          .upsert(
            { document_id: document.id, user_id: userId, viewed_at: new Date().toISOString() },
            { onConflict: 'document_id,user_id' }
          );
        onViewed?.();
      } catch (e) {
        console.error('Failed to track view:', e);
      }

      // Generate signed URL for private bucket
      const storagePath = extractStoragePath(document.file_url);
      if (storagePath) {
        const { data, error: signError } = await supabase.storage
          .from('hoa-documents')
          .createSignedUrl(storagePath, 3600); // 1 hour

        if (signError || !data?.signedUrl) {
          console.error('Signed URL error:', signError);
          setError(true);
          setLoading(false);
          return;
        }
        setSignedUrl(data.signedUrl);
      } else {
        // Fallback: try using the URL directly
        setSignedUrl(document.file_url);
      }
    };

    init();
  }, [document.id, userId]);

  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  const isPdf = document.file_url.toLowerCase().includes('.pdf');
  const isImage = /\.(png|jpg|jpeg|gif|webp)/i.test(document.file_url);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 min-h-[56px] safe-area-top"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1a2a4a 100%)' }}
      >
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white/[0.12] flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{document.title}</div>
        </div>
        <button
          onClick={handleDownload}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white/[0.12] flex-shrink-0"
        >
          <Download className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 relative bg-gray-50 overflow-auto">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-50">
            <Loader2 className="h-8 w-8 text-[#00B4D8] animate-spin" />
            <span className="text-sm text-gray-500">Loading document…</span>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 bg-gray-50">
            <div className="text-5xl">📄</div>
            <p className="text-base font-semibold text-gray-800 text-center">
              Unable to preview this document
            </p>
            <p className="text-sm text-gray-500 text-center">
              This file type may not support inline preview. Try downloading it instead.
            </p>
            <button
              onClick={handleDownload}
              className="px-6 py-3 rounded-xl bg-[#00B4D8] text-white text-sm font-bold mt-2"
            >
              Download File
            </button>
          </div>
        ) : signedUrl ? (
          <>
            {isImage ? (
              <div className="p-4 flex items-center justify-center min-h-full">
                <img
                  src={signedUrl}
                  alt={document.title}
                  className="max-w-full rounded-lg shadow-md"
                  onLoad={() => setLoading(false)}
                  onError={() => { setError(true); setLoading(false); }}
                  style={{ display: loading ? 'none' : 'block' }}
                />
              </div>
            ) : (
              <iframe
                src={signedUrl}
                className="w-full h-full border-0"
                style={{ display: loading ? 'none' : 'block', background: 'white' }}
                onLoad={() => setLoading(false)}
                onError={() => { setError(true); setLoading(false); }}
                title={document.title}
              />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default InlinePdfViewer;
