// Shared client-side exporters: real .xlsx workbooks (bold headings, sized columns)
// and directly downloaded portrait PDF files (no print dialog).

export type ExportTable = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  subtitle?: string;
};

function fileBase(title: string) {
  return `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-${new Date()
    .toISOString()
    .slice(0, 10)}`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads a formatted .xlsx workbook (opens in Excel and Google Sheets). */
export async function downloadExcel({ title, headers, rows, subtitle }: ExportTable) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rohi International Travels";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(title.slice(0, 30) || "Sheet1", {
    views: [{ state: "frozen", ySplit: 2 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 14, color: { argb: "FF12213F" } };
  titleRow.height = 22;
  sheet.mergeCells(1, 1, 1, Math.max(headers.length, 1));

  const metaRow = sheet.addRow([
    subtitle ?? `Rohi International Travels • Generated ${new Date().toLocaleString()} • ${rows.length} records`,
  ]);
  metaRow.font = { size: 9, italic: true, color: { argb: "FF6B7280" } };
  sheet.mergeCells(2, 1, 2, Math.max(headers.length, 1));

  const headerRow = sheet.addRow(headers);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12213F" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB08D57" } } };
  });

  rows.forEach((row, index) => {
    const added = sheet.addRow(row);
    added.eachCell((cell) => {
      cell.alignment = {
        vertical: "middle",
        horizontal: typeof cell.value === "number" ? "right" : "left",
        wrapText: false,
      };
      cell.font = { size: 10 };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
      if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF8F4" } };
      }
    });
  });

  headers.forEach((header, columnIndex) => {
    const widest = rows.reduce(
      (max, row) => Math.max(max, String(row[columnIndex] ?? "").length),
      String(header).length,
    );
    sheet.getColumn(columnIndex + 1).width = Math.min(Math.max(widest + 4, 10), 45);
  });

  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3 + rows.length, column: Math.max(headers.length, 1) },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileBase(title)}.xlsx`,
  );
}

/** Downloads a portrait A4 PDF file directly (no print dialog). */
export async function downloadPdf({ title, headers, rows, subtitle }: ExportTable) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(18, 33, 63);
  doc.text(title, 36, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text(
    subtitle ?? `Rohi International Travels • Generated ${new Date().toLocaleString()} • ${rows.length} records`,
    36,
    60,
  );

  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell)))),
    startY: 74,
    margin: { top: 74, right: 28, bottom: 40, left: 28 },
    tableWidth: "auto",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, overflow: "linebreak", valign: "middle", lineColor: [229, 231, 235], lineWidth: 0.4 },
    headStyles: { fillColor: [18, 33, 63], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
    bodyStyles: { textColor: [31, 41, 55] },
    alternateRowStyles: { fillColor: [250, 248, 244] },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Rohi International Travels • Page ${page}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 18,
        { align: "center" },
      );
    },
  });

  doc.save(`${fileBase(title)}.pdf`);
}
