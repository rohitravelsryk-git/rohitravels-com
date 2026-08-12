import { jsPDF } from "jspdf";
import "jspdf-autotable";

export type ExportTable = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

/**
 * Download as Excel-compatible CSV.
 */
export function downloadCsv({ title, headers, rows }: ExportTable) {
  const csvCell = (v: string | number): string => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM so Excel picks up UTF-8 correctly.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Generate and download/open PDF using jsPDF for better consistency and auto-download.
 */
export function downloadPdf({ title, headers, rows }: ExportTable) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Add branding and title
  doc.setFontSize(18);
  doc.setTextColor(18, 33, 63); // Navy #12213F
  doc.text(title, 14, 20);

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // Gray-500
  const dateStr = new Date().toLocaleString();
  doc.text(`Rohi International Travels • Generated ${dateStr} • ${rows.length} records`, 14, 26);

  // AutoTable
  (doc as any).autoTable({
    startY: 32,
    head: [headers],
    body: rows,
    theme: "striped",
    headStyles: {
      fillColor: [18, 33, 63],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [250, 248, 244],
    },
    margin: { left: 14, right: 14 },
  });

  const fileName = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date()
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(fileName);
}
