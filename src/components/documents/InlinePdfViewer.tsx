import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';
import { getDocumentBlob, getSignedDocumentUrl, downloadDocument } from '@/lib/documentUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.5.207/pdf.worker.min.mjs`;

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);

  const isImage = /\.(png|jpg|jpeg|gif|webp)/i.test(document.file_url);
  const isPdf = /\.pdf/i.test(document.file_url);
  const canPreview = isImage || isPdf;

  useEffect(() => {
    let cancelled = false;

    const trackView = async () => {
      try {
        await supabase
          .from('document_views' as any)
          .upsert(
            { document_id: document.id, user_id: userId, viewed_at: new Date().toISOString() },
            { onConflict: 'document_id,user_id' }
          );
        onViewed?.();
      } catch (viewError) {
        console.error('Failed to track view:', viewError);
      }
    };

    const loadPreview = async () => {
      setLoading(true);
      setError(false);
      setErrorMsg('');
      setPreviewUrl(null);
      setPdfPages([]);

      await trackView();

      if (!canPreview) {
        if (!cancelled) {
          setError(true);
          setErrorMsg('This file type cannot be previewed inline. Please download it to view.');
          setLoading(false);
        }
        return;
      }

      if (isImage) {
        const url = await getSignedDocumentUrl(document.id, document.file_url);
        if (!url) {
          if (!cancelled) {
            setError(true);
            setErrorMsg('Could not generate a secure link for this document. The file may have been moved or deleted.');
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setPreviewUrl(url);
        }
        return;
      }

      const blob = await getDocumentBlob(document.file_url);
      if (!blob) {
        if (!cancelled) {
          setError(true);
          setErrorMsg('Could not load this PDF. The file may have been moved or deleted.');
          setLoading(false);
        }
        return;
      }

      try {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        const renderedPages: string[] = [];
        const targetWidth = Math.max(320, Math.min(window.innerWidth - 32, 900));

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = targetWidth / baseViewport.width;
          const viewport = page.getViewport({ scale });
          const canvas = window.document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('Canvas rendering is not available.');
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvas, canvasContext: context, viewport }).promise;
          renderedPages.push(canvas.toDataURL('image/png'));
        }

        if (!cancelled) {
          setPdfPages(renderedPages);
          setLoading(false);
        }
      } catch (pdfError) {
        console.error('Failed to render PDF:', pdfError);
        if (!cancelled) {
          setError(true);
          setErrorMsg('This PDF could not be rendered inline. You can still download it.');
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [document.id, document.file_url, onViewed, userId, canPreview, isImage]);

  const handleDownload = async () => {
    await downloadDocument(document.id, document.file_url, document.file_name);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 py-3 min-h-[56px] bg-cm-navy">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white/10 flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{document.title}</div>
        </div>
        <button
          onClick={handleDownload}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white/10 flex-shrink-0"
        >
          <Download className="h-5 w-5 text-white" />
        </button>
      </div>

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
            <p className="text-base font-semibold text-foreground text-center">Unable to preview this document</p>
            <p className="text-sm text-muted-foreground text-center">
              {errorMsg || 'This file type may not support inline preview. Try downloading it instead.'}
            </p>
          </div>
        ) : isImage && previewUrl ? (
          <div className="p-4 flex items-center justify-center min-h-full">
            <img
              src={previewUrl}
              alt={document.title}
              className="max-w-full rounded-lg shadow-md"
              onLoad={() => setLoading(false)}
              onError={() => {
                setError(true);
                setErrorMsg('Failed to load image.');
                setLoading(false);
              }}
              style={{ display: loading ? 'none' : 'block' }}
            />
          </div>
        ) : isPdf && pdfPages.length > 0 ? (
          <div className="p-4 space-y-4">
            {pdfPages.map((pageSrc, index) => (
              <img
                key={`${document.id}-page-${index + 1}`}
                src={pageSrc}
                alt={`${document.title} page ${index + 1}`}
                className="block w-full max-w-full mx-auto rounded-lg border border-border bg-card shadow-sm"
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default InlinePdfViewer;
