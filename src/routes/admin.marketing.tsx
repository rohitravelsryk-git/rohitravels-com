import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  Plane, LogOut, Sparkles, Copy as CopyIcon, Check, Download, MessageCircle, Image as ImageIcon,
  Film, Megaphone, Users, Bookmark, Trash2, Wand2, RefreshCw, Phone, Upload, MapPin,
} from "lucide-react";
import { adminLogout, listFares, type Fare } from "@/lib/fares.functions";
import { generateMarketingCopy, generateMarketingImage, readImageText, type MarketingCopy } from "@/lib/marketing.functions";
import { buildReel } from "@/lib/marketing-reel";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { useServerFn } from "@tanstack/react-start";
import rohiLogo from "@/assets/rohi-logo.png.asset.json";
import { AirlineLogo, urduName, destinationImage, DESTINATION_FALLBACK } from "@/routes/index";
import { airlineBrand } from "@/lib/airline-brand";

const faresQuery = queryOptions({ queryKey: ["fares"], queryFn: () => listFares() });

export const Route = createFileRoute("/admin/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing Studio — Rohi Admin" },
      { name: "description", content: "AI text, image and video marketing studio with automatic WhatsApp posters for every live group fare." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(faresQuery),
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center">
      <p className="mb-4 text-destructive">{error.message}</p>
      <button onClick={reset} className="rounded bg-navy px-4 py-2 text-white">Retry</button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
  component: MarketingPage,
});

const AGENCY_NAME = "ROHI INTERNATIONAL TRAVELS";
const AGENCY_PHONE = "0305 6622988";
const AGENCY_ADDRESS = "Sardar Market, Shahi Road, Rahim Yar Khan";
const WA_GROUP_URL = "https://chat.whatsapp.com/K295wuWsea1I5TP026UGqA";
const SAVED_KEY = "rohi-marketing-saved-v1";

type SavedItem = {
  id: string;
  createdAt: string;
  title: string;
  text: string;
  image?: string;
};

function loadSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]") as SavedItem[]; } catch { return []; }
}

function openWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function fmtDate(d: string) {
  return (d || "").replace(/^(\d{1,2})([A-Za-z]{3})$/, "$1 $2").toUpperCase();
}

