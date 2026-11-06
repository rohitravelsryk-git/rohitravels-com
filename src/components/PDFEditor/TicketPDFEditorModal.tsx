import React from 'react';
import TicketCanvasStudio from '@/components/PDFStudio/TicketCanvasStudio';
import { TicketPDFEditorModalProps } from '@/types/pdf';

export const TicketPDFEditorModal: React.FC<TicketPDFEditorModalProps> = ({
  isOpen = true,
  onClose,
  pdfBytes,
  bookingRef = 'TICKET',
  userRole = 'admin',
  onSaveToBooking,
  profile,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <TicketCanvasStudio
        portal={userRole === 'admin' ? 'Admin Ticket Studio' : 'Agent Ticket Studio'}
        initialPdfBytes={pdfBytes}
        fileName={`${bookingRef}.pdf`}
        isOpen={isOpen}
        onClose={onClose}
        onApplyToTicket={(editedBytes) => {
          if (onSaveToBooking) {
            void onSaveToBooking(editedBytes);
          }
        }}
        profile={profile}
        initialHeaderEnabled={true}
        initialFooterEnabled={true}
        initialHeaderFooterPages="first"
      />
    </div>
  );
};

export default TicketPDFEditorModal;
