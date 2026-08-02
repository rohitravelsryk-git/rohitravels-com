import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  Plane, LogOut, Sparkles, Copy as CopyIcon, Check, Download, MessageCircle, Image as ImageIcon,
  Film, Megaphone, Users, Bookmark, Trash2, Wand2, RefreshCw, Phone,
} from "lucide-react";
import { adminLogout, listFares, type Fare } from "@/lib/fares.functions";
import { generateMarketingCopy, generateMarketingImage, type MarketingCopy } from "@/lib/marketing.functions";
import { buildReel } from "@/lib/marketing-reel";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { useServerFn } from "@tanstack/react-start";
import rohiLogo from "@/assets/rohi-logo.png.asset.json";
import { AirlineLogo, urduName, destinationImage, DESTINATION_FALLBACK } from "@/routes/index";

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

function whatsappText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/🇵🇰/g, "[PK]").replace(/🇸🇦/g, "[SA]").replace(/🇦🇪/g, "[AE]")
    .replace(/🇶🇦/g, "[QA]").replace(/🇰🇼/g, "[KW]").replace(/🇴🇲/g, "[OM]")
    .replace(/🇧🇭/g, "[BH]").replace(/🇹🇷/g, "[TR]")
    .replace(/\uFE0E|\uFE0F/g, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "");
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

