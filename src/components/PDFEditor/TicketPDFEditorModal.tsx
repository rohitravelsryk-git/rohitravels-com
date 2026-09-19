import React, { useEffect, useState } from 'react';
import { X, Loader2, Upload, FileText } from 'lucide-react';
import { TicketPDFEditorModalProps } from '@/types/pdf';
import { PDFProvider, usePDF } from '@/context/PDFContext';
import { RibbonHeader } from './RibbonHeader';
import { SidebarNav } from './SidebarNav';
import { PDFViewer } from './PDFViewer';
import { PropertyListPanel } from './PropertyListPanel';
import { SignatureModal } from './SignatureModal';
import { loadPDFDocument } from '@/utils/pdfHelpers';
import { exportEditedPDF, printPDFBytes } from '@/utils/pdfExporter';

const EditorContent: React.FC<TicketPDFEditorModalProps> = ({
  onClose,
  pdfUrl,
  pdfBytes: propPdfBytes,
  bookingRef = 'TICKET-789',
  userRole = 'admin',
  onSaveAndPrint,
  onSaveToBooking,
}) => {
  const {
    setPdfDoc,
    pdfBytes,
    setPdfBytes,
    setIsLoading,
    setUserRole,
    setAnnotations,
    setSelectedAnnotationId,
    setCurrentPageIndex,
    annotations,
    pagesInfo,
    pageOrder,
    setPageOrder,
    isDarkMode,
    selectedAnnotationId,
    deleteAnnotation,
    addAnnotation,
    undo,
    redo,
    setZoomScale,
  } = usePDF();

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUserRole(userRole);
  }, [userRole, setUserRole]);

  // Load document when modal opens
  const loadDoc = async (sourceBytes?: Uint8Array, sourceUrl?: string) => {
    setIsLoading(true);
    setAnnotations([]);
    setSelectedAnnotationId(null);
    setCurrentPageIndex(0);

    try {
      let bytesToLoad: Uint8Array;

      if (sourceBytes) {
        bytesToLoad = sourceBytes;
      } else if (sourceUrl) {
        const resp = await fetch(sourceUrl);
        const buf = await resp.arrayBuffer();
        bytesToLoad = new Uint8Array(buf);
      } else {
        setPdfBytes(null);
        setPdfDoc(null);
        setPageOrder([]);
        return;
      }

      setPdfBytes(bytesToLoad);
      const doc = await loadPDFDocument(bytesToLoad);
      setPdfDoc(doc);
      setPageOrder(Array.from({ length: doc.numPages }, (_, i) => i));
    } catch (err) {
      console.error('Failed to load PDF document into editor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDoc(propPdfBytes, pdfUrl);
  }, [pdfUrl, propPdfBytes]);

  const handleUploadFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    loadDoc(new Uint8Array(buf));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (isTyping) return;

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedAnnotationId) {
        event.preventDefault();
        deleteAnnotation(selectedAnnotationId);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const pageElement = (range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? range.commonAncestorContainer as Element
          : range.commonAncestorContainer.parentElement)?.closest<HTMLElement>('[data-pdf-page-index]');
        if (!pageElement) return;
        const pageRect = pageElement.getBoundingClientRect();
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 1 && rect.height > 1);
        if (rects.length === 0) return;
        event.preventDefault();
        const pageIndex = Number(pageElement.dataset.pdfPageIndex || 0);
        rects.forEach((rect) => addAnnotation({
          pageIndex,
          type: 'whiteout',
          x: Math.max(0, ((rect.left - pageRect.left) / pageRect.width) * 100),
          y: Math.max(0, ((rect.top - pageRect.top) / pageRect.height) * 100),
          width: Math.min(100, (rect.width / pageRect.width) * 100),
          height: Math.min(100, (rect.height / pageRect.height) * 100),
        }));
        selection.removeAllRanges();
        return;
      }

      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      if (command && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      if (command && event.key.toLowerCase() === 's') { event.preventDefault(); void handleSave(); }
      if (command && event.key.toLowerCase() === 'p') { event.preventDefault(); void handlePrint(); }
      if (command && (event.key === '+' || event.key === '=')) { event.preventDefault(); setZoomScale((scale) => Math.min(5, scale + 0.15)); }
      if (command && event.key === '-') { event.preventDefault(); setZoomScale((scale) => Math.max(0.25, scale - 0.15)); }
      if (event.key === 'Escape') setSelectedAnnotationId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAnnotationId, deleteAnnotation, addAnnotation, undo, redo, setZoomScale]);

  const handleCompilePDF = async (): Promise<Uint8Array | null> => {
    if (!pdfBytes) return null;
    return exportEditedPDF({
      originalPdfBytes: pdfBytes,
      annotations,
      pagesInfo,
      pageOrder,
    });
  };

  const handlePrint = async () => {
    setSaving(true);
    try {
      const editedBytes = await handleCompilePDF();
      if (!editedBytes) return;
      if (onSaveAndPrint) onSaveAndPrint(editedBytes);
      printPDFBytes(editedBytes);
    } catch (e) {
      console.error('Print compile failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const editedBytes = await handleCompilePDF();
      if (!editedBytes) return;

      if (onSaveToBooking) {
        await onSaveToBooking(editedBytes);
      }

      // Download file to browser
      const blob = new Blob([editedBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Ticket_${bookingRef || 'edited'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Save PDF failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col bg-gray-900 ${isDarkMode ? 'dark' : ''}`}>
      {/* Top Window Bar */}
      <div className="flex h-9 items-center justify-between bg-black px-4 text-xs font-bold text-gray-300">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#FF6600]" />
          Rohi Ticket PDF Editor — {bookingRef}
        </span>
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded bg-gray-800 px-2 py-0.5 text-gray-300 hover:bg-rose-600 hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Close Editor
        </button>
      </div>

      <RibbonHeader
        bookingRef={bookingRef}
        onUploadPDF={handleUploadFile}
        onPrint={handlePrint}
        onSave={handleSave}
      />

      {/* Main Viewport with Sidebar & PDF Canvas Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        <SidebarNav />
        <PDFViewer />
        <PropertyListPanel />
      </div>

      {!pdfBytes && (
        <div className="absolute inset-x-0 bottom-0 top-[9.25rem] z-40 flex items-center justify-center bg-gray-100/95 p-6 dark:bg-gray-950/95">
          <label className="flex max-w-md cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-12 py-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <FileText className="mb-3 h-10 w-10 text-[#FF6600]" />
            <span className="text-base font-bold text-gray-900 dark:text-white">Open a ticket PDF</span>
            <span className="mt-1 text-xs text-gray-500">No sample or placeholder document is loaded.</span>
            <span className="mt-4 inline-flex items-center gap-2 rounded bg-[#FF6600] px-4 py-2 text-xs font-bold text-white"><Upload className="h-4 w-4" /> Choose PDF</span>
            <input type="file" accept="application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleUploadFile(file); }} />
          </label>
        </div>
      )}

      {/* Signature Creation Modal */}
      <SignatureModal />

      {/* Saving Overlay Spinner */}
      {saving && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 text-white backdrop-blur-xs">
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-[#FF6600]" />
          <p className="text-sm font-bold">Preparing your edited ticket…</p>
        </div>
      )}
    </div>
  );
};

export const TicketPDFEditorModal: React.FC<TicketPDFEditorModalProps> = (props) => {
  if (!props.isOpen) return null;

  return (
    <PDFProvider initialRole={props.userRole}>
      <EditorContent {...props} />
    </PDFProvider>
  );
};
