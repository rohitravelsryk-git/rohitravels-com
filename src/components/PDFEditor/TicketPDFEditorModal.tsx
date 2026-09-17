import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { TicketPDFEditorModalProps } from '@/types/pdf';
import { PDFProvider, usePDF } from '@/context/PDFContext';
import { RibbonHeader } from './RibbonHeader';
import { SidebarNav } from './SidebarNav';
import { PDFViewer } from './PDFViewer';
import { SignatureModal } from './SignatureModal';
import { loadPDFDocument } from '@/utils/pdfHelpers';
import { exportEditedPDF, printPDFBytes } from '@/utils/pdfExporter';
import { createSampleTicketPDF } from '@/utils/defaultDocument';

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
        // Generate sample ticket PDF
        bytesToLoad = await createSampleTicketPDF();
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

  const handleOpenSamplePDF = () => {
    loadDoc();
  };

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
      const blob = new Blob([editedBytes], { type: 'application/pdf' });
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
          Foxit Ticket PDF Editor — {bookingRef}
        </span>
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded bg-gray-800 px-2 py-0.5 text-gray-300 hover:bg-rose-600 hover:text-white"
        >
          <X className="h-3.5 w-3.5" /> Close Editor
        </button>
      </div>

      {/* Foxit Ribbon Navigation Header */}
      <RibbonHeader
        bookingRef={bookingRef}
        onOpenSamplePDF={handleOpenSamplePDF}
        onUploadPDF={handleUploadFile}
        onPrint={handlePrint}
        onSave={handleSave}
      />

      {/* Main Viewport with Sidebar & PDF Canvas Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        <SidebarNav />
        <PDFViewer />
      </div>

      {/* Signature Creation Modal */}
      <SignatureModal />

      {/* Saving Overlay Spinner */}
      {saving && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 text-white backdrop-blur-xs">
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-[#FF6600]" />
          <p className="text-sm font-bold">Compiling & Exporting Native PDF via pdf-lib...</p>
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
