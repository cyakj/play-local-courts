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
        className="flex items-center gap-3 px-4 min-h-[56px]"
        style={{ background: '#0F1F3D', paddingTop: 'max(12px, env(safe-area-inset-top))', paddingBottom: 12 }}
      >
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)', minWidth: 44 }}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white truncate" style={{ fontSize: 15, fontFamily: 'Manrope, sans-serif' }}>{doc.title}</div>
        </div>
        <button
          onClick={handleDownload}
          className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)', minWidth: 44 }}
          aria-label="Download"
        >
          <Download className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative bg-muted overflow-auto">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: '#F9FAFB' }}>
            <div className="w-10 h-10 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }} />
            <span className="text-sm" style={{ color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>Loading document…</span>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6" style={{ background: '#F9FAFB' }}>
            <div style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              width: '100%',
              maxWidth: 320,
              boxShadow: '0px 12px 32px rgba(15,31,61,0.04)',
              border: '1px solid rgba(15,31,61,0.08)',
              textAlign: 'center',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8892A4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
                <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#0F1F3D', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}>
                Preview unavailable
              </p>
              <p style={{ fontSize: 13, color: '#8892A4', marginBottom: 24, fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
                {errorMsg || 'Try downloading the file instead.'}
              </p>
              <button
                onClick={handleDownload}
                style={{
                  width: '100%',
                  minHeight: 48,
                  background: '#0F1F3D',
                  color: 'white',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: 'Manrope, sans-serif',
                  cursor: 'pointer',
                  padding: '14px 24px',
                }}
              >
                Download PDF
              </button>
            </div>
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
