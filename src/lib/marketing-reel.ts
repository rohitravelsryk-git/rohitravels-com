/** Client-side reel builder: turns AI images + caption into a shareable video with background music. */
export type ReelOptions = {
  images: string[];
  headline: string;
  subline?: string;
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

/** Warm ambient travel pad + soft pulse, synthesised in the browser (no external audio file needed). */
function buildMusic(seconds: number): { track: MediaStreamTrack; stop: () => void } | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const dest = ctx.createMediaStreamDestination();

    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 1.2);
    master.gain.setValueAtTime(0.28, ctx.currentTime + Math.max(1.5, seconds - 1.5));
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + seconds);
    master.connect(dest);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.connect(master);

    // Chord pad (A minor 9 — cinematic, travel-documentary feel)
    [220, 261.63, 329.63, 440, 493.88].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.09 / (i * 0.4 + 1);
      // slow shimmer
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + i * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain).connect(g.gain);
      osc.connect(g).connect(filter);
      osc.start();
      lfo.start();
      osc.stop(ctx.currentTime + seconds + 0.2);
      lfo.stop(ctx.currentTime + seconds + 0.2);
    });

    // gentle arpeggio pulses
    const notes = [880, 659.25, 587.33, 493.88];
    for (let beat = 0; beat * 0.75 < seconds; beat++) {
      const t = ctx.currentTime + 0.6 + beat * 0.75;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = notes[beat % notes.length]!;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(g).connect(filter);
      osc.start(t);
      osc.stop(t + 0.7);
    }

    return { track: dest.stream.getAudioTracks()[0]!, stop: () => void ctx.close().catch(() => {}) };
  } catch {
    return null;
  }
}

function pickMime(withAudio: boolean): { mime: string; ext: "mp4" | "webm" } | null {
  const candidates: Array<{ mime: string; ext: "mp4" | "webm" }> = withAudio
    ? [
        { mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4" },
        { mime: "video/mp4", ext: "mp4" },
        { mime: "video/webm;codecs=vp9,opus", ext: "webm" },
        { mime: "video/webm;codecs=vp8,opus", ext: "webm" },
        { mime: "video/webm", ext: "webm" },
      ]
    : [
        { mime: 'video/mp4;codecs="avc1.42E01E"', ext: "mp4" },
        { mime: "video/webm;codecs=vp9", ext: "webm" },
        { mime: "video/webm", ext: "webm" },
      ];
  return candidates.find((c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) ?? null;
}

export async function buildReel(opts: ReelOptions): Promise<ReelResult> {
  const width = opts.width ?? 1080;
  const height = opts.height ?? 1920;
  const seconds = opts.seconds ?? 10;
  const frames = await Promise.all(opts.images.filter(Boolean).map(loadImage));
  if (frames.length === 0) throw new Error("Generate at least one image first");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser");

  const stream = canvas.captureStream(30);
  const music = opts.music === false ? null : buildMusic(seconds);
  if (music) stream.addTrack(music.track);

  const picked = pickMime(!!music);
  if (!picked) throw new Error("This browser cannot record video — use Chrome or Edge");
  const recorder = new MediaRecorder(stream, {
    mimeType: picked.mime,
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const outMime = picked.ext === "mp4" ? "video/mp4" : "video/webm";
  const done = new Promise<ReelResult>((resolve) => {
    recorder.onstop = () => resolve({ blob: new Blob(chunks, { type: outMime }), ext: picked.ext, mime: outMime });
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
      ctx.fillRect(0, height - width * 0.185, width, width * 0.185);
      ctx.fillStyle = "#0a1f44";
      ctx.font = `900 ${Math.round(width * 0.05)}px Georgia, serif`;
      ctx.fillText("ROHI INTERNATIONAL TRAVELS", width / 2, height - width * 0.115);
      ctx.font = `800 ${Math.round(width * 0.038)}px Arial, sans-serif`;
      ctx.fillText("0305 6622988", width / 2, height - width * 0.062);
      ctx.font = `600 ${Math.round(width * 0.028)}px Arial, sans-serif`;
      ctx.fillText("Sardar Market, Shahi Road, Rahim Yar Khan", width / 2, height - width * 0.02);

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  stream.getVideoTracks().forEach((t) => t.stop());
  music?.stop();
  return done;
}
