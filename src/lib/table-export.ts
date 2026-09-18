// Shared client-side exporters: real .xlsx workbooks (bold headings, sized columns)
// and directly downloaded portrait PDF files (no print dialog).

export type ExportTable = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  subtitle?: string;
  numericColumns?: number[];
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
export async function downloadExcel({ title, headers, rows, subtitle, numericColumns = [] }: ExportTable) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rohi International Travels";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(title.slice(0, 30) || "Sheet1", {
    views: [{ state: "frozen", ySplit: 3 }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.properties.defaultRowHeight = 18;
  sheet.headerFooter.oddFooter = "Rohi International Travels  •  Page &P of &N";

  const titleRow = sheet.addRow([title]);
  titleRow.font = { name: "Arial", bold: true, size: 16, color: { argb: "FF141413" } };
  titleRow.height = 25;
  titleRow.alignment = { vertical: "middle", horizontal: "left" };
  sheet.mergeCells(1, 1, 1, Math.max(headers.length, 1));

  const metaRow = sheet.addRow([
    subtitle ?? `Rohi International Travels • Generated ${new Date().toLocaleString()} • ${rows.length} records`,
  ]);
  metaRow.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B6A64" } };
  metaRow.height = 18;
  sheet.mergeCells(2, 1, 2, Math.max(headers.length, 1));

  const headerRow = sheet.addRow(headers);
  headerRow.height = 23;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF141413" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FFD97757" } } };
  });

  rows.forEach((row, index) => {
    const added = sheet.addRow(row);
    added.height = 20;
    added.eachCell((cell, columnNumber) => {
      const isNumeric = numericColumns.includes(columnNumber - 1) || typeof cell.value === "number";
      cell.alignment = {
        vertical: "middle",
        horizontal: isNumeric ? "right" : "left",
        wrapText: true,
      };
      cell.font = { name: "Arial", size: 10, color: { argb: "FF30302E" } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE8E6DC" } } };
      if (isNumeric && typeof cell.value === "number") cell.numFmt = "#,##0;[Red](#,##0);-";
      if (index % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF9F5" } };
      }
    });
  });

  headers.forEach((header, columnIndex) => {
    const widest = rows.reduce(
      (max, row) => Math.max(max, String(row[columnIndex] ?? "").length),
      String(header).length,
    );
    const isNumeric = numericColumns.includes(columnIndex);
    sheet.getColumn(columnIndex + 1).width = isNumeric
      ? Math.min(Math.max(widest + 3, 13), 18)
      : Math.min(Math.max(widest + 3, 11), 48);
  });

  sheet.pageSetup.printArea = `A1:${sheet.getColumn(Math.max(headers.length, 1)).letter}${3 + rows.length}`;

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
export async function downloadPdf({ title, headers, rows, subtitle, numericColumns = [] }: ExportTable) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 19);
  doc.text(title, 36, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 106, 100);
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
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4.5, overflow: "linebreak", valign: "middle", lineColor: [232, 230, 220], lineWidth: 0.35 },
    headStyles: { fillColor: [20, 20, 19], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center", lineColor: [217, 119, 87], lineWidth: 0.7 },
    bodyStyles: { textColor: [48, 48, 46] },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    columnStyles: Object.fromEntries(numericColumns.map((index) => [index, { halign: "right", cellWidth: "wrap" }])),
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
