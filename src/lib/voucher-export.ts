// Client-side exporters for the voucher tables (CSV for Excel/Google Sheets, print-to-PDF).

export type ExportTable = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
};

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv({ title, headers, rows }: ExportTable) {
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

function esc(s: string | number): string {
  return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

export function printPdf({ title, headers, rows }: ExportTable) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #12213f; }
  h1 { font-size: 18px; margin: 0 0 2px; letter-spacing: .5px; }
  p.meta { font-size: 10px; color: #6b7280; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-family: Arial, Helvetica, sans-serif; }
  th { background: #12213f; color: #fff; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; padding: 6px 5px; text-align: left; }
  td { font-size: 10px; padding: 5px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #faf8f4; }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="meta">Rohi International Travels • Generated ${new Date().toLocaleString()} • ${rows.length} records</p>
<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>
<script>window.onload = function(){ window.focus(); window.print(); }<\/script>
</body></html>`;

  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) {
    alert("Please allow pop-ups to download the PDF.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
