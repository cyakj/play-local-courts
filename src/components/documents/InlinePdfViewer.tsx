import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';
import { getDocumentBlob, getSignedDocumentUrl, downloadDocument } from '@/lib/documentUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';

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

const InlinePdfViewer: React.FC<InlinePdfViewerProps> = ({ document: doc, userId, onClose, onViewed }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);

  const isImage = /\.(png|jpg|jpeg|gif|webp)/i.test(doc.file_url);
  const isPdf = /\.pdf/i.test(doc.file_url);
  const canPreview = isImage || isPdf;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(false);
      setErrorMsg('');
      setPreviewUrl(null);
      setPdfPages([]);

      // Track view
      try {
        await supabase
          .from('document_views' as any)
          .upsert(
            { document_id: doc.id, user_id: userId, viewed_at: new Date().toISOString() },
            { onConflict: 'document_id,user_id' }
          );
        onViewed?.();
      } catch (e) {
        console.error('Failed to track view:', e);
      }

      if (!canPreview) {
        if (!cancelled) {
          setError(true);
          setErrorMsg('This file type cannot be previewed inline. Please download it to view.');
          setLoading(false);
        }
        return;
      }

      if (isImage) {
        const url = await getSignedDocumentUrl(doc.id, doc.file_url);
        if (cancelled) return;
        if (!url) {
          setError(true);
          setErrorMsg('Could not load this document.');
          setLoading(false);
          return;
        }
        setPreviewUrl(url);
        return;
      }

      // PDF path
      try {
        console.time('PDFDownload');
        const blob = await getDocumentBlob(doc.file_url);
        console.timeEnd('PDFDownload');

        if (cancelled) return;
        if (!blob) {
          setError(true);
          setErrorMsg('Could not load this PDF. The file may have been moved or deleted.');
          setLoading(false);
          return;
        }

        console.time('PDFRender');
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages: string[] = [];
        const targetWidth = Math.max(320, Math.min(window.innerWidth - 32, 900));
        const dpr = window.devicePixelRatio || 1;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const baseVp = page.getViewport({ scale: 1 });
          const scale = (targetWidth / baseVp.width) * dpr;
          const viewport = page.getViewport({ scale });

          const canvas = window.document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext('2d')!;

          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          pages.push(canvas.toDataURL('image/jpeg', 0.92));
        }
        console.timeEnd('PDFRender');

        if (!cancelled) {
          setPdfPages(pages);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to render PDF:', err);
        if (!cancelled) {
          setError(true);
          setErrorMsg('This PDF could not be rendered. You can still download it.');
          setLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [doc.id, doc.file_url, userId]);

  const handleDownload = async () => {
    await downloadDocument(doc.id, doc.file_url, doc.file_name);
  };

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
          <div className="text-sm font-bold text-white truncate">{doc.title}</div>
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
            <p className="text-base font-semibold text-foreground text-center">Unable to preview</p>
            <p className="text-sm text-muted-foreground text-center">
              {errorMsg || 'Try downloading the file instead.'}
            </p>
            <button
              onClick={handleDownload}
              className="min-h-[44px] rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Download
            </button>
          </div>
        ) : isImage && previewUrl ? (
          <div className="p-4 flex items-center justify-center min-h-full">
            <img
              src={previewUrl}
              alt={doc.title}
              className="max-w-full rounded-lg shadow-md"
              onLoad={() => setLoading(false)}
              onError={() => { setError(true); setErrorMsg('Failed to load image.'); setLoading(false); }}
              style={{ display: loading ? 'none' : 'block' }}
            />
          </div>
        ) : isPdf && pdfPages.length > 0 ? (
          <div className="p-4 space-y-4">
            {pdfPages.map((src, i) => (
              <img
                key={`page-${i}`}
                src={src}
                alt={`Page ${i + 1}`}
                className="block w-full rounded-lg border border-border bg-card shadow-sm"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default InlinePdfViewer;
