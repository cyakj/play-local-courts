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

const InlinePdfViewer: React.FC<InlinePdfViewerProps> = ({ document, userId, onClose, onViewed }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const markAsRead = async () => {
      try {
        const { error: upsertError } = await supabase
          .from('document_views' as any)
          .upsert(
            { document_id: document.id, user_id: userId, viewed_at: new Date().toISOString() },
            { onConflict: 'document_id,user_id' }
          );
        if (!upsertError) {
          onViewed?.();
        }
      } catch (e) {
        console.error('Failed to track view:', e);
      }
    };
    markAsRead();
  }, [document.id, userId]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0A1628]">
      {/* Navy gradient header */}
      <div
        className="flex items-center gap-3 px-4 py-3 min-h-[56px]"
        style={{ background: 'linear-gradient(135deg, #0A1628 0%, #1a2a4a 100%)' }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-white/[0.12] flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{document.title}</div>
        </div>
        <a
          href={document.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-white/[0.12] flex-shrink-0"
        >
          <Download className="h-4 w-4 text-white" />
        </a>
      </div>

      {/* PDF content area */}
      <div className="flex-1 relative bg-[#0A1628]">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-[#00B4D8] animate-spin" />
            <span className="text-sm text-white/60">Loading document…</span>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6">
            <div className="text-4xl">📄</div>
            <p className="text-sm text-white/70 text-center">
              Unable to load document. Try downloading instead.
            </p>
            <a
              href={document.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-[10px] bg-[#00B4D8] text-white text-sm font-bold"
            >
              Download File
            </a>
          </div>
        ) : (
          <iframe
            src={`${document.file_url}#toolbar=0`}
            className="w-full h-full border-0"
            style={{ display: loading ? 'none' : 'block' }}
            onLoad={() => setLoading(false)}
            onError={() => { setError(true); setLoading(false); }}
            title={document.title}
          />
        )}
      </div>
    </div>
  );
};

export default InlinePdfViewer;
