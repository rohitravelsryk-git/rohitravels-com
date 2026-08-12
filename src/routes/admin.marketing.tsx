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
  const lines: string[] = [];

  lines.push(`${flag} ${(f.origin || "").toUpperCase()} → ${(f.destination || "").toUpperCase()}`);
  lines.push("");
  if (f.airline) lines.push(`${f.airline.toUpperCase()}`);
  lines.push("");

  const legs = flightLinesFor(f);
  if (legs.length) {
    legs.forEach((l) => lines.push(l.toUpperCase()));
  }

  const bag = (f.baggage ?? "").trim() || "20+05 KG";
  const fare = (f.price_text ?? "").trim();

  lines.push("");
  lines.push(`Baggage: ${bag}`);
  if (fare) {
    lines.push("");
    lines.push(`Fare: ${fare.toUpperCase()}`);
  }

  lines.push("");
  lines.push(`${AGENCY_NAME}`);
  lines.push(`*Abdul Razzaq*`);
  lines.push(`${AGENCY_PHONE}`);
  lines.push(`${AGENCY_ADDRESS}`);
  lines.push(`Portal Link: https://rohitravels.com/agent/register`);

  return lines.join("\n");
}


function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Clipboard write that also works inside sandboxed preview iframes. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        if (!ok) { window.prompt("Copy the text below (Ctrl/Cmd + C):", text); return; }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
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
          <p className="mt-1 max-w-3xl text-sm text-white/70 whitespace-pre-line">
            {`'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''\n                                        \n                                            \n                                            can the empty space on right side and left side of hero section be used to make text looks more premium and professional also rename text Elevate your Business with premium fares with text Boost your Business Sales with B2b fares. and also rename text Unlock competitive group fares, smart ticketing support and dependable travel solutions built for modern travel agents with text Unlock competitive group fares, smart ticketing support and all travel solutions built for modern travel agents.`}
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
      {/* ---------------- selector ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-navy/10 bg-card shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 bg-navy px-5 py-3.5 text-navy-foreground">
          <div>
            <p className="font-serif text-base font-black tracking-wide">Auto Fare Marketing</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/50">
              Pick fares · generate Instagram-size posters
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-gold px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-gold-foreground">
              {selected.length} selected
            </span>
            <button
              onClick={toggleAll}
              className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80 hover:bg-white/10"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
        </div>

        <div className="max-h-[440px] overflow-y-auto p-4">
          <div className="grid gap-2.5 md:grid-cols-2">
            {fares.map((f) => {
              const on = selected.includes(f.id);
              const detail = flightLinesFor(f)[0] ?? "";
              return (
                <label
                  key={f.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    on ? "border-emerald-700 bg-emerald-50/70 ring-1 ring-emerald-700/30" : "border-border bg-background hover:border-navy/25"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                      on ? "border-emerald-700 bg-emerald-700 text-white" : "border-navy/25 bg-card"
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                    <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="hidden" />
                  </span>
                  <span className="flex w-14 shrink-0 justify-center"><AirlineLogo name={f.airline} height={24} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-base font-black leading-tight text-navy">
                      {f.origin_code?.toUpperCase()} <span className="text-gold">→</span> {f.destination_code?.toUpperCase()}
                    </span>
                    <span className="block truncate font-mono text-[10px] tracking-tight text-navy/55">
                      {fmtDate(f.flight_date)} · {detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[10px] font-bold text-muted-foreground">{f.baggage ?? ""}</span>
                    <span className="block font-serif text-[11px] font-black text-navy">{f.price_text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center border-t border-navy/10 bg-secondary/40 px-5 py-4">
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

      {/* ---------------- gallery ---------------- */}
      {shown !== null && (
        <section className="rounded-2xl border border-navy/10 bg-secondary/40 p-4">
          <p className="mb-4 px-1 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Generated posters · {cards.length}
          </p>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((f) => <PosterCard key={f.id} f={f} />)}
          </div>
        </section>
      )}
    </div>
  );
}