function buildShareText(f: Fare): string {
  const badge = countryBadge(f.destination) || countryBadge(f.origin);
  const line1 = `*${badge ? `[${badge}] ` : ""}${f.origin} ${f.destination} ${f.airline.toUpperCase()}*`;
  const details = (f.flight_details && f.flight_details.trim()) ? f.flight_details.trim() : flightLinesFor(f).join("\n");
  const line3 = `*${(f.baggage ?? "").replace(/KG$/i, " KG").trim()}*`;
  const community = [line1, details, line3].filter(Boolean).join("\n");
  const footer = `*${AGENCY_NAME} RYK*\nAbdul Razzaq\n*${AGENCY_PHONE}*`;
  return whatsappText(`${community}\n\n[GROUP] *Join WhatsApp Group:*\n${WA_GROUP_URL}\n\n[LIVE] *Live Group Fares:*\nhttps://rohitravels.lovable.app/\n\n${footer}`);
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

  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<"english" | "urdu" | "roman-urdu" | "mixed">("mixed");
  const [tone, setTone] = useState<"viral" | "premium" | "urgent" | "friendly">("viral");
  const [copy, setCopy] = useState<MarketingCopy | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "copy" | "image" | "video" | "auto">(null);
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
      const blob = await buildReel({ images: frames, headline, subline: "Book now — limited seats", seconds: 8 });
      setVideo(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Video build failed");
    } finally {
      setBusy(null);
    }
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
              <button onClick={() => run(prompt, true)} disabled={busy !== null || prompt.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-md bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wide text-gold-foreground disabled:opacity-50">
                <Wand2 className="h-3.5 w-3.5" /> {busy === "auto" ? "Creating…" : "Text + poster"}
              </button>
              <button onClick={() => run(`Create a campaign from today's live group fares:\n${faresBrief()}`, true)}
                disabled={busy !== null || fares.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-navy/20 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-navy disabled:opacity-50">
                <RefreshCw className="h-3.5 w-3.5" /> Auto from fares
              </button>
            </div>
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
                  <button onClick={() => openWhatsApp(allText)}
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
                  <button onClick={() => download(video, "rohi-reel.webm")}
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
      <section className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Select fares to broadcast
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-navy">
              {selected.length} selected
            </span>
            <button
              onClick={toggleAll}
              className="rounded-full border border-navy/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-navy hover:bg-secondary"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {fares.map((f) => (
            <li key={f.id}>
              <label className="flex cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.includes(f.id)}
                  onChange={() => toggle(f.id)}
                  className="h-4 w-4 shrink-0 accent-navy"
                />
                <span className="w-12 shrink-0"><AirlineLogo name={f.airline} height={22} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-sm font-black text-navy">
                    {f.origin_code} <span className="text-gold">→</span> {f.destination_code}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {[f.flight_date, f.baggage, f.airline].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right font-serif text-sm font-black text-navy">{f.price_text}</span>
              </label>
            </li>
          ))}
        </ul>

        <button
          onClick={() => setShown(selected)}
          disabled={selected.length === 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-gold" />
          Auto-generate cards{selected.length > 0 ? ` (${selected.length})` : ""}
        </button>
      </section>

      {shown !== null && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
      return await toBlob(posterRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
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
        try {
          const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
          if (CI && navigator.clipboard && "write" in navigator.clipboard) {
            await navigator.clipboard.write([new CI({ "image/png": blob })]);
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
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1">
      <div ref={posterRef} className="relative flex aspect-[3/4.2] flex-col overflow-hidden bg-navy">
        {/* destination / sky backdrop — current airline's sky */}
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
          style={{ background: "linear-gradient(180deg, rgba(4,48,70,0.95) 0%, rgba(6,92,116,0.86) 30%, rgba(24,158,176,0.5) 58%, rgba(255,255,255,0.04) 100%)" }}
        />

        <div className="relative flex flex-1 flex-col px-4 pb-4 pt-4">
          {/* headline */}
          <div className="w-full bg-[rgba(3,44,66,0.75)] px-3 py-3 text-center">
            <h3 className="font-mono text-[22px] font-black uppercase leading-none tracking-[0.04em] text-white">
              {f.origin.toUpperCase()} {f.destination.toUpperCase()}
            </h3>
          </div>

          {/* plane divider */}
          <div className="mt-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-white/50" />
            <Plane className="h-4 w-4 rotate-90 text-white" />
            <span className="h-px flex-1 bg-white/50" />
          </div>

          {/* airline logo + urdu band */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#3ec6c0] px-3 py-2">
            <span className="flex h-9 shrink-0 items-center rounded-lg bg-white px-2">
              <AirlineLogo name={f.airline} height={24} />
            </span>
            <p dir="rtl" lang="ur" className="truncate font-urdu text-2xl leading-tight text-white">
              {urduName(f.origin)} {urduName(f.destination)}
            </p>
          </div>

          {/* flight rows + fare pills */}
          <div className="mt-3 space-y-2">
            {legs.map((leg, i) => (
              <div key={i} className="grid grid-cols-[1.1fr_1fr] gap-2">
                <div className="flex items-baseline justify-center gap-1.5 truncate rounded-full bg-white px-3 py-2 font-mono text-[11px] font-black text-[#0d3b5c]">
                  {leg.date && <span className="text-[#0d3b5c]">{leg.date}</span>}
                  <span className="truncate text-[#1b6d8f]">{leg.rest}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate rounded-full bg-white px-2 py-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#3ec6c0]">
                    <Plane className="h-3 w-3 text-white" />
                  </span>
                  <span className="truncate font-mono text-[11px] font-black uppercase text-[#0d3b5c]">{f.price_text}</span>
                </div>
              </div>
            ))}
          </div>

          {/* luggage */}
          {f.baggage && (
            <div className="mt-4 self-start bg-white px-3 py-1.5 font-mono text-[11px] font-black text-[#0d3b5c]">
              Luggage: {f.baggage}
            </div>
          )}

          {/* footer: airline + brand + contact */}
          <div className="mt-auto flex items-end justify-between gap-3 pt-8">
            <div className="flex min-w-0 flex-col gap-2">
              <span className="flex w-fit items-center rounded-lg bg-white/95 px-2 py-1">
                <AirlineLogo name={f.airline} height={26} />
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <img src={rohiLogo.url} alt="Rohi" className="h-12 w-12 shrink-0 object-contain" crossOrigin="anonymous" />
                <div className="min-w-0 leading-none">
                  <p className="font-serif text-lg font-black tracking-wide text-gold">ROHI</p>
                  <p className="mt-0.5 font-serif text-[8px] font-bold tracking-[0.2em] text-white">INTERNATIONAL TRAVELS</p>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#3ec6c0] px-3 py-2 font-mono text-[12px] font-black leading-none text-white">
              <Phone className="h-3.5 w-3.5" /> {AGENCY_PHONE}
            </div>
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
