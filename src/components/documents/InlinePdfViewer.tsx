import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { supabase } from '@/integrations/supabase/client';
import { getDocumentBlob, getSignedDocumentUrl, downloadDocument } from '@/lib/documentUtils';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

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
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [pageDataUrl, setPageDataUrl] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  const isImage = /\.(png|jpg|jpeg|gif|webp)/i.test(doc.file_url);
  const isPdf = /\.pdf/i.test(doc.file_url) || (!isImage);
  const canPreview = isImage || isPdf;

  // Load the PDF document
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(false);
      setErrorMsg('');
      setPreviewUrl(null);
      setPdfDoc(null);
      setPageDataUrl(null);

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
          setErrorMsg('This file type cannot be previewed. Please download it to view.');
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
        setLoading(false);
        return;
      }

      // PDF path
      try {
        const blob = await getDocumentBlob(doc.file_url);
        if (cancelled) return;
        if (!blob) {
          setError(true);
          setErrorMsg('Could not load this PDF. The file may have been moved or deleted.');
          setLoading(false);
          return;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        if (!cancelled) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setCurrentPage(1);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load PDF:', err);
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

  // Render current page whenever pdfDoc, currentPage, or zoom changes
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;

    const renderPage = async () => {
      setPageLoading(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const targetWidth = Math.max(320, Math.min(window.innerWidth - 32, 900));
        const dpr = window.devicePixelRatio || 1;
        const baseVp = page.getViewport({ scale: 1 });
        // Render at a high constant scale (accounting for max zoom) so zooming stays crisp
        const renderScale = (targetWidth / baseVp.width) * dpr * Math.max(1.5, zoom);
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = window.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d')!;

        await page.render({ canvas, canvasContext: ctx, viewport } as any).promise;
        if (!cancelled) {
          setPageDataUrl(canvas.toDataURL('image/jpeg', 0.92));
          setPageLoading(false);
        }
      } catch (err) {
        console.error('Failed to render page:', err);
        if (!cancelled) setPageLoading(false);
      }
    };

    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  const handleDownload = async () => {
    await downloadDocument(doc.id, doc.file_url, doc.file_name);
  };

  const goToPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const zoomIn = () => setZoom(z => Math.min(4.0, parseFloat((z + 0.25).toFixed(2))));
  const zoomOut = () => setZoom(z => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#F9FAFB' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          background: '#0F1F3D',
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 14,
          minHeight: 68,
        }}
      >
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.12)', minWidth: 44 }}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>

        <div className="flex-1 min-w-0 flex flex-col items-center px-2">
          <div
            className="font-bold text-white truncate w-full text-center"
            style={{ fontSize: 15, fontFamily: 'Manrope, sans-serif' }}
          >
            {doc.title}
          </div>
          {isPdf && totalPages > 0 && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>
              Page {currentPage} of {totalPages}
            </div>
          )}
        </div>

        <button
          onClick={handleDownload}
          className="w-11 h-11 rounded-[10px] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.12)', minWidth: 44 }}
          aria-label="Download"
        >
          <Download className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto relative" style={{ background: '#F9FAFB' }}>
        {/* Loading state */}
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className="w-10 h-10 border-2 rounded-full animate-spin"
              style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }}
            />
            <span style={{ fontSize: 14, color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
              Loading document…
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
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
              <svg
                width="48" height="48" viewBox="0 0 24 24" fill="none"
                stroke="#8892A4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ margin: '0 auto 16px', display: 'block' }}
              >
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
        )}

        {/* Image preview */}
        {!loading && !error && isImage && previewUrl && (
          <div className="p-4 flex items-center justify-center min-h-full">
            <img
              src={previewUrl}
              alt={doc.title}
              className="max-w-full rounded-xl"
              style={{ boxShadow: '0px 4px 16px rgba(15,31,61,0.08)' }}
            />
          </div>
        )}

        {/* PDF page view */}
        {!loading && !error && isPdf && (
          <div className="py-4 px-4 min-h-full flex justify-center">
            {pageLoading && (
              <div className="flex flex-col items-center gap-3 py-12">
                <div
                  className="w-10 h-10 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'rgba(0,212,255,0.2)', borderTopColor: '#00D4FF' }}
                />
                <span style={{ fontSize: 13, color: '#8892A4', fontFamily: 'Inter, sans-serif' }}>
                  Rendering page…
                </span>
              </div>
            )}
            {!pageLoading && pageDataUrl && (
              <img
                src={pageDataUrl}
                alt={`Page ${currentPage} of ${totalPages}`}
                className="rounded-xl block"
                style={{
                  width: `${Math.min(600, window.innerWidth - 32) * zoom}px`,
                  maxWidth: 'none',
                  height: 'auto',
                  boxShadow: '0px 4px 24px rgba(15,31,61,0.10)',
                  border: '1px solid rgba(15,31,61,0.06)',
                  transition: 'width 150ms ease-out',
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Controls bar (PDF only) */}
      {!loading && !error && isPdf && totalPages > 0 && (
        <div
          className="flex items-center justify-between px-5 flex-shrink-0"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(15,31,61,0.08)',
            paddingTop: 10,
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          }}
        >
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              disabled={zoom <= 0.5}
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: '#F3F4F6', opacity: zoom <= 0.5 ? 0.4 : 1 }}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-4 w-4" style={{ color: '#0F1F3D' }} />
            </button>
            <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#4B5563', minWidth: 44, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoom >= 3.0}
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: '#F3F4F6', opacity: zoom >= 3.0 ? 0.4 : 1 }}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-4 w-4" style={{ color: '#0F1F3D' }} />
            </button>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              disabled={currentPage === 1 || pageLoading}
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              style={{
                background: currentPage === 1 ? '#F3F4F6' : '#0F1F3D',
                opacity: currentPage === 1 || pageLoading ? 0.4 : 1,
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" style={{ color: currentPage === 1 ? '#8892A4' : 'white' }} />
            </button>
            <span style={{ fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#4B5563', minWidth: 52, textAlign: 'center' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={goToNext}
              disabled={currentPage === totalPages || pageLoading}
              className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-transform"
              style={{
                background: currentPage === totalPages ? '#F3F4F6' : '#0F1F3D',
                opacity: currentPage === totalPages || pageLoading ? 0.4 : 1,
              }}
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" style={{ color: currentPage === totalPages ? '#8892A4' : 'white' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InlinePdfViewer;
