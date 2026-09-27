/** Fast, safe-zone-first short-form reel builder for Rohi marketing. */
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
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image for the reel"));
    img.src = src;
  });
}

function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, zoom = 1) {
  const scale = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * scale, dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number): number {
  let size = start;
  while (size > min) {
    ctx.font = `900 ${size}px Arial,sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Louder original procedural travel bed. No external/copyrighted audio is used. */
function buildMusic(seconds: number): { track: MediaStreamTrack; stop: () => void } | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const audio = new AC();
    const dest = audio.createMediaStreamDestination();
    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 10;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.2;

    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, audio.currentTime);
    master.gain.exponentialRampToValueAtTime(0.62, audio.currentTime + 0.35);
    master.gain.setValueAtTime(0.62, audio.currentTime + Math.max(0.5, seconds - 0.45));
    master.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + seconds);
    master.connect(compressor).connect(dest);

    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 4200;
    filter.connect(master);

    const pad = [220, 261.63, 329.63, 392, 493.88];
    pad.forEach((freq, i) => {
      const osc = audio.createOscillator();
      osc.type = i % 2 ? "triangle" : "sine";
      osc.frequency.value = freq;
      const gain = audio.createGain();
      gain.gain.value = 0.12 / (1 + i * 0.32);
      osc.connect(gain).connect(filter);
      osc.start();
      osc.stop(audio.currentTime + seconds + 0.1);
    });

    const melody = [659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25, 783.99];
    for (let i = 0; i * 0.42 < seconds; i++) {
      const t = audio.currentTime + 0.35 + i * 0.42;
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.value = melody[i % melody.length]!;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      osc.connect(gain).connect(filter);
      osc.start(t);
      osc.stop(t + 0.29);
    }

    void audio.resume().catch(() => {});
    return { track: dest.stream.getAudioTracks()[0]!, stop: () => void audio.close().catch(() => {}) };
  } catch {
    return null;
  }
}

function pickMime(withAudio: boolean): { mime: string; ext: "mp4" | "webm" } | null {
  const candidates = withAudio
    ? [
        { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" as const },
        { mime: "video/mp4", ext: "mp4" as const },
        { mime: "video/webm;codecs=vp9,opus", ext: "webm" as const },
        { mime: "video/webm;codecs=vp8,opus", ext: "webm" as const },
        { mime: "video/webm", ext: "webm" as const },
      ]
    : [
        { mime: 'video/mp4;codecs="avc1.42E01E"', ext: "mp4" as const },
        { mime: "video/webm;codecs=vp9", ext: "webm" as const },
        { mime: "video/webm", ext: "webm" as const },
      ];
  return candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

export async function buildReel(opts: ReelOptions): Promise<ReelResult> {
  // 1080x1920 portrait is retained, but source artwork is contained rather than cropped.
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const seconds = Math.min(15, Math.max(10, opts.seconds ?? 12));
  const fps = 24;

  const frames = await Promise.all(opts.images.filter(Boolean).slice(0, 3).map(loadImage));
  if (!frames.length) throw new Error("Generate at least one image first");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  const stream = canvas.captureStream(fps);
  let music = opts.music === false ? null : buildMusic(seconds);
  let picked = pickMime(!!music);
  if (!picked && music) {
    music.stop();
    music = null;
    picked = pickMime(false);
  }
  if (!picked) throw new Error("This browser cannot record video. Please use a current Chrome or Edge browser.");
  if (music) stream.addTrack(music.track);

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
    mimeType: picked.mime,
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: music ? 192_000 : undefined,
  });
  } catch (firstError) {
    if (!music) throw firstError;
    music.stop();
    music = null;
    stream.getAudioTracks().forEach((track) => track.stop());
    picked = pickMime(false);
    if (!picked) throw new Error("This browser cannot record video. Please use a current Chrome or Edge browser.");
    recorder = new MediaRecorder(stream, {
      mimeType: picked.mime,
      videoBitsPerSecond: 8_000_000,
    });
  }

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const outMime = picked.ext === "mp4" ? "video/mp4" : "video/webm";
  const done = new Promise<ReelResult>((resolve, reject) => {
    recorder.onerror = () => reject(new Error("Video recording failed"));
    recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: outMime }), ext: picked.ext, mime: outMime });
  });

  const route = (opts.route || opts.headline || "GROUP FARE").toUpperCase();
  const airline = (opts.airline || opts.subline || "ROHI INTERNATIONAL TRAVELS").toUpperCase();
  const details = (opts.flightDetails || []).filter(Boolean).slice(0, 3).map((x) => x.toUpperCase());
  const fare = opts.fare?.trim();
  const margin = width * 0.07;
  const safeW = width - margin * 2;

  // Layout deliberately separates hero image, data, and footer. Nothing is drawn underneath another block.
  const imageTop = height * 0.08;
  const imageH = height * 0.37;
  const dataTop = height * 0.49;
  const dataBottom = height * 0.86;
  const footerH = height * 0.105;

  const scenes = [
    { start: 0, end: 0.25, kind: "hook" },
    { start: 0.25, end: 0.52, kind: "details" },
    { start: 0.52, end: 0.76, kind: "value" },
    { start: 0.76, end: 1, kind: "cta" },
  ] as const;

  recorder.start(250);
  const started = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - started;
      const progress = Math.min(0.9999, elapsed / (seconds * 1000));
      if (elapsed >= seconds * 1000) {
        resolve();
        return;
      }

      const scene = scenes.find((s) => progress >= s.start && progress < s.end) ?? scenes[3];
      const local = (progress - scene.start) / (scene.end - scene.start);
      const sceneIndex = scenes.indexOf(scene);
      const frame = frames[Math.floor(progress * frames.length) % frames.length]!;

      ctx.fillStyle = "#061a3a";
      ctx.fillRect(0, 0, width, height);

      // Blurred/zoomed backdrop prevents black bars while the actual source stays fully visible.
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.filter = "blur(28px)";
      drawCover(ctx, frame, width, height, 1.12);
      ctx.restore();
      ctx.filter = "none";

      // Full source artwork, contained inside a premium portrait frame: no crop, no hidden details.
      ctx.save();
      roundRect(ctx, margin, imageTop, safeW, imageH, 34);
      ctx.clip();
      drawContain(ctx, frame, margin, imageTop, safeW, imageH);
      const shade = ctx.createLinearGradient(0, imageTop, 0, imageTop + imageH);
      shade.addColorStop(0, "rgba(0,0,0,.08)");
      shade.addColorStop(0.72, "rgba(0,0,0,.04)");
      shade.addColorStop(1, "rgba(0,0,0,.62)");
      ctx.fillStyle = shade;
      ctx.fillRect(margin, imageTop, safeW, imageH);
      ctx.restore();

      const enter = Math.min(1, local / 0.14);
      const exit = local > 0.88 ? Math.max(0, (1 - local) / 0.12) : 1;
      ctx.save();
      ctx.globalAlpha = Math.min(enter, exit);
      ctx.translate((1 - enter) * width * 0.025, 0);

      // Hook stays short and large; route never gets truncated because it is fitted to two lines.
      if (scene.kind === "hook") {
        ctx.fillStyle = "#e9c46a";
        roundRect(ctx, margin, imageTop + imageH - 92, width * 0.38, 54, 18);
        ctx.fill();
        ctx.fillStyle = "#061a3a";
        ctx.font = `900 ${Math.round(width * 0.03)}px Arial,sans-serif`;
        ctx.fillText("GROUP FARE", margin + 20, imageTop + imageH - 56);

        const routeSize = fitFont(ctx, route, safeW, width * 0.075, width * 0.045);
        ctx.font = `900 ${routeSize}px Arial,sans-serif`;
        ctx.fillStyle = "#fff";
        const routeLines = wrap(ctx, route, safeW, 2);
        let y = height * 0.145;
        for (const line of routeLines) {
          ctx.fillText(line, margin, y);
          y += routeSize * 1.08;
        }
      }

      // Data scene: every supplied flight line, baggage and fare gets its own readable row.
      if (scene.kind === "details") {
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${Math.round(width * 0.046)}px Arial,sans-serif`;
        ctx.fillText("FLIGHT DETAILS", margin, dataTop);

        ctx.fillStyle = "rgba(255,255,255,.97)";
        roundRect(ctx, margin, dataTop + 24, safeW, Math.min(dataBottom - dataTop - 20, height * 0.22), 28);
        ctx.fill();

        ctx.fillStyle = "#061a3a";
        const detailSize = Math.round(width * 0.032);
        ctx.font = `800 ${detailSize}px Arial,sans-serif`;
        let y = dataTop + 76;
        for (const line of details) {
          const lines = wrap(ctx, line, safeW - 56, 2);
          for (const part of lines) {
            ctx.fillText(part, margin + 28, y);
            y += detailSize * 1.25;
          }
          y += 8;
        }

        const chips: string[] = [];
        if (opts.baggage) chips.push("BAGGAGE: " + opts.baggage.toUpperCase());
        if (fare) chips.push("FARE: " + fare.toUpperCase());
        if (opts.seats) chips.push("SEATS: " + opts.seats);

        let chipY = Math.min(dataBottom - 62, y + 10);
        for (const chip of chips.slice(0, 2)) {
          ctx.fillStyle = "#e9c46a";
          roundRect(ctx, margin + 28, chipY, safeW - 56, 48, 16);
          ctx.fill();
          ctx.fillStyle = "#061a3a";
          ctx.font = `900 ${Math.round(width * 0.027)}px Arial,sans-serif`;
          ctx.fillText(chip, margin + 44, chipY + 32);
          chipY += 58;
        }
      }

      if (scene.kind === "value") {
        ctx.fillStyle = "#fff";
        ctx.font = `900 ${Math.round(width * 0.05)}px Arial,sans-serif`;
        ctx.fillText("WHY CHECK THIS OFFER?", margin, dataTop);

        const cards = [
          "ROUTE + FLIGHT DETAILS CLEAR",
          opts.baggage ? "BAGGAGE SHOWN UP FRONT" : "ASK FOR LIVE BAGGAGE INFO",
          fare ? "FARE SHOWN CLEARLY" : "CHECK LIVE FARE ON WHATSAPP",
        ];
        let cy = dataTop + 36;
        for (const card of cards) {
          ctx.fillStyle = "rgba(255,255,255,.96)";
          roundRect(ctx, margin, cy, safeW, 66, 18);
          ctx.fill();
          ctx.fillStyle = "#061a3a";
          ctx.font = `850 ${Math.round(width * 0.029)}px Arial,sans-serif`;
          ctx.fillText("✓  " + card, margin + 24, cy + 42);
          cy += 78;
        }
      }

      if (scene.kind === "cta") {
        ctx.fillStyle = "#e9c46a";
        ctx.font = `900 ${Math.round(width * 0.047)}px Arial,sans-serif`;
        ctx.fillText("READY TO CHECK IT?", margin, dataTop);

        ctx.fillStyle = "#fff";
        const cta = opts.cta || "WhatsApp ROHI for booking & assistance";
        const ctaSize = fitFont(ctx, cta.toUpperCase(), safeW, width * 0.055, width * 0.035);
        ctx.font = `900 ${ctaSize}px Arial,sans-serif`;
        const ctaLines = wrap(ctx, cta.toUpperCase(), safeW, 3);
        let cy = dataTop + 58;
        for (const line of ctaLines) {
          ctx.fillText(line, margin, cy);
          cy += ctaSize * 1.16;
        }
        ctx.fillStyle = "#e9c46a";
        ctx.font = `850 ${Math.round(width * 0.035)}px Arial,sans-serif`;
        ctx.fillText("ROHI INTERNATIONAL TRAVELS", margin, dataBottom - 18);
      }

      ctx.restore();

      // Persistent footer is isolated from all content above.
      ctx.fillStyle = "#e9c46a";
      ctx.fillRect(0, height - footerH, width, footerH);
      ctx.textAlign = "center";
      ctx.fillStyle = "#061a3a";
      ctx.font = `900 ${Math.round(width * 0.038)}px Arial,sans-serif`;
      ctx.fillText("ROHI INTERNATIONAL TRAVELS", width / 2, height - footerH * 0.58);
      ctx.font = `800 ${Math.round(width * 0.03)}px Arial,sans-serif`;
      ctx.fillText("0305 6622988  •  " + airline, width / 2, height - footerH * 0.22);
      ctx.textAlign = "left";

      // Minimal progress indicator sits in its own strip and never covers copy.
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.fillRect(margin, height * 0.045, safeW, 4);
      ctx.fillStyle = "#e9c46a";
      ctx.fillRect(margin, height * 0.045, safeW * progress, 4);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  stream.getVideoTracks().forEach((t) => t.stop());
  music?.stop();
  return done;
}
