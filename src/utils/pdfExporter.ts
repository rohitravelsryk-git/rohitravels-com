import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { PDFAnnotation, PDFPageInfo } from '@/types/pdf';

// Utility to convert hex color (#FF0000 or #F00) to pdf-lib rgb
function hexToRgb(hex?: string) {
  if (!hex) return rgb(0, 0, 0);
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return rgb(0, 0, 0);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

export async function exportEditedPDF({
  originalPdfBytes,
  annotations,
  pagesInfo,
  pageOrder,
}: {
  originalPdfBytes: Uint8Array;
  annotations: PDFAnnotation[];
  pagesInfo: PDFPageInfo[];
  pageOrder?: number[]; // list of original page indices to keep/reorder
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Apply page reordering & deletions if pageOrder is specified
  if (pageOrder && pageOrder.length > 0) {
    const totalOriginalPages = pdfDoc.getPageCount();
    const keepIndicesSet = new Set(pageOrder);
    // Remove pages backwards if not in keepIndicesSet
    for (let i = totalOriginalPages - 1; i >= 0; i--) {
      if (!keepIndicesSet.has(i)) {
        pdfDoc.removePage(i);
      }
    }
  }

  // Embed annotations page by page
  const pageCount = pdfDoc.getPageCount();

  for (let pIndex = 0; pIndex < pageCount; pIndex++) {
    const page = pdfDoc.getPage(pIndex);
    const { width: pageW, height: pageH } = page.getSize();
    const info = pagesInfo.find((p) => p.pageIndex === pIndex);

    if (info && info.rotation) {
      page.setRotation(degrees(info.rotation));
    }

    const pageAnns = annotations.filter((a) => a.pageIndex === pIndex);

    for (const ann of pageAnns) {
      switch (ann.type) {
        case 'whiteout': {
          const w = (ann.width / 100) * pageW;
          const h = (ann.height / 100) * pageH;
          const x = (ann.x / 100) * pageW;
          const y = pageH - (ann.y / 100) * pageH - h; // Top-left to bottom-left Y
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(1, 1, 1),
          });
          break;
        }

        case 'redact': {
          const w = (ann.width / 100) * pageW;
          const h = (ann.height / 100) * pageH;
          const x = (ann.x / 100) * pageW;
          const y = pageH - (ann.y / 100) * pageH - h;
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            color: rgb(0, 0, 0),
          });
          if (ann.reason) {
            page.drawText(ann.reason, {
              x: x + 4,
              y: y + h / 2 - 4,
              size: Math.min(10, h * 0.5),
              font,
              color: rgb(1, 1, 1),
            });
          }
          break;
        }

        case 'text':
        case 'form_text': {
          const x = (ann.x / 100) * pageW;
          const h = (ann.height / 100) * pageH;
          const y = pageH - (ann.y / 100) * pageH - (ann.fontSize || 14);
          const fontToUse = ann.fontWeight === 'bold' ? font : regularFont;
          
          if (ann.backgroundColor) {
            const w = (ann.width / 100) * pageW;
            const bgY = pageH - (ann.y / 100) * pageH - h;
            page.drawRectangle({
              x,
              y: bgY,
              width: w,
              height: h,
              color: hexToRgb(ann.backgroundColor),
            });
          }

          page.drawText(ann.text || '', {
            x,
            y,
            size: ann.fontSize || 14,
            font: fontToUse,
            color: hexToRgb(ann.textColor),
          });
          break;
        }

        case 'stamp': {
          const w = (ann.width / 100) * pageW;
          const h = (ann.height / 100) * pageH;
          const x = (ann.x / 100) * pageW;
          const y = pageH - (ann.y / 100) * pageH - h;

          const stampText = ann.stampType === 'CUSTOM' ? (ann.customText || 'STAMP') : ann.stampType.replace('_', ' ');
          let stampColor = rgb(0.85, 0.2, 0.2); // Default red
          if (ann.stampType === 'APPROVED' || ann.stampType === 'COMPLETED') stampColor = rgb(0.1, 0.6, 0.25);
          if (ann.stampType === 'CONFIDENTIAL') stampColor = rgb(0.85, 0.2, 0.2);
          if (ann.stampType === 'DRAFT') stampColor = rgb(0.4, 0.4, 0.4);

          // Draw double border stamp
          page.drawRectangle({
            x,
            y,
            width: w,
            height: h,
            borderColor: stampColor,
            borderWidth: 2,
          });

          page.drawText(stampText, {
            x: x + 8,
            y: y + h / 2 - 6,
            size: Math.min(14, h * 0.45),
            font,
            color: stampColor,
          });
          break;
        }

        case 'signature': {
          if (!ann.imageDataUrl) break;
          try {
            const base64Data = ann.imageDataUrl.split(',')[1] || ann.imageDataUrl;
            const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
            const image = ann.imageDataUrl.includes('image/jpeg')
              ? await pdfDoc.embedJpg(imageBytes)
              : await pdfDoc.embedPng(imageBytes);

            const w = (ann.width / 100) * pageW;
            const h = (ann.height / 100) * pageH;
            const x = (ann.x / 100) * pageW;
            const y = pageH - (ann.y / 100) * pageH - h;

            page.drawImage(image, { x, y, width: w, height: h });
          } catch (e) {
            console.warn('Failed to embed signature image:', e);
          }
          break;
        }

        case 'highlight':
        case 'underline':
        case 'strikethrough': {
          const w = (ann.width / 100) * pageW;
          const h = (ann.height / 100) * pageH;
          const x = (ann.x / 100) * pageW;
          const y = pageH - (ann.y / 100) * pageH - h;

          if (ann.type === 'highlight') {
            page.drawRectangle({
              x,
              y,
              width: w,
              height: h,
              color: hexToRgb(ann.color || '#FFFF00'),
              opacity: 0.35,
            });
          } else if (ann.type === 'underline') {
            page.drawLine({
              start: { x, y: y + 2 },
              end: { x: x + w, y: y + 2 },
              thickness: 2,
              color: hexToRgb(ann.color || '#0000FF'),
            });
          } else if (ann.type === 'strikethrough') {
            page.drawLine({
              start: { x, y: y + h / 2 },
              end: { x: x + w, y: y + h / 2 },
              thickness: 1.5,
              color: hexToRgb(ann.color || '#FF0000'),
            });
          }
          break;
        }

        case 'pen': {
          if (!ann.points || ann.points.length < 2) break;
          const strokeColor = hexToRgb(ann.color || '#000000');
          for (let i = 0; i < ann.points.length - 1; i++) {
            const p1 = ann.points[i];
            const p2 = ann.points[i + 1];
            page.drawLine({
              start: { x: p1.x * pageW, y: pageH - p1.y * pageH },
              end: { x: p2.x * pageW, y: pageH - p2.y * pageH },
              thickness: ann.strokeWidth || 2,
              color: strokeColor,
            });
          }
          break;
        }

        case 'rectangle':
        case 'circle':
        case 'line':
        case 'arrow': {
          const w = (ann.width / 100) * pageW;
          const h = (ann.height / 100) * pageH;
          const x = (ann.x / 100) * pageW;
          const y = pageH - (ann.y / 100) * pageH - h;
          const strokeColor = hexToRgb(ann.strokeColor || '#000000');

          if (ann.type === 'rectangle') {
            page.drawRectangle({
              x,
              y,
              width: w,
              height: h,
              borderColor: strokeColor,
              borderWidth: ann.strokeWidth || 2,
              color: ann.fillColor ? hexToRgb(ann.fillColor) : undefined,
            });
          } else if (ann.type === 'circle') {
            const rx = w / 2;
            const ry = h / 2;
            page.drawEllipse({
              x: x + rx,
              y: y + ry,
              xScale: rx,
              yScale: ry,
              borderColor: strokeColor,
              borderWidth: ann.strokeWidth || 2,
              color: ann.fillColor ? hexToRgb(ann.fillColor) : undefined,
            });
          } else if (ann.type === 'line' || ann.type === 'arrow') {
            page.drawLine({
              start: { x, y: y + h },
              end: { x: x + w, y },
              thickness: ann.strokeWidth || 2,
              color: strokeColor,
            });
          }
          break;
        }

        case 'sticky': {
          const x = (ann.x / 100) * pageW;
          const y = pageH - (ann.y / 100) * pageH - 24;
          page.drawRectangle({
            x,
            y,
            width: 24,
            height: 24,
            color: hexToRgb(ann.color || '#FEF08A'),
            borderColor: rgb(0.8, 0.7, 0.2),
            borderWidth: 1,
          });
          page.drawText('?', { x: x + 8, y: y + 6, size: 14, font, color: rgb(0.3, 0.3, 0.3) });
          break;
        }
      }
    }
  }

  return pdfDoc.save();
}

export function printPDFBytes(pdfBytes: Uint8Array) {
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  };
}
