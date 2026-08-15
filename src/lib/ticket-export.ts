import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { GroupTicket } from './tickets.functions';

export function downloadTicketsExcel(tickets: GroupTicket[]) {
  const data = tickets.map((t, idx) => ({
    'SR #': idx + 1,
    'Booking Date': t.booking_date ? new Date(t.booking_date).toLocaleDateString('en-GB') : '—',
    'Booking ID': t.booking_id || '—',
    'Fare ID': t.fare_id || '—',
    'Group Type': t.group_type?.toUpperCase() || 'PARTY',
    'Agency Name': t.agent_name || '—',
    'Pax Name': t.pax_name || '—',
    'Seats': t.seats || 0,
    'Sector': t.sector || '—',
    'Airline': t.airline || '—',
    'PNR': t.pnr || '—',
    'Travel Date': t.travel_at ? new Date(t.travel_at).toLocaleString('en-GB') : '—',
    'Status': t.flight_status || '—',
    'Vendor': t.vendor || '—',
    'Sale': t.sale || 0,
    'Purchase': t.purchase || 0,
    'Profit': t.profit || 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Confirmed Tickets');
  XLSX.writeFile(workbook, `Confirmed_Tickets_${new Date().toISOString().split('T')[0]}.xlsx`);
}

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
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);

  const tableData = tickets.map((t, idx) => [
    idx + 1,
    t.booking_date ? new Date(t.booking_date).toLocaleDateString('en-GB') : '—',
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
