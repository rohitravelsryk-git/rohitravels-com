import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function createSampleTicketPDF(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // ---------- PAGE 1: E-Ticket Receipt ----------
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width: p1W, height: p1H } = page1.getSize();

  // Header Banner (Navy)
  page1.drawRectangle({
    x: 0,
    y: p1H - 70,
    width: p1W,
    height: 70,
    color: rgb(0.08, 0.12, 0.24), // #141E3C Navy
  });

  // Agency Title
  page1.drawText('ROHI INTERNATIONAL TRAVELS', {
    x: 25,
    y: p1H - 38,
    size: 16,
    font: fontBold,
    color: rgb(0.87, 0.73, 0.42), // #DEC46C Gold
  });

  page1.drawText('ELECTRONIC TICKET RECEIPT & ITINERARY', {
    x: 25,
    y: p1H - 56,
    size: 9,
    font: fontRegular,
    color: rgb(1, 1, 1),
  });

  page1.drawText('BOOKING REF: RIT-98241', {
    x: p1W - 170,
    y: p1H - 42,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Section 1: Passenger & Ticket Info Box
  page1.drawRectangle({
    x: 25,
    y: p1H - 180,
    width: p1W - 50,
    height: 95,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });

  page1.drawText('PASSENGER DETAILS', {
    x: 35,
    y: p1H - 100,
    size: 10,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.24),
  });

  page1.drawText('Passenger Name:  MR MUHAMMAD AHMED / ABDUL REHMAN', { x: 35, y: p1H - 120, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('e-Ticket Number:  272-9981452091-92', { x: 35, y: p1H - 136, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('Issuing Agency:    ROHI INTERNATIONAL TRAVELS RYK', { x: 35, y: p1H - 152, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('IATA Code:            27391824', { x: 35, y: p1H - 168, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });

  page1.drawText('Issue Date:  15 SEP 2026', { x: p1W - 190, y: p1H - 120, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('Status:        CONFIRMED', { x: p1W - 190, y: p1H - 136, size: 9, font: fontBold, color: rgb(0.1, 0.6, 0.2) });

  // Section 2: Flight Segment Details
  page1.drawText('FLIGHT ITINERARY', {
    x: 25,
    y: p1H - 205,
    size: 11,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.24),
  });

  // Table Header
  page1.drawRectangle({
    x: 25,
    y: p1H - 230,
    width: p1W - 50,
    height: 20,
    color: rgb(0.9, 0.92, 0.96),
  });

  page1.drawText('FLIGHT', { x: 35, y: p1H - 224, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  page1.drawText('DEPARTURE', { x: 110, y: p1H - 224, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  page1.drawText('ARRIVAL', { x: 230, y: p1H - 224, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  page1.drawText('CLASS', { x: 350, y: p1H - 224, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  page1.drawText('BAGGAGE', { x: 420, y: p1H - 224, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  page1.drawText('STATUS', { x: 500, y: p1H - 224, size: 8, font: fontBold, color: rgb(0.1, 0.1, 0.2) });

  // Outbound Row
  page1.drawText('SV-731', { x: 35, y: p1H - 250, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('Saudia', { x: 35, y: p1H - 262, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page1.drawText('ISLAMABAD (ISB)', { x: 110, y: p1H - 250, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('24 OCT 2026 - 06:15 AM', { x: 110, y: p1H - 262, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page1.drawText('JEDDAH (JED)', { x: 230, y: p1H - 250, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('24 OCT 2026 - 09:45 AM', { x: 230, y: p1H - 262, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page1.drawText('Economy (K)', { x: 350, y: p1H - 250, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('2 PC (23KG ea)', { x: 420, y: p1H - 250, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('CONFIRMED', { x: 500, y: p1H - 250, size: 8, font: fontBold, color: rgb(0.1, 0.6, 0.2) });

  // Inbound Row
  page1.drawLine({ start: { x: 25, y: p1H - 275 }, end: { x: p1W - 25, y: p1H - 275 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

  page1.drawText('SV-732', { x: 35, y: p1H - 295, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('Saudia', { x: 35, y: p1H - 307, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page1.drawText('JEDDAH (JED)', { x: 110, y: p1H - 295, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('15 NOV 2026 - 11:30 PM', { x: 110, y: p1H - 307, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page1.drawText('ISLAMABAD (ISB)', { x: 230, y: p1H - 295, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('16 NOV 2026 - 06:40 AM', { x: 230, y: p1H - 307, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  page1.drawText('Economy (K)', { x: 350, y: p1H - 295, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('2 PC (23KG ea)', { x: 420, y: p1H - 295, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page1.drawText('CONFIRMED', { x: 500, y: p1H - 295, size: 8, font: fontBold, color: rgb(0.1, 0.6, 0.2) });

  // Section 3: Fare & Taxes (Whiteout/Erase Target)
  page1.drawRectangle({
    x: 25,
    y: p1H - 420,
    width: p1W - 50,
    height: 90,
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 0.99),
  });

  page1.drawText('PAYMENT & FARE BREAKDOWN (CONFIDENTIAL SUPPLIER DATA)', {
    x: 35,
    y: p1H - 345,
    size: 9,
    font: fontBold,
    color: rgb(0.7, 0.2, 0.2),
  });

  page1.drawText('Base Fare:            PKR 185,000', { x: 35, y: p1H - 365, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page1.drawText('Taxes & Surcharges:   PKR 45,500', { x: 35, y: p1H - 380, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page1.drawText('Agency Markup/Fee:   PKR 12,000 (Supplier Net Comm: 5%)', { x: 35, y: p1H - 395, size: 9, font: fontRegular, color: rgb(0.5, 0.2, 0.2) });
  page1.drawText('TOTAL COST:          PKR 242,500', { x: 35, y: p1H - 410, size: 10, font: fontBold, color: rgb(0.08, 0.12, 0.24) });

  // Notice for testing
  page1.drawText('* Use the Edit/Whiteout or Redact tool to erase/blackout confidential supplier costs above before sending to customer.', {
    x: 25,
    y: p1H - 440,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Footer
  page1.drawLine({ start: { x: 25, y: 50 }, end: { x: p1W - 25, y: 50 }, thickness: 1, color: rgb(0.87, 0.73, 0.42) });
  page1.drawText('Rohi International Travels · Rahim Yar Khan / Islamabad · WhatsApp: +92 300 8671155', {
    x: 25,
    y: 35,
    size: 8,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });
  page1.drawText('Page 1 of 2', { x: p1W - 75, y: 35, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

  // ---------- PAGE 2: Terms & Passenger Guidelines ----------
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  const { height: p2H } = page2.getSize();

  // Page 2 Header
  page2.drawRectangle({
    x: 0,
    y: p2H - 50,
    width: p1W,
    height: 50,
    color: rgb(0.08, 0.12, 0.24),
  });

  page2.drawText('IMPORTANT TRAVEL INFORMATION & CONDITIONS', {
    x: 25,
    y: p2H - 32,
    size: 12,
    font: fontBold,
    color: rgb(0.87, 0.73, 0.42),
  });

  page2.drawText('1. CHECK-IN & BOARDING REQUIREMENTS', { x: 25, y: p2H - 80, size: 10, font: fontBold, color: rgb(0.08, 0.12, 0.24) });
  page2.drawText('• Passengers must report at international airport check-in counters 4 hours prior to scheduled departure.', { x: 35, y: p2H - 98, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText('• Original passport with minimum 6 months validity from travel date is mandatory.', { x: 35, y: p2H - 112, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText('• Valid visa, return ticket, and Ok-To-Board (if required) must be presented.', { x: 35, y: p2H - 126, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  page2.drawText('2. BAGGAGE POLICY & RESTRICTIONS', { x: 25, y: p2H - 155, size: 10, font: fontBold, color: rgb(0.08, 0.12, 0.24) });
  page2.drawText('• Hand baggage allowance: 1 piece up to 7KG per passenger.', { x: 35, y: p2H - 173, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText('• Checked baggage excess weight will be charged as per airline tariffs at airport counters.', { x: 35, y: p2H - 187, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  page2.drawText('3. CANCELLATION & REISSUANCE RULES', { x: 25, y: p2H - 215, size: 10, font: fontBold, color: rgb(0.08, 0.12, 0.24) });
  page2.drawText('• Date change or cancellation penalty fees apply per passenger segment plus any fare difference.', { x: 35, y: p2H - 233, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page2.drawText('• No-Show penalty applies if cancellation is not requested at least 24 hours before flight departure.', { x: 35, y: p2H - 247, size: 8.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  // Page 2 Footer
  page2.drawLine({ start: { x: 25, y: 50 }, end: { x: p1W - 25, y: 50 }, thickness: 1, color: rgb(0.87, 0.73, 0.42) });
  page2.drawText('Rohi International Travels · www.rohitravels.com · Support: info@rohitravels.com', {
    x: 25,
    y: 35,
    size: 8,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });
  page2.drawText('Page 2 of 2', { x: p1W - 75, y: 35, size: 8, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

  return pdfDoc.save();
}
