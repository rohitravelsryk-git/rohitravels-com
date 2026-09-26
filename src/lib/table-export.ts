// Shared client-side exporters: real .xlsx workbooks (bold headings, sized columns)
// and directly downloaded portrait PDF files (no print dialog).

import { formatDateTimeShort } from "@/lib/date-format";

export type ExportTable = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  subtitle?: string;
  numericColumns?: number[];
  highlightLastRow?: boolean;
  /** Wide sheets read better sideways; everything else stays portrait A4. */
  orientation?: "portrait" | "landscape";
  /** Overrides the download file name (e.g. the agency name). */
  fileName?: string;
};

/** "rohi travels" -> "Rohi Travels" */
function titleCase(text: string) {
  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .trim();
}

function fileBase(title: string, fileName?: string) {
  if (fileName?.trim()) {
    return titleCase(fileName.replace(/[^a-z0-9]+/gi, " ")).replace(/\s+/g, " ");
  }
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
export async function downloadExcel({
  title,
  headers,
  rows,
  subtitle,
  numericColumns = [],
  highlightLastRow = false,
  orientation = "portrait",
  fileName,
}: ExportTable) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rohi International Travels";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(title.slice(0, 30) || "Sheet1", {
    pageSetup: {
      paperSize: 9,
      orientation,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.properties.defaultRowHeight = 18;
  sheet.headerFooter.oddFooter = "Rohi International Travels  •  Page &P of &N";

  const brandRow = sheet.addRow(["ROHI INTERNATIONAL TRAVELS"]);
  brandRow.font = { name: "Arial", bold: true, size: 11, color: { argb: "FFD97757" } };
  brandRow.height = 20;
  brandRow.alignment = { vertical: "middle", horizontal: "left" };
  sheet.mergeCells(1, 1, 1, Math.max(headers.length, 1));

  const contactRow = sheet.addRow(["Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988"]);
  contactRow.font = { name: "Arial", size: 9, color: { argb: "FF6B6A64" } };
  contactRow.height = 17;
  contactRow.alignment = { vertical: "middle", horizontal: "left" };
  sheet.mergeCells(2, 1, 2, Math.max(headers.length, 1));

  const titleRow = sheet.addRow([title]);
  titleRow.font = { name: "Arial", bold: true, size: 16, color: { argb: "FF141413" } };
  titleRow.height = 25;
  titleRow.alignment = { vertical: "middle", horizontal: "left" };
  sheet.mergeCells(3, 1, 3, Math.max(headers.length, 1));

  const metaRow = sheet.addRow([
    subtitle ?? `Generated ${formatDateTimeShort(new Date())} • ${rows.length} records`,
  ]);
  metaRow.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B6A64" } };
  metaRow.height = 18;
  sheet.mergeCells(4, 1, 4, Math.max(headers.length, 1));

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
      const isHighlightedTotal = highlightLastRow && index === rows.length - 1;
      cell.font = {
        name: "Arial",
        size: 10,
        bold: isHighlightedTotal,
        color: { argb: isHighlightedTotal ? "FFFFFFFF" : "FF30302E" },
      };
      cell.border = {
        top: isHighlightedTotal ? { style: "medium", color: { argb: "FFD97757" } } : undefined,
        bottom: { style: "hair", color: { argb: isHighlightedTotal ? "FFD97757" : "FFE8E6DC" } },
      };
      if (isNumeric && typeof cell.value === "number") cell.numFmt = "#,##0;[Red](#,##0);-";
      if (isHighlightedTotal) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF141413" } };
      } else if (index % 2 === 1) {
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

  sheet.pageSetup.printArea = `A1:${sheet.getColumn(Math.max(headers.length, 1)).letter}${5 + rows.length}`;

  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5 + rows.length, column: Math.max(headers.length, 1) },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${fileBase(title, fileName)}.xlsx`,
  );
}

/** Downloads an A4 PDF file directly (no print dialog), portrait unless the sheet is wide. */
export async function downloadPdf({
  title,
  headers,
  rows,
  subtitle,
  numericColumns = [],
  highlightLastRow = false,
  orientation = "portrait",
  fileName,
}: ExportTable) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule as any).default ?? (autoTableModule as any).autoTable;

  const doc = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(217, 119, 87);
  doc.text("ROHI INTERNATIONAL TRAVELS", 36, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 106, 100);
  doc.text("Sardar Market, Shahi Road, Rahim Yar Khan  •  0305-6622988", 36, 47);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 19);
  doc.text(title, 36, 66);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 106, 100);
  doc.text(
    subtitle ?? `Generated ${formatDateTimeShort(new Date())} • ${rows.length} records`,
    36,
    82,
  );

  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell)))),
    startY: 96,
    margin: { top: 36, right: 28, bottom: 40, left: 28 },
    tableWidth: "auto",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4.5, overflow: "linebreak", valign: "middle", lineColor: [232, 230, 220], lineWidth: 0.35 },
    headStyles: { fillColor: [20, 20, 19], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center", lineColor: [217, 119, 87], lineWidth: 0.7 },
    bodyStyles: { textColor: [48, 48, 46] },
    alternateRowStyles: { fillColor: [250, 249, 245] },
    columnStyles: Object.fromEntries(numericColumns.map((index) => [index, { halign: "right", cellWidth: "wrap" }])),
    showHead: "firstPage",
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: 0,
    didParseCell: (hookData: any) => {
      if (highlightLastRow && hookData.section === "body" && hookData.row.index === rows.length - 1) {
        hookData.cell.styles.fillColor = [20, 20, 19];
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.lineColor = [217, 119, 87];
        hookData.cell.styles.lineWidth = 0.7;
      }
    },
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

  doc.save(`${fileBase(title, fileName)}.pdf`);
}