/** Renders a true 1080x1080 poster node, visually scaled to fit the card. */
function PosterCard({ f }: { f: Fare }) {
  const [busy, setBusy] = useState<null | "wa" | "download" | "copy">(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.32);
  const shareText = buildShareText(f);
  const img = destinationImage(f.destination);
  const brand = airlineBrand(f.airline);
  const fileName = `rohi-${slugify(f.origin)}-${slugify(f.destination)}-${slugify(f.flight_date || "fare")}.png`;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => setScale(el.clientWidth / 1080);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const node = posterRef.current;
    if (!node) return null;
    const restore = await inlineImages(node);
    try {
      const opts = { cacheBust: true, pixelRatio: 1, width: 1080, height: 1080, backgroundColor: "#ffffff" };
      let blob = await toBlob(node, opts);
      if (!blob || blob.size < 4096) blob = await toBlob(node, opts);
      return blob;
    } catch { return null; } finally { restore(); }
  };

  const doDownload = async () => {
    setBusy("download");
    try {
      const blob = await capture();
      if (!blob) { alert("Could not generate the poster image. Try again in a moment."); return; }
      const url = URL.createObjectURL(blob);
      download(url, fileName);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally { setBusy(null); }
  };

  const copyPoster = async () => {
    setBusy("copy");
    try {
      const blob = await capture();
      let ok = false;
      if (blob) {
        try {
          const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
          if (CI && navigator.clipboard && "write" in navigator.clipboard) {
            await navigator.clipboard.write([new CI({ "image/png": blob })]);
            ok = true;
          }
        } catch { /* clipboard blocked */ }
      }
      if (!ok) await copyText(shareText);
      else await copyText(shareText).catch(() => false);
      alert(ok ? "Poster copied to clipboard — paste it into WhatsApp." : "Caption copied to clipboard.");
    } finally { setBusy(null); }
  };

  const sendWhatsApp = async () => {
    setBusy("wa");
    try {
      const blob = await capture();
      let shared = false;
      if (blob) {
        const file = new File([blob], fileName, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> };
        if (nav.canShare?.({ files: [file] }) && nav.share) {
          try { await nav.share({ files: [file], text: shareText }); shared = true; } catch { /* cancelled */ }
        }
        if (!shared) {
          try {
            const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
            if (CI && navigator.clipboard && "write" in navigator.clipboard) {
              await navigator.clipboard.write([new CI({ "image/png": blob })]);
            }
          } catch { /* clipboard blocked */ }
          const url = URL.createObjectURL(blob);
          download(url, fileName);
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }
      }
      if (!shared) {
        await copyText(shareText);
        openWhatsApp(shareText);
      }
    } finally { setBusy(null); }
  };

  const legs = flightLinesFor(f).map((line) => {
    const m = line.match(/^(\d{1,2}\s?[A-Za-z]{3})\s+(.*)$/);
    return { date: m ? m[1].toUpperCase() : "", rest: m ? m[2] : line };
  });

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1">
      {/* ---------- scaled shell (buttons live outside the captured node) ---------- */}
      <div ref={boxRef} className="relative aspect-square w-full overflow-hidden bg-white">
        <div style={{ width: 1080, height: 1080, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div ref={posterRef} style={{ width: 1080, height: 1080, position: "relative", backgroundColor: "#ffffff", overflow: "hidden", fontKerning: "normal" }}>
            {/* ============ HERO ============ */}
            <div style={{ position: "absolute", inset: "0 0 auto 0", height: 596, overflow: "hidden" }}>
              <img
                src={img}
                alt={`${f.destination}`}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { const t = e.currentTarget; if (t.src !== DESTINATION_FALLBACK) t.src = DESTINATION_FALLBACK; }}
              />
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${brand.bg}d9 0%, ${brand.bg}52 34%, ${brand.bg2}b8 74%, ${brand.bg} 100%)` }} />
              <Plane style={{ position: "absolute", right: -60, top: 150, width: 420, height: 420, transform: "rotate(28deg)", color: brand.accent, opacity: 0.16 }} />

              {/* masthead */}
              <div style={{ position: "absolute", left: 44, right: 44, top: 34, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <img src="/favicon.png" alt="" crossOrigin="anonymous" style={{ height: 76, width: 76, objectFit: "contain" }} />
                  <div style={{ lineHeight: 1 }}>
                    <p style={{ margin: 0, fontFamily: "var(--font-serif, serif)", fontSize: 27, fontWeight: 900, letterSpacing: "0.04em", color: "#fff" }}>ROHI INTERNATIONAL</p>
                    <p style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.34em", color: brand.accent }}>Travels · Since 1991</p>
                  </div>
                </div>
                <span style={{ display: "flex", height: 96, alignItems: "center", borderRadius: 20, background: "#fff", padding: "0 22px", boxShadow: "0 12px 30px rgba(0,0,0,0.28)" }}>
                  <AirlineLogo name={f.airline} height={62} />
                </span>
              </div>

              {/* route headline */}
              <div style={{ position: "absolute", left: 46, right: 46, bottom: 34 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-serif, serif)", fontSize: 84, fontWeight: 900, lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff" }}>
                    {f.origin.toUpperCase()}
                  </h3>
                  <Plane style={{ width: 54, height: 54, color: brand.accent, marginBottom: 10 }} />
                  <h3 style={{ margin: 0, fontFamily: "var(--font-serif, serif)", fontSize: 84, fontWeight: 900, lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase", color: brand.accent }}>
                    {f.destination.toUpperCase()}
                  </h3>
                </div>
                <p dir="rtl" lang="ur" style={{ margin: "16px 0 0", fontFamily: '"Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", serif', fontSize: 44, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>
                  {urduName(f.origin)} {urduName(f.destination)}
                </p>
              </div>
            </div>

            {/* accent rule */}
            <div style={{ position: "absolute", left: 0, right: 0, top: 596, height: 10, backgroundColor: brand.accent }} />

            {/* ============ DETAILS ============ */}
            <div style={{ position: "absolute", left: 0, right: 0, top: 606, bottom: 120, padding: "26px 46px 0", display: "flex", flexDirection: "column", gap: 14, background: "#f7f5f0" }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.4em", color: brand.ink }}>
                {f.airline}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {legs.slice(0, 3).map((leg, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 2px 0 rgba(0,0,0,0.06)" }}>
                    {leg.date && (
                      <span style={{ borderRadius: 8, padding: "6px 12px", fontFamily: "ui-monospace, monospace", fontSize: 22, fontWeight: 900, backgroundColor: brand.accent, color: brand.onAccent, whiteSpace: "nowrap" }}>
                        {leg.date}
                      </span>
                    )}
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: brand.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {leg.rest}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "auto", marginBottom: 22, display: "flex", gap: 12 }}>
                <div style={{ flex: 1, borderRadius: 16, padding: "16px 20px", backgroundColor: brand.accent, color: brand.onAccent }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.34em", opacity: 0.75 }}>Fare</p>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-serif, serif)", fontSize: 40, fontWeight: 900, lineHeight: 1, textTransform: "uppercase" }}>{f.price_text}</p>
                </div>
                {f.baggage && (
                  <div style={{ width: "36%", borderRadius: 16, padding: "16px 20px", backgroundColor: brand.bg, color: "#fff" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.3em", opacity: 0.6 }}>Baggage</p>
                    <p style={{ margin: "6px 0 0", fontFamily: "ui-monospace, monospace", fontSize: 34, fontWeight: 900, lineHeight: 1 }}>{f.baggage}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ============ FOOTER ============ */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, background: brand.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 46px" }}>
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-serif, serif)", fontSize: 26, fontWeight: 900, letterSpacing: "0.04em", color: "#fff" }}>{AGENCY_NAME}</p>
                <div style={{ margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.72)" }}>
                    <MapPin style={{ width: 16, height: 16 }} /> {AGENCY_ADDRESS}
                  </p>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>
                    rohitravels.com/agent/register
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", borderRadius: 999, padding: "12px 22px", fontFamily: "ui-monospace, monospace", fontSize: 28, fontWeight: 900, lineHeight: 1, backgroundColor: brand.accent, color: brand.onAccent }}>
                  <Phone style={{ width: 24, height: 24 }} /> {AGENCY_PHONE}
                </span>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#fff", fontStyle: "italic" }}>Abdul Razzaq</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- WhatsApp caption preview (never captured) ---------- */}
      <div className="border-t border-border bg-secondary/40 px-3 py-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">WhatsApp caption</p>
          <CopyBtn text={shareText} label="Copy caption" />
        </div>
        <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-[1.45] text-navy">{shareText}</pre>
      </div>


      {/* ---------- controls (never captured) ---------- */}
      <div className="grid grid-cols-3 border-t border-border">
        <button type="button" onClick={copyPoster} disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wide text-navy hover:bg-secondary disabled:opacity-60">
          <CopyIcon className="h-3.5 w-3.5" /> {busy === "copy" ? "…" : "Copy"}
        </button>
        <button type="button" onClick={doDownload} disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 border-x border-border py-3 text-[11px] font-bold uppercase tracking-wide text-navy hover:bg-secondary disabled:opacity-60">
          <Download className="h-3.5 w-3.5" /> {busy === "download" ? "…" : "Save"}
        </button>
        <button type="button" onClick={sendWhatsApp} disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-whatsapp py-3 text-[11px] font-bold uppercase tracking-wide text-whatsapp-foreground hover:brightness-95 disabled:opacity-60">
          <MessageCircle className="h-3.5 w-3.5" /> {busy === "wa" ? "…" : "Share"}
        </button>
      </div>
    </article>
  );
}
