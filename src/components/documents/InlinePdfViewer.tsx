import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getSignedDocumentUrl, downloadDocument } from '@/lib/documentUtils';

interface InlinePdfViewerProps {
  document: {
    id: string;
    title: string;
    file_url: string;
    file_name?: string;
  };
  userId: string;
  onClose: () => void;
  onViewed?: () => void;
}

const InlinePdfViewer: React.FC<InlinePdfViewerProps> = ({ document, userId, onClose, onViewed }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
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

      // Get signed URL
      const url = await getSignedDocumentUrl(document.id, document.file_url);
      if (!url) {
        setErrorMsg('Could not generate a secure link for this document. The file may have been moved or deleted.');
        setError(true);
        setLoading(false);
        return;
      }

      setSignedUrl(url);
    };

    init();
  }, [document.id, userId]);

  const handleDownload = async () => {
    await downloadDocument(document.id, document.file_url);
  };

  const isImage = /\.(png|jpg|jpeg|gif|webp)/i.test(document.file_url);
  const isPdf = /\.pdf/i.test(document.file_url);
  const canPreview = isImage || isPdf;

  // For non-previewable files, skip iframe entirely and show download prompt
  useEffect(() => {
    if (!canPreview && signedUrl) {
      setLoading(false);
      setError(true);
      setErrorMsg('This file type (.docx, .doc, etc.) cannot be previewed inline. Please download it to view.');
    }
  }, [canPreview, signedUrl]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 min-h-[56px]"
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

      {/* Content */}
      <div className="flex-1 relative bg-muted overflow-auto">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Loading document…</span>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 bg-muted">
            <div className="text-5xl">📄</div>
            <p className="text-base font-semibold text-foreground text-center">
              Unable to preview this document
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {errorMsg || 'This file type may not support inline preview. Try downloading it instead.'}
            </p>
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
                  onError={() => { setError(true); setErrorMsg('Failed to load image.'); setLoading(false); }}
                  style={{ display: loading ? 'none' : 'block' }}
                />
              </div>
            ) : (
              <iframe
                src={signedUrl}
                className="w-full h-full border-0 bg-white"
                style={{ display: loading ? 'none' : 'block' }}
                onLoad={() => setLoading(false)}
                onError={() => { setError(true); setErrorMsg('Failed to load document.'); setLoading(false); }}
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