function flightLinesFor(f: Fare): string[] {
  if (f.flight_details && f.flight_details.trim()) {
    return f.flight_details.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  const one = [fmtDate(f.flight_date), f.origin_code?.toUpperCase(), f.destination_code?.toUpperCase(), f.depart_time, f.arrive_time]
    .filter(Boolean).join(" ");
  return one ? [one] : [];
}

function countryBadge(city: string): string {
  const c = city.trim().toUpperCase();
  const pk = ["PK","KHI","LHE","ISB","PEW","MUX","LYP","SKT","UET","KARACHI","LAHORE","ISLAMABAD","PESHAWAR","MULTAN","FAISALABAD","SIALKOT","QUETTA"];
  const sa = ["SA","JED","RUH","DMM","MED","ELQ","RIYADH","JEDDAH","DAMMAM","MEDINA","MADINAH","MAKKAH","GASSIM"];
  const ae = ["AE","DXB","AUH","SHJ","DUBAI","ABU DHABI","ABUDHABI","SHARJAH"];
  if (pk.includes(c)) return "PK";
  if (sa.includes(c)) return "SA";
  if (ae.includes(c)) return "AE";
  if (["QA","DOH","DOHA"].includes(c)) return "QA";
  if (["KW","KWI","KUWAIT"].includes(c)) return "KW";
  if (["OM","MCT","MUSCAT"].includes(c)) return "OM";
  if (["BH","BAH","BAHRAIN"].includes(c)) return "BH";
  if (["TR","IST","SAW","ISTANBUL"].includes(c)) return "TR";
  return "";
}

const FLAG_BY_BADGE: Record<string, string> = {
  PK: "🇵🇰", SA: "🇸🇦", AE: "🇦🇪", QA: "🇶🇦", KW: "🇰🇼", OM: "🇴🇲", BH: "🇧🇭", TR: "🇹🇷",
};

function buildShareText(f: Fare): string {
  const badge = countryBadge(f.destination) || countryBadge(f.destination_code) || countryBadge(f.origin);
  const flag = FLAG_BY_BADGE[badge] ?? "✈️";
  const header = `${flag} ${f.origin.toUpperCase()} → ${f.destination.toUpperCase()}`;
  const legs = flightLinesFor(f).join("\n");
  const bag = (f.baggage ?? "").trim();
  const fare = (f.price_text ?? "").trim();

  const blocks: string[] = [header];
  if (f.airline) blocks.push(f.airline);
  if (legs) blocks.push(legs);
  if (bag) blocks.push(`Baggage: ${bag}`);
  if (fare) blocks.push(`Fare: ${fare}`);
  blocks.push("Book Now: https://wa.me/923056622988");
  blocks.push(`${AGENCY_NAME} RYK\nAbdul Razzaq — ${AGENCY_PHONE}\n${AGENCY_ADDRESS}`);
  return blocks.join("\n\n");
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch {}
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-navy/15 bg-white px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-navy hover:bg-secondary"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

function MarketingPage() {
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const { data: fares } = useSuspenseQuery(faresQuery);
  const [tab, setTab] = useState<"studio" | "auto" | "saved">("studio");

  async function onLogout() {
    try { await logout(); } catch {}
    router.navigate({ to: "/admin" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Marketing studio</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="mb-6 rounded-2xl border border-navy/10 bg-gradient-to-r from-navy to-navy/85 p-5 text-white">
          <h1 className="font-serif text-2xl font-black">
            <Sparkles className="mr-2 inline h-6 w-6 text-gold" /> Marketing Studio
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-white/70">
            Give one prompt and get a ready WhatsApp Status caption, a broadcast message, a community post, an AI poster
            and an auto-built video reel. Every live group fare also gets an automatic poster + caption below — nothing to compose by hand.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {([
            ["studio", "AI Studio", Wand2],
            ["auto", `Auto fare marketing (${fares.length})`, Plane],
            ["saved", "Saved campaigns", Bookmark],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
                tab === id ? "bg-navy text-white" : "border border-navy/15 bg-white text-navy hover:bg-secondary"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "studio" && <Studio fares={fares} />}
        {tab === "auto" && <AutoFareTab fares={fares} />}

        {tab === "saved" && <SavedList />}
      </div>
    </div>
  );
}

/* ---------------------------- AI STUDIO ---------------------------- */

function Studio({ fares }: { fares: Fare[] }) {
  const genCopy = useServerFn(generateMarketingCopy);
  const genImage = useServerFn(generateMarketingImage);
  const readText = useServerFn(readImageText);

  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<"english" | "urdu" | "roman-urdu" | "mixed">("mixed");
  const [tone, setTone] = useState<"viral" | "premium" | "urgent" | "friendly">("viral");
  const [copy, setCopy] = useState<MarketingCopy | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState<"mp4" | "webm">("mp4");
  const [busy, setBusy] = useState<null | "copy" | "image" | "video" | "auto" | "read">(null);
  const [error, setError] = useState<string | null>(null);


  function faresBrief() {
    return fares.slice(0, 6).map((f) =>
      `${f.origin}→${f.destination} ${f.airline} ${fmtDate(f.flight_date)} ${f.price_text} ${f.baggage ?? ""}`.trim(),
    ).join("\n");
  }

  async function run(brief: string, alsoImage: boolean) {
    setError(null);
    setBusy(alsoImage ? "auto" : "copy");
    try {
      const result = await genCopy({ data: { prompt: brief, language, tone } });
      setCopy(result);
      if (alsoImage) {
        const img = await genImage({ data: { prompt: result.imagePrompt, format: "status" } });
        setImages((prev) => [img.dataUrl, ...prev].slice(0, 4));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function makeImage() {
    setError(null);
    setBusy("image");
    try {
      const base = copy?.imagePrompt || prompt;
      if (!base.trim()) { setError("Write a prompt first"); return; }
      const img = await genImage({ data: { prompt: base, format: "status" } });
      setImages((prev) => [img.dataUrl, ...prev].slice(0, 4));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function makeVideo() {
    setError(null);
    setBusy("video");
    try {
      let frames = images;
      if (frames.length === 0) {
        const img = await genImage({ data: { prompt: copy?.imagePrompt || prompt, format: "status" } });
        frames = [img.dataUrl];
        setImages(frames);
      }
      const headline = (copy?.status || prompt).split(/\n/)[0]?.replace(/[*_]/g, "") ?? "Group Fares";
      const reel = await buildReel({ images: frames, headline, subline: "Book now — limited seats", seconds: 10, music: true });
      setVideoExt(reel.ext);
      setVideo(URL.createObjectURL(reel.blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video build failed");
    } finally {
      setBusy(null);
    }
  }

  async function readFromImage(file: File) {
    setError(null);
    setBusy("read");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const { text } = await readText({ data: { dataUrl } });
      setPrompt((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image");
    } finally {
      setBusy(null);
    }
  }

  async function shareWithImage(src: string) {
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "rohi-poster.png", { type: blob.type || "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], text: allText });
        return;
      }
      const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (CI && navigator.clipboard && "write" in navigator.clipboard) {
        await navigator.clipboard.write([new CI({ [blob.type || "image/png"]: blob, "text/plain": new Blob([allText], { type: "text/plain" }) })]);
      } else {
        await navigator.clipboard.writeText(allText);
      }
    } catch {
      try { await navigator.clipboard.writeText(allText); } catch {}
    }
    openWhatsApp(allText);
  }

  function save() {
    if (!copy) return;
    const item: SavedItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: (prompt || copy.status).slice(0, 60),
      text: `${copy.status}\n\n---\n${copy.broadcast}\n\n---\n${copy.community}\n\n${copy.hashtags}`,
      image: images[0],
    };
    try {
      const next = [item, ...loadSaved()].slice(0, 12);
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      alert("Saved to Saved campaigns.");
    } catch {
      try {
        const next = [{ ...item, image: undefined }, ...loadSaved()].slice(0, 12);
        window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
        alert("Saved (text only — image was too large for local storage, use Download).");
      } catch { alert("Could not save locally."); }
    }
  }

  const allText = copy ? `${copy.status}\n\n${copy.hashtags}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy">
            <Wand2 className="h-3.5 w-3.5 text-gold" /> Your prompt
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="e.g. Umrah group 14 SEP Karachi to Jeddah, Saudia, 30kg baggage, PKR 185,000 — make it exciting and urgent"
            className="w-full rounded-lg border border-navy/15 bg-background p-3 text-sm outline-none focus:border-gold"
          />
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Language
              <select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}
                className="mt-1 block rounded-md border border-navy/15 bg-white px-2 py-1.5 text-xs font-semibold text-navy">
                <option value="mixed">Urdu + English mix</option>
                <option value="english">English</option>
                <option value="urdu">Urdu</option>
                <option value="roman-urdu">Roman Urdu</option>
              </select>
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Tone
              <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}
                className="mt-1 block rounded-md border border-navy/15 bg-white px-2 py-1.5 text-xs font-semibold text-navy">
                <option value="viral">Viral</option>
                <option value="premium">Premium</option>
                <option value="urgent">Urgent / limited seats</option>
                <option value="friendly">Friendly</option>
              </select>
            </label>
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={() => run(prompt, false)} disabled={busy !== null || prompt.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-md bg-navy px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50">
                <Sparkles className="h-3.5 w-3.5" /> {busy === "copy" ? "Writing…" : "Generate text"}
              </button>
              <button onClick={() => run(`Create a campaign from today's live group fares:\n${faresBrief()}`, true)}
                disabled={busy !== null || fares.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-navy/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-navy disabled:opacity-50">
                <RefreshCw className="h-3.5 w-3.5" /> Auto from fares
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-navy/20 bg-secondary/40 px-3 py-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
              <Upload className="h-3.5 w-3.5" /> {busy === "read" ? "Reading…" : "Upload image → read text"}
              <input type="file" accept="image/*" className="hidden" disabled={busy !== null} onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) readFromImage(file);
              }} />
            </label>
            <span className="text-[11px] text-muted-foreground">
              Upload any fare poster or screenshot — its text is pulled straight into the prompt above.
            </span>
          </div>
          {error && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
        </section>

        {copy && (
          <div className="grid gap-4 md:grid-cols-3">
            <TextCard icon={MessageCircle} title="WhatsApp Status" text={copy.status} />
            <TextCard icon={Megaphone} title="Broadcast message" text={copy.broadcast} />
            <TextCard icon={Users} title="Community post" text={copy.community} />
          </div>
        )}

        {copy?.hashtags && (
          <section className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Hashtags</p>
              <CopyBtn text={copy.hashtags} />
            </div>
            <p className="text-sm text-navy">{copy.hashtags}</p>
          </section>
        )}

        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy">
              <ImageIcon className="h-3.5 w-3.5 text-gold" /> Poster & reel
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => run(prompt, true)} disabled={busy !== null || prompt.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gold-foreground disabled:opacity-50">
                <Wand2 className="h-3.5 w-3.5" /> {busy === "auto" ? "Creating…" : "Text + poster"}
              </button>
              <button onClick={makeImage} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-navy/20 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-navy disabled:opacity-50">
                <ImageIcon className="h-3.5 w-3.5" /> {busy === "image" ? "Painting…" : "Generate image"}
              </button>
              <button onClick={makeVideo} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-md border border-navy/20 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-navy disabled:opacity-50">
                <Film className="h-3.5 w-3.5" /> {busy === "video" ? "Rendering…" : "Build video reel"}
              </button>
              <button onClick={save} disabled={!copy}
                className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-50">
                <Bookmark className="h-3.5 w-3.5" /> Save campaign
              </button>
            </div>
          </div>

          {images.length === 0 && !video && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No media yet — generate an image, then build a video reel from it.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {images.map((src, i) => (
              <figure key={i} className="overflow-hidden rounded-xl border border-navy/10">
                <img src={src} alt={`AI marketing poster ${i + 1}`} className="w-full object-cover" />
                <div className="flex gap-2 border-t border-navy/10 bg-secondary/40 p-2">
                  <button onClick={() => download(src, `rohi-poster-${i + 1}.png`)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-[11px] font-bold uppercase text-navy">
                    <Download className="h-3.5 w-3.5" /> Save
                  </button>
                  <CopyBtn text={allText} label="Caption" />
                  <button onClick={() => shareWithImage(src)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-whatsapp px-2.5 py-1.5 text-[11px] font-bold uppercase text-whatsapp-foreground">
                    <MessageCircle className="h-3.5 w-3.5" /> Share
                  </button>
                </div>
              </figure>
            ))}
            {video && (
              <figure className="overflow-hidden rounded-xl border border-navy/10">
                <video src={video} controls loop className="w-full" />
                <div className="flex gap-2 border-t border-navy/10 bg-secondary/40 p-2">
                  <button onClick={() => download(video, `rohi-reel.${videoExt}`)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-[11px] font-bold uppercase text-navy">
                    <Download className="h-3.5 w-3.5" /> Save video
                  </button>
                  <button onClick={() => openWhatsApp(allText)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-whatsapp px-2.5 py-1.5 text-[11px] font-bold uppercase text-whatsapp-foreground">
                    <MessageCircle className="h-3.5 w-3.5" /> Caption
                  </button>
                </div>
              </figure>
            )}
          </div>
        </section>
      </div>

      {/* Send panel */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-navy">Send it out</p>
          <div className="space-y-2">
            <button onClick={() => copy && openWhatsApp(copy.broadcast)} disabled={!copy}
              className="w-full rounded-lg bg-whatsapp px-4 py-3 text-xs font-bold uppercase tracking-wide text-whatsapp-foreground disabled:opacity-50">
              <Megaphone className="mr-1.5 inline h-3.5 w-3.5" /> WhatsApp broadcast
            </button>
            <button
              onClick={async () => {
                if (!copy) return;
                try { await navigator.clipboard.writeText(copy.community); } catch {}
                window.open(WA_GROUP_URL, "_blank", "noopener,noreferrer");
              }}
              disabled={!copy}
              className="w-full rounded-lg bg-navy px-4 py-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50">
              <Users className="mr-1.5 inline h-3.5 w-3.5" /> Community post (copies text)
            </button>
            <button onClick={() => copy && openWhatsApp(copy.status)} disabled={!copy}
              className="w-full rounded-lg border border-navy/20 px-4 py-3 text-xs font-bold uppercase tracking-wide text-navy disabled:opacity-50">
              <MessageCircle className="mr-1.5 inline h-3.5 w-3.5" /> Status caption
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Tip: press <strong>Save</strong> on the poster/reel, then attach it in WhatsApp — the caption is already
            prefilled or copied to your clipboard.
          </p>
        </section>
      </aside>
    </div>
  );
}

function TextCard({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <section className="flex flex-col rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-navy">
          <Icon className="h-3.5 w-3.5 text-gold" /> {title}
        </p>
        <CopyBtn text={text} />
      </div>
      <pre className="flex-1 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-navy">{text}</pre>
      <button onClick={() => openWhatsApp(text)}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-whatsapp px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-whatsapp-foreground">
        <MessageCircle className="h-3.5 w-3.5" /> Send on WhatsApp
      </button>
    </section>
  );
}

function SavedList() {
  const [items, setItems] = useState<SavedItem[]>([]);
  useEffect(() => { setItems(loadSaved()); }, []);
  function remove(id: string) {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    try { window.localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
  }
  if (items.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No saved campaigns yet.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <article key={it.id} className="flex flex-col rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-navy">{it.title}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(it.createdAt).toLocaleString()}
              </p>
            </div>
            <button onClick={() => remove(it.id)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {it.image && <img src={it.image} alt={it.title} className="mb-2 w-full rounded-lg object-cover" />}
          <pre className="max-h-48 flex-1 overflow-auto whitespace-pre-wrap break-words font-sans text-[12px] text-navy">{it.text}</pre>
          <div className="mt-3 flex gap-2">
            <CopyBtn text={it.text} label="Copy all" />
            <button onClick={() => openWhatsApp(it.text)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-whatsapp px-2 py-1.5 text-[11px] font-bold uppercase text-whatsapp-foreground">
              <MessageCircle className="h-3.5 w-3.5" /> Share
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ------------------- AUTO POSTERS FROM GROUP FARES ------------------- */

function AutoFareTab({ fares }: { fares: Fare[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [shown, setShown] = useState<string[] | null>(null);

  const allSelected = fares.length > 0 && selected.length === fares.length;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function toggleAll() {
    setSelected(allSelected ? [] : fares.map((f) => f.id));
  }

  if (fares.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No group fares uploaded yet.</p>;
  }

  const cards = shown ? fares.filter((f) => shown.includes(f.id)) : [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-navy/10 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[13px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Select fares</p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest text-emerald-800">
              {selected.length} selected
            </span>
            <button
              onClick={toggleAll}
              className="rounded-full border border-navy/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-navy hover:bg-secondary"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {fares.map((f) => {
            const on = selected.includes(f.id);
            const detail = flightLinesFor(f)[0] ?? "";
            return (
              <li key={f.id}>
                <label className="flex cursor-pointer items-center gap-4 py-4">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 transition ${
                      on ? "border-emerald-800 bg-emerald-800 text-white" : "border-navy/25 bg-white"
                    }`}
                  >
                    {on && <Check className="h-4 w-4" strokeWidth={3.5} />}
                    <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="hidden" />
                  </span>
                  <span className="flex w-20 shrink-0 justify-center"><AirlineLogo name={f.airline} height={26} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-xl font-black leading-tight text-navy">
                      {f.origin_code?.toUpperCase()} <span className="text-gold">→</span> {f.destination_code?.toUpperCase()}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-muted-foreground">{fmtDate(f.flight_date)}</span>
                      <span className="truncate font-mono text-[11px] tracking-tight text-navy/60">{detail}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[15px] font-semibold text-muted-foreground">{f.baggage ?? ""}</span>
                    <span className="block font-serif text-[13px] font-black text-navy">{f.price_text}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-center">
          <button
            onClick={() => setShown(selected)}
            disabled={selected.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-8 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-white disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            Auto-generate cards{selected.length > 0 ? ` (${selected.length})` : ""}
          </button>
        </div>
      </section>

      {shown !== null && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((f) => <PosterCard key={f.id} f={f} />)}
        </div>
      )}
    </div>
  );
}

function PosterCard({ f }: { f: Fare }) {
  const [busy, setBusy] = useState<null | "wa" | "download">(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const shareText = buildShareText(f);
  const img = destinationImage(f.destination);
  const brand = airlineBrand(f.airline);
  const fileName = `rohi-${slugify(f.origin)}-${slugify(f.destination)}-${slugify(f.flight_date || "fare")}.png`;

  const inlineImages = async (root: HTMLElement): Promise<() => void> => {
    const imgs = Array.from(root.querySelectorAll("img"));
    const restores: Array<() => void> = [];
    await Promise.all(imgs.map(async (el) => {
      const src = el.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        const res = await fetch(src, { mode: "cors", cache: "no-cache" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        const original = el.src;
        el.setAttribute("src", dataUrl);
        restores.push(() => el.setAttribute("src", original));
      } catch { /* keep original */ }
    }));
    return () => restores.forEach((r) => r());
  };

  const capture = async (): Promise<Blob | null> => {
    if (!posterRef.current) return null;
    const restore = await inlineImages(posterRef.current);
    try {
      // 1080 x 1350 standard social poster
      return await toBlob(posterRef.current, {
        cacheBust: true,
        canvasWidth: 1080,
        canvasHeight: 1350,
        pixelRatio: 2,
        backgroundColor: brand.bg,
      });
    } catch { return null; } finally { restore(); }
  };

  const doDownload = async () => {
    setBusy("download");
    try {
      const blob = await capture();
      if (!blob) { alert("Could not generate the poster image."); return; }
      const url = URL.createObjectURL(blob);
      download(url, fileName);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally { setBusy(null); }
  };

  const sendWhatsApp = async () => {
    setBusy("wa");
    try {
      const blob = await capture();
      if (blob) {
        const file = new File([blob], fileName, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          try {
            await nav.share({ files: [file], text: shareText });
            return;
          } catch { /* fall through to clipboard */ }
        }
        try {
          const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
          if (CI && navigator.clipboard && "write" in navigator.clipboard) {
            await navigator.clipboard.write([
              new CI({ "image/png": blob, "text/plain": new Blob([shareText], { type: "text/plain" }) }),
            ]);
          }
        } catch { /* clipboard blocked */ }
      }
      openWhatsApp(shareText);
    } finally { setBusy(null); }
  };

  const legs = flightLinesFor(f).map((line) => {
    const m = line.match(/^(\d{1,2}\s?[A-Za-z]{3})\s+(.*)$/);
    return { date: m ? m[1].toUpperCase() : "", rest: m ? m[2] : line };
  });

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1">
      <div
        ref={posterRef}
        className="relative flex aspect-[4/5] flex-col overflow-hidden"
        style={{ backgroundColor: brand.bg }}
      >
        <img
          src={img}
          alt={`Flight destination: ${f.destination}`}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            const t = e.currentTarget;
            if (t.src !== DESTINATION_FALLBACK) t.src = DESTINATION_FALLBACK;
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${brand.bg}f2 0%, ${brand.bg2}d9 42%, ${brand.bg}b8 72%, ${brand.bg}fa 100%)`,
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ backgroundColor: brand.accent }}
        />

        <div className="relative flex flex-1 flex-col px-5 pb-4 pt-5">
          {/* group type + airline logo (single instance) */}
          <div className="flex items-center justify-between gap-3">
            <span
              className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]"
              style={{ backgroundColor: brand.accent, color: brand.onAccent }}
            >
              {f.group_type || "Group fare"}
            </span>
            <span className="flex h-10 items-center rounded-lg bg-white px-2.5">
              <AirlineLogo name={f.airline} height={26} />
            </span>
          </div>

          {/* headline */}
          <h3 className="mt-4 font-serif text-[30px] font-black uppercase leading-[0.95] tracking-tight text-white">
            {f.origin.toUpperCase()}
            <br />
            <span style={{ color: brand.accent }}>→ {f.destination.toUpperCase()}</span>
          </h3>

          {/* urdu title — big */}
          <p dir="rtl" lang="ur" className="mt-2 font-urdu text-[34px] leading-[1.5] text-white">
            {urduName(f.origin)} {urduName(f.destination)}
          </p>

          <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.22em] text-white/85">{f.airline}</p>

          {/* flight legs */}
          <div className="mt-3 space-y-1.5">
            {legs.map((leg, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 rounded-lg bg-white/95 px-3 py-2 font-mono text-[12px] font-black"
                style={{ color: brand.ink }}
              >
                {leg.date && <span>{leg.date}</span>}
                <span className="truncate opacity-80">{leg.rest}</span>
              </div>
            ))}
          </div>

          {/* baggage + fare */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {f.baggage && (
              <span className="rounded-lg bg-white/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white ring-1 ring-white/25">
                Baggage: {f.baggage}
              </span>
            )}
            <span
              className="rounded-lg px-3 py-1.5 font-serif text-[15px] font-black uppercase leading-none"
              style={{ backgroundColor: brand.accent, color: brand.onAccent }}
            >
              {f.price_text}
            </span>
          </div>

          {/* brand footer */}
          <div className="mt-auto pt-5">
            <div className="h-px w-full bg-white/25" />
            <div className="mt-3 flex items-center gap-3">
              <img src={rohiLogo.url} alt="Rohi International Travels" className="h-12 w-12 shrink-0 object-contain" crossOrigin="anonymous" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-serif text-[15px] font-black tracking-wide" style={{ color: brand.accent }}>
                  {AGENCY_NAME}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-white/80">
                  <MapPin className="h-3 w-3" /> {AGENCY_ADDRESS}
                </p>
              </div>
              <span
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 font-mono text-[12px] font-black leading-none"
                style={{ backgroundColor: brand.accent, color: brand.onAccent }}
              >
                <Phone className="h-3.5 w-3.5" /> {AGENCY_PHONE}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_2fr] border-t border-border">
        <div className="flex items-center justify-center py-2"><CopyBtn text={shareText} /></div>
        <button onClick={doDownload} disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 border-l border-border py-3 text-[11px] font-bold uppercase tracking-wide text-navy hover:bg-secondary disabled:opacity-60">
          <Download className="h-3.5 w-3.5" /> {busy === "download" ? "…" : "Save"}
        </button>
        <button onClick={sendWhatsApp} disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-whatsapp py-3 text-[11px] font-bold uppercase tracking-wide text-whatsapp-foreground hover:brightness-95 disabled:opacity-60">
          <MessageCircle className="h-3.5 w-3.5" /> {busy === "wa" ? "Preparing…" : "Share"}
        </button>
      </div>
    </article>
  );
}
