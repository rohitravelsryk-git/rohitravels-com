import type * as pdfjsTypes from 'pdfjs-dist';

// PDF.js is loaded lazily (dynamic import) instead of at module scope.
// Its canvas module evaluates DOMMatrix-dependent code when the bundle runs,
// which crashes SSR / dev-server (Node) contexts where DOMMatrix does not
// exist and blank-screens the page. All browser-only work now happens on
// first call, always from the client.

// PDF.js 6 uses this new Map proposal. Chromium versions without it need a
// small standards-compatible fallback before a page is rendered.
function ensureMapGetOrInsertComputed() {
  const mapPrototype = Map.prototype as Map<unknown, unknown> & {
    getOrInsertComputed?: (key: unknown, callback: (key: unknown) => unknown) => unknown;
  };
  if (!mapPrototype.getOrInsertComputed) {
    mapPrototype.getOrInsertComputed = function (key, callback) {
      if (this.has(key)) return this.get(key);
      const value = callback(key);
      this.set(key, value);
      return value;
    };
  }
}

let pdfjsPromise: Promise<typeof pdfjsTypes> | null = null;

/** Lazily loads and configures pdfjs-dist. Call and await at the top of every helper. */
export function getPdfjs(): Promise<typeof pdfjsTypes> {
  if (!pdfjsPromise) {
    ensureMapGetOrInsertComputed();
    pdfjsPromise = import('pdfjs-dist').then((lib) => {
      if (typeof window !== 'undefined' && !lib.GlobalWorkerOptions.workerSrc) {
        // Use cdnjs matching worker for browser client side
        lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version || '4.10.38'}/pdf.worker.min.mjs`;
      }
      return lib;
    });
  }
  return pdfjsPromise;
}

export interface RenderPageOptions {
  pdfDoc: pdfjsTypes.PDFDocumentProxy;
  pageIndex: number; // 0-based
  canvas: HTMLCanvasElement;
  scale?: number;
  rotation?: number;
}

export async function loadPDFDocument(data: Uint8Array | ArrayBuffer | string): Promise<pdfjsTypes.PDFDocumentProxy> {
  const pdfjsLib = await getPdfjs();
  if (typeof data === 'string') {
    const loadingTask = pdfjsLib.getDocument({ url: data });
    return loadingTask.promise;
  }
  // PDF.js transfers the supplied buffer to its worker. Always pass a copy so
  // the original bytes remain usable by the editor, exporter, and print flow.
  const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  return loadingTask.promise;
}

export async function renderPDFPageCanvas({
  pdfDoc,
  pageIndex,
  canvas,
  scale = 1.5,
  rotation = 0,
}: RenderPageOptions): Promise<{ width: number; height: number }> {
  await getPdfjs();
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation });

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context failed to initialize');

  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  ctx.save();
  ctx.scale(outputScale, outputScale);

  const renderContext = {
    canvas,
    canvasContext: ctx,
    viewport,
  };

  await page.render(renderContext).promise;
  ctx.restore();

  return { width: viewport.width, height: viewport.height };
}

export async function renderPDFPageTextLayer({
  pdfDoc,
  pageIndex,
  container,
  scale = 1.5,
  rotation = 0,
}: {
  pdfDoc: pdfjsTypes.PDFDocumentProxy;
  pageIndex: number;
  container: HTMLDivElement;
  scale?: number;
  rotation?: number;
}): Promise<void> {
  const pdfjsLib = await getPdfjs();
  container.innerHTML = '';
  try {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale, rotation });
    const textContent = await page.getTextContent();

    container.style.width = `${Math.floor(viewport.width)}px`;
    container.style.height = `${Math.floor(viewport.height)}px`;

    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container,
      viewport,
    });
    await textLayer.render();
    container.querySelectorAll('span').forEach((span) => {
      span.style.color = 'transparent';
      span.style.cursor = 'text';
      span.style.userSelect = 'text';
    });
  } catch (err) {
    console.warn('Failed to render text layer:', err);
  }
}

export async function generateThumbnailDataUrl(
  pdfDoc: pdfjsTypes.PDFDocumentProxy,
  pageIndex: number,
  thumbScale = 0.3
): Promise<string> {
  await getPdfjs();
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: thumbScale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  return canvas.toDataURL('image/png');
}

export interface SearchResult {
  pageIndex: number;
  text: string;
  matchIndex: number;
}

export async function searchPDFText(
  pdfDoc: pdfjsTypes.PDFDocumentProxy,
  query: string
): Promise<SearchResult[]> {
  if (!query || !query.trim()) return [];
  const results: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  for (let i = 0; i < pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i + 1);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str ?? '');
    const pageText = strings.join(' ');
    let idx = pageText.toLowerCase().indexOf(q);

    while (idx !== -1) {
      const snippetStart = Math.max(0, idx - 20);
      const snippetEnd = Math.min(pageText.length, idx + q.length + 20);
      const textSnippet = pageText.substring(snippetStart, snippetEnd);
      results.push({ pageIndex: i, text: textSnippet, matchIndex: idx });
      idx = pageText.toLowerCase().indexOf(q, idx + q.length);
    }
  }

  return results;
}
