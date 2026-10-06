import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { GroupTicket } from './tickets.functions';
import { formatDateShort, formatDateTimeShort } from '@/lib/date-format';

export function downloadTicketsPDF(tickets: GroupTicket[]) {
  const doc = new jsPDF('l', 'mm', 'a4');
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(11, 37, 69); // Navy
  doc.text('ROHI INTERNATIONAL TRAVELS', 14, 20);
  
  doc.setFontSize(12);
  doc.text('Confirmed Group Tickets Ledger', 14, 28);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${formatDateTimeShort(new Date())}`, 14, 34);

  const tableData = tickets.map((t, idx) => [
    idx + 1,
    formatDateShort(t.booking_date),
    t.fare_id?.slice(0, 8) || '—',
    t.agent_name || '—',
    t.pax_name || '—',
    t.seats || 0,
    t.sector || '—',
    t.airline || '—',
    t.pnr || '—',
    t.flight_status || '—'
  ]);

  (doc as any).autoTable({
    startY: 40,
    head: [['SR', 'Date', 'Fare ID', 'Agency', 'Pax', 'Seats', 'Sector', 'Airline', 'PNR', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillStyle: [11, 37, 69], textColor: 255 },
    styles: { fontSize: 8 },
  });

  doc.save(`Confirmed_Tickets_${new Date().toISOString().split('T')[0]}.pdf`);
}
