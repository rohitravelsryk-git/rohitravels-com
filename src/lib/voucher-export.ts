// Voucher table exporters — formatted .xlsx workbook and direct portrait PDF download.

import { downloadExcel, downloadPdf, type ExportTable } from "@/lib/table-export";

export type { ExportTable };

/** Kept name for existing callers: now downloads a formatted Excel workbook. */
export function downloadCsv(table: ExportTable) {
  return downloadExcel(table);
}

/** Kept name for existing callers: now downloads a portrait PDF file directly. */
export function printPdf(table: ExportTable) {
  return downloadPdf(table);
}

export { downloadExcel, downloadPdf };
