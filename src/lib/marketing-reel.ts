/** Client-side reel builder: turns AI images + caption into a shareable video (no paid service). */
export type ReelOptions = {
  images: string[];
  headline: string;
  subline?: string;
  seconds?: number;
  width?: number;
  height?: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for the reel"));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom: number) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

export async function buildReel(opts: ReelOptions): Promise<Blob> {
  const width = opts.width ?? 720;
  const height = opts.height ?? 1280;
  const seconds = opts.seconds ?? 8;
  const frames = await Promise.all(opts.images.filter(Boolean).map(loadImage));
  if (frames.length === 0) throw new Error("Generate at least one image first");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  const stream = canvas.captureStream(30);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
  );
  if (!mime) throw new Error("This browser cannot record video — use Chrome or Edge");
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();
  const start = performance.now();
  const total = seconds * 1000;
  const per = total / frames.length;

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= total) { resolve(); return; }
      const idx = Math.min(frames.length - 1, Math.floor(elapsed / per));
      const local = (elapsed - idx * per) / per;
      const img = frames[idx]!;

      ctx.fillStyle = "#0a1f44";
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.globalAlpha = local < 0.12 ? local / 0.12 : 1;
      drawCover(ctx, img, width, height, 1.04 + local * 0.1);
      ctx.restore();

      // bottom gradient
      const grad = ctx.createLinearGradient(0, height * 0.45, 0, height);
      grad.addColorStop(0, "rgba(10,31,68,0)");
      grad.addColorStop(1, "rgba(10,31,68,0.95)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, height * 0.45, width, height * 0.55);

      // headline
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.round(width * 0.075)}px Georgia, serif`;
      const lines = wrap(ctx, opts.headline, width * 0.86);
      let y = height * 0.7;
      for (const line of lines) {
        ctx.fillText(line, width / 2, y);
        y += width * 0.09;
      }
      if (opts.subline) {
        ctx.fillStyle = "#e9c46a";
        ctx.font = `700 ${Math.round(width * 0.045)}px Arial, sans-serif`;
        ctx.fillText(opts.subline.slice(0, 60), width / 2, y + width * 0.02);
      }

      // brand bar
      ctx.fillStyle = "#e9c46a";
      ctx.fillRect(0, height - width * 0.145, width, width * 0.145);
      ctx.fillStyle = "#0a1f44";
      ctx.font = `900 ${Math.round(width * 0.05)}px Georgia, serif`;
      ctx.fillText("ROHI INTERNATIONAL TRAVELS", width / 2, height - width * 0.075);
      ctx.font = `800 ${Math.round(width * 0.038)}px Arial, sans-serif`;
      ctx.fillText("0305 6622988", width / 2, height - width * 0.022);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  return done;
}
