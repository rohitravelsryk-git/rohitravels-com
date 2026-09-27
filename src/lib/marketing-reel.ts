/** Client-side professional short-form reel builder for Rohi marketing. */
export type ReelOptions = {
  images: string[];
  headline: string;
  subline?: string;
  route?: string;
  airline?: string;
  flightDetails?: string[];
  baggage?: string;
  fare?: string;
  seats?: string;
  cta?: string;
  seconds?: number;
  width?: number;
  height?: number;
  music?: boolean;
};

export type ReelResult = { blob: Blob; ext: "mp4" | "webm"; mime: string };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for the reel"));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom = 1, panX = 0, panY = 0) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2 + panX, (h - dh) / 2 + panY, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line); line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number, family: string): number {
  let size = start;
  while (size > min) {
    ctx.font = `900 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y); ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius); ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius); ctx.closePath();
}

/** Original procedural ambient travel beat — no external/copyrighted audio file is used. */
function buildMusic(seconds: number): { track: MediaStreamTrack; stop: () => void } | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const dest = ctx.createMediaStreamDestination();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.8);
    master.gain.setValueAtTime(0.16, ctx.currentTime + Math.max(1, seconds - 1));
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    master.connect(dest);

    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 2400; filter.connect(master);
    const pad = [220, 261.63, 329.63, 392, 493.88];
    pad.forEach((freq, i) => {
      const osc = ctx.createOscillator(); osc.type = i % 2 ? "triangle" : "sine"; osc.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = 0.045 / (1 + i * 0.45);
      osc.connect(g).connect(filter); osc.start(); osc.stop(ctx.currentTime + seconds + 0.1);
    });
    const melody = [659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25, 783.99];
    for (let i = 0; i * 0.5 < seconds; i++) {
      const t = ctx.currentTime + 0.55 + i * 0.5;
      const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = melody[i % melody.length]!;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.055, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g).connect(filter); osc.start(t); osc.stop(t + 0.35);
    }
    return { track: dest.stream.getAudioTracks()[0]!, stop: () => void ctx.close().catch(() => {}) };
  } catch { return null; }
}

function pickMime(withAudio: boolean): { mime: string; ext: "mp4" | "webm" } | null {
  const candidates: Array<{ mime: string; ext: "mp4" | "webm" }> = withAudio ? [
    { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" }, { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9,opus", ext: "webm" }, { mime: "video/webm;codecs=vp8,opus", ext: "webm" }, { mime: "video/webm", ext: "webm" },
  ] : [
    { mime: 'video/mp4;codecs="avc1.42E01E"', ext: "mp4" }, { mime: "video/webm;codecs=vp9", ext: "webm" }, { mime: "video/webm", ext: "webm" },
  ];
  return candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

export async function buildReel(opts: ReelOptions): Promise<ReelResult> {
  const width = opts.width ?? 1080, height = opts.height ?? 1920, seconds = opts.seconds ?? 15;
  const frames = await Promise.all(opts.images.filter(Boolean).map(loadImage));
  if (!frames.length) throw new Error("Generate at least one image first");
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Canvas is not supported in this browser");
  const stream = canvas.captureStream(30);
  const music = opts.music === false ? null : buildMusic(seconds); if (music) stream.addTrack(music.track);
  const picked = pickMime(!!music); if (!picked) throw new Error("This browser cannot record video — use Chrome or Edge");
  const recorder = new MediaRecorder(stream, { mimeType: picked.mime, videoBitsPerSecond: 7_000_000, audioBitsPerSecond: 128_000 });
  const chunks: BlobPart[] = []; recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const outMime = picked.ext === "mp4" ? "video/mp4" : "video/webm";
  const done = new Promise<ReelResult>((resolve) => { recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: outMime }), ext: picked.ext, mime: outMime }); });

  const route = (opts.route || opts.headline).toUpperCase();
  const airline = (opts.airline || opts.subline || "ROHI INTERNATIONAL TRAVELS").toUpperCase();
  const details = (opts.flightDetails || []).filter(Boolean).slice(0, 3).map((x) => x.toUpperCase());
  const fare = opts.fare?.trim();
  const scenes = [
    { start: 0, end: 0.18, kind: "hook" },
    { start: 0.18, end: 0.40, kind: "proof" },
    { start: 0.40, end: 0.66, kind: "value" },
    { start: 0.66, end: 0.84, kind: "decision" },
    { start: 0.84, end: 1, kind: "cta" },
  ];

  recorder.start();
  const start = performance.now(), total = seconds * 1000;
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start, progress = Math.min(0.9999, elapsed / total);
      if (elapsed >= total) { resolve(); return; }
      const frame = frames[Math.floor(progress * frames.length) % frames.length]!;
      const scene = scenes.find((s) => progress >= s.start && progress < s.end) ?? scenes[4]!;
      const local = (progress - scene.start) / (scene.end - scene.start);
      const sceneIndex = scenes.indexOf(scene);

      ctx.clearRect(0, 0, width, height);
      const panX = Math.sin(progress * Math.PI * 2) * width * 0.018;
      const panY = Math.cos(progress * Math.PI * 1.4) * height * 0.012;
      const zoom = 1.04 + sceneIndex * 0.025 + local * 0.035;
      ctx.save();
      ctx.globalAlpha = Math.min(1, local < 0.16 ? local / 0.16 : 1);
      drawCover(ctx, frame, width, height, zoom, panX, panY);
      ctx.restore();

      // Cinematic readability layer; keeps all text in a protected safe zone.
      const top = ctx.createLinearGradient(0, 0, 0, height * 0.52); top.addColorStop(0, "rgba(5,18,42,.88)"); top.addColorStop(1, "rgba(5,18,42,0)");
      ctx.fillStyle = top; ctx.fillRect(0, 0, width, height * 0.52);
      const bottom = ctx.createLinearGradient(0, height * 0.48, 0, height); bottom.addColorStop(0, "rgba(5,18,42,0)"); bottom.addColorStop(1, "rgba(5,18,42,.96)");
      ctx.fillStyle = bottom; ctx.fillRect(0, height * 0.48, width, height * 0.52);

      const margin = width * 0.075, safeW = width - margin * 2;
      const enter = Math.min(1, local / 0.18), exit = local > 0.82 ? (1 - local) / 0.18 : 1;
      const alpha = Math.min(enter, exit);
      const slide = (1 - enter) * width * 0.035;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(slide, 0); ctx.textAlign = "left";

      if (scene.kind === "hook") {
        ctx.fillStyle = "#e9c46a"; roundRect(ctx, margin, height * 0.10, width * 0.31, height * 0.045, 16); ctx.fill();
        ctx.fillStyle = "#071d42"; ctx.font = `900 ${Math.round(width * 0.032)}px Arial,sans-serif`; ctx.fillText("LIVE GROUP FARE", margin + width * 0.018, height * 0.132);
        ctx.fillStyle = "#fff"; const fs = fitFont(ctx, route, safeW, width * 0.085, width * 0.052, "Arial,sans-serif"); ctx.font = `900 ${fs}px Arial,sans-serif`;
        const lines = wrap(ctx, route, safeW, 2); let y = height * 0.22; for (const line of lines) { ctx.fillText(line, margin, y); y += fs * 1.08; }
        ctx.fillStyle = "#e9c46a"; ctx.font = `800 ${Math.round(width * 0.045)}px Arial,sans-serif`; ctx.fillText("A deal worth checking before you book elsewhere.", margin, y + width * 0.045);
      } else if (scene.kind === "proof") {
        ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(width * 0.055)}px Arial,sans-serif`; ctx.fillText("THE DETAILS THAT MATTER", margin, height * 0.18);
        ctx.fillStyle = "rgba(7,29,66,.90)"; roundRect(ctx, margin, height * 0.22, safeW, height * 0.28, 28); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `800 ${Math.round(width * 0.041)}px Arial,sans-serif`;
        let y = height * 0.285; for (const line of details) { ctx.fillText("✈  " + line, margin + width * 0.035, y); y += width * 0.065; }
        if (opts.baggage) { ctx.fillStyle = "#e9c46a"; ctx.fillText("BAGGAGE  " + opts.baggage.toUpperCase(), margin + width * 0.035, y + width * 0.015); }
      } else if (scene.kind === "value") {
        ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(width * 0.052)}px Arial,sans-serif`; ctx.fillText("WHY THIS OFFER MATTERS", margin, height * 0.17);
        const cards = ["CLEAR ROUTE + DATES", opts.baggage ? "BAGGAGE INCLUDED" : "FLIGHT DETAILS READY", fare ? "PRICE SHOWN CLEARLY" : "CHECK LIVE PRICE ON WHATSAPP"];
        let cy = height * 0.24; for (const card of cards) { ctx.fillStyle = "rgba(255,255,255,.94)"; roundRect(ctx, margin, cy, safeW, height * 0.075, 18); ctx.fill(); ctx.fillStyle = "#071d42"; ctx.font = `850 ${Math.round(width * 0.034)}px Arial,sans-serif`; ctx.fillText("✓  " + card, margin + width * 0.028, cy + height * 0.048); cy += height * 0.095; }
      } else if (scene.kind === "decision") {
        ctx.fillStyle = "#e9c46a"; ctx.font = `900 ${Math.round(width * 0.047)}px Arial,sans-serif`; ctx.fillText("READY TO CHECK THIS FARE?", margin, height * 0.18);
        if (fare) { ctx.fillStyle = "#fff"; const fs = fitFont(ctx, fare.toUpperCase(), safeW, width * 0.09, width * 0.05, "Arial,sans-serif"); ctx.font = `900 ${fs}px Arial,sans-serif`; ctx.fillText(fare.toUpperCase(), margin, height * 0.29); }
        else { ctx.fillStyle = "#fff"; ctx.font = `850 ${Math.round(width * 0.06)}px Arial,sans-serif`; ctx.fillText("ASK ROHI FOR THE LIVE FARE", margin, height * 0.29); }
        if (opts.seats) { ctx.fillStyle = "#fff"; ctx.font = `750 ${Math.round(width * 0.038)}px Arial,sans-serif`; ctx.fillText("Seats: " + opts.seats, margin, height * 0.37); }
      } else {
        ctx.fillStyle = "#fff"; ctx.font = `900 ${Math.round(width * 0.067)}px Arial,sans-serif`; ctx.fillText("BOOK WITH ROHI", margin, height * 0.18);
        ctx.fillStyle = "#e9c46a"; ctx.font = `850 ${Math.round(width * 0.043)}px Arial,sans-serif`; ctx.fillText(opts.cta || "WhatsApp us for booking & assistance", margin, height * 0.245);
      }
      ctx.restore();

      // Persistent brand-safe footer. Never overlaps the content cards above.
      const footerH = height * 0.125;
      ctx.fillStyle = "#e9c46a"; ctx.fillRect(0, height - footerH, width, footerH);
      ctx.textAlign = "center"; ctx.fillStyle = "#071d42";
      ctx.font = `900 ${Math.round(width * 0.042)}px Arial,sans-serif`; ctx.fillText("ROHI INTERNATIONAL TRAVELS", width / 2, height - footerH * 0.60);
      ctx.font = `800 ${Math.round(width * 0.034)}px Arial,sans-serif`; ctx.fillText("0305 6622988  •  "+airline, width / 2, height - footerH * 0.25);

      // Progress cue gives the reel a current short-form feel without hiding text.
      ctx.fillStyle = "rgba(255,255,255,.45)"; ctx.fillRect(margin, height * 0.055, safeW, 4);
      ctx.fillStyle = "#e9c46a"; ctx.fillRect(margin, height * 0.055, safeW * progress, 4);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop(); stream.getVideoTracks().forEach((t) => t.stop()); music?.stop();
  return done;
}
