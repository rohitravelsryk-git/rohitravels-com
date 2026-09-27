import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import {
  Home,
  Plane, LogOut, Sparkles, Copy as CopyIcon, Check, Download, MessageCircle, Image as ImageIcon,
  Film, Megaphone, Users, Bookmark, Trash2, Wand2, RefreshCw, Phone, Upload, MapPin, Search, GripVertical,
  Save, Plus

} from "lucide-react";
import { adminLogout, listFaresAdmin, type Fare } from "@/lib/fares.functions";
import { generateMarketingCopy, generateMarketingImage, readImageText, type MarketingCopy } from "@/lib/marketing.functions";
import { sendMarketingEmail, validateEmailStatus } from "@/lib/email-marketing.functions";
import { buildReel } from "@/lib/marketing-reel";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminNotifications } from "@/components/AdminNotifications";
import { useServerFn } from "@tanstack/react-start";
import { AirlineLogo, urduName, destinationImage, DESTINATION_FALLBACK } from "@/routes/index";
import { airlineBrand } from "@/lib/airline-brand";
import { formatDateTimeShort } from "@/lib/date-format";

const faresQuery = queryOptions({ queryKey: ["fares-admin"], queryFn: () => listFaresAdmin(), staleTime: 0, refetchInterval: 2000, refetchIntervalInBackground: true });

export const Route = createFileRoute("/admin/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing Studio — Rohi Admin" },
      { name: "description", content: "Manage AI campaigns and email newsletters for Rohi International Travels." },
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

type MarketingService = { id: string; title: string; description: string };
const SERVICE_KEY = "rohi-marketing-services-v2";
const DEFAULT_SERVICES: MarketingService[] = [
  { id: "group-air-tickets", title: "Group Air Tickets", description: "Live group fares, airline schedules, baggage and limited-seat offers." },
  { id: "umrah", title: "Umrah Packages", description: "Umrah flights, hotels, transport and complete travel assistance." },
  { id: "visa", title: "Visa Assistance", description: "Professional visa assistance for popular destinations and travel purposes." },
  { id: "hotel", title: "Hotel Booking", description: "Hotel reservations for business, family and pilgrimage travel." },
  { id: "transport", title: "Airport & Ground Transport", description: "Airport transfers and reliable ground transportation." },
  { id: "insurance", title: "Travel Insurance", description: "Travel protection and insurance support for international journeys." },
];
function loadServices(): MarketingService[] {
  if (typeof window === "undefined") return DEFAULT_SERVICES;
  try {
    const value = JSON.parse(window.localStorage.getItem(SERVICE_KEY) || "null");
    return Array.isArray(value) && value.length ? value : DEFAULT_SERVICES;
  } catch { return DEFAULT_SERVICES; }
}

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

function formatFareAmount(value: string): string {
  const input = (value || "").trim();
  if (!input) return input;
  const formatted = input.replace(/(?<![\\d,])\\d+(?:,\\d{3})*(?:\\.\\d+)?(?![\\d])/g, (match) => {
    if (match.includes(".")) {
      const [whole, decimal] = match.split(".");
      return Number(whole.replace(/,/g, "")).toLocaleString("en-US") + "." + decimal;
    }
    return Number(match.replace(/,/g, "")).toLocaleString("en-US");
  });
  if (/^\\d+(?:,\\d{3})*(?:\\.\\d+)?$/.test(input)) return `PKR ${formatted}/-`;
  if (/^PKR\\s*\\d/i.test(input) && !formatted.includes("/-")) return formatted + "/-";
  return formatted;
}

async function shareImageAndCaption(imageUrl: string | null, caption: string): Promise<"shared" | "copied" | "text-only" | "failed"> {
  if (!imageUrl) {
    const ok = await copyText(caption);
    return ok ? "text-only" : "failed";
  }
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], "rohi-group-fare.png", { type: blob.type || "image/png" });
    if (navigator.share && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: caption, title: "ROHI INTERNATIONAL TRAVELS" });
      return "shared";
    }
  } catch {}
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      const item = new ClipboardItem({
        "text/plain": new Blob([caption], { type: "text/plain" }),
        [blob.type || "image/png"]: blob,
      });
      await navigator.clipboard.write([item]);
      return "copied";
    }
  } catch {}
  return (await copyText(caption)) ? "text-only" : "failed";
}

function flightLinesFor(f: Fare): string[] {
  const date = fmtDate(f.flight_date);
  if (f.flight_details && f.flight_details.trim()) {
    return f.flight_details.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
      if (!date || /^\d{1,2}\s*[A-Za-z]{3}\b/.test(line)) return line;
      return date + " " + line;
    });
  }
  const one = [date, f.origin_code?.toUpperCase(), f.destination_code?.toUpperCase(), f.depart_time, f.arrive_time]
    .filter(Boolean).join(" ");
  return one ? [one] : [];
}

function countryBadge(city: string): string {
  const c = city.trim().toUpperCase();
  const pk = ["PK","KHI","LHE","ISB","PEW","MUX","LYP","SKT","UET","KARACHI","LAHORE","ISLAMABAD","PESHAWAR","MULTAN","FAISALABAD","SIALKOT","QUETTA"];
  const sa = ["SA","JED","RUH","DMM","MED","ELQ","RIYADH","JEDDAH","DAMMAM","MEDINA","MADINAH","MAKKAH","QASSIM"];
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

  const origin = (f.origin || "").toUpperCase();
  const dest = (f.destination || "").toUpperCase();

  lines.push(`🔥 *URGENT SEAT ALERT! ${origin} TO ${dest} DIRECT FLIGHTS!* 🔥`);
  lines.push("");
  lines.push(`${flag} *${origin} ${dest}*`);
  lines.push("");
  if (f.airline) lines.push(`${f.airline.toUpperCase()}`);
  lines.push("");

  const legs = flightLinesFor(f);
  if (legs.length) {
    legs.forEach((l) => lines.push(l.toUpperCase()));
  }

  const bag = (f.baggage ?? "").trim() || "20+10 KG";
  const fare = (f.price_text ?? "").trim();

  lines.push("");
  lines.push(`Baggage: ${bag}`);
  if (fare && !fare.toLowerCase().includes("fare on whatsapp")) {
    lines.push("");
    lines.push(`Fare: ${fare.toUpperCase()}`);
  }

  lines.push("");
  lines.push(`*${AGENCY_NAME}*`);
  lines.push(`Abdul Razzaq`);
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
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}


function MarketingPage() {
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const { data: fares } = useSuspenseQuery(faresQuery);
  const [tab, setTab] = useState<"studio" | "saved" | "email">("studio");

  async function onLogout() {
    try { await logout(); } catch {}
    router.navigate({ to: "/admin" });
  }

  return (
    <div className="min-h-screen bg-background animate-premium-fade">
      <header className="border-b border-[rgba(255,255,255,0.10)] bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-white" />
            <div>
              <p className="font-sans text-lg font-semibold">Admin Panel</p>
              <p className="text-[11px] font-medium text-white/70">Marketing studio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <a href="/" className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 space-y-4">
        {/* AdminNotifications is now globally mounted in __root */}
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <h1 className="font-sans text-2xl font-black text-navy">Marketing Studio</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Create, automate, save, and send marketing campaigns from one place.
          </p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {([
            ["studio", "Marketing Studio", Sparkles],
            ["saved", "Saved Campaigns", Bookmark],
            ["email", "Email Newsletter", Megaphone],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={"inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-extrabold uppercase tracking-wide transition-all " + (tab === id ? "bg-[#171717] text-white shadow-sm" : "border border-navy/15 bg-white text-navy hover:bg-[#171717] hover:text-white")}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === "studio" && <GroupFaresStudio fares={fares} />}
        {tab === "saved" && <SavedList />}
        {tab === "email" && <EmailNewsletter fares={fares} />}
      </div>
    </div>
  );
}

/* ---------------------------- AI STUDIO ---------------------------- */

function GroupFaresStudio({ fares }: { fares: Fare[] }) {
  const genCopy = useServerFn(generateMarketingCopy);
  const genImage = useServerFn(generateMarketingImage);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(fares.find((f) => !f.is_deleted)?.id ?? null);
  const [language, setLanguage] = useState<"english" | "urdu" | "roman-urdu" | "mixed">("mixed");
  const [tone, setTone] = useState<"viral" | "premium" | "urgent" | "friendly">("urgent");
  const [shareFare, setShareFare] = useState(false);
  const [copy, setCopy] = useState<MarketingCopy | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState<"mp4" | "webm">("mp4");
  const [busy, setBusy] = useState<null | "copy" | "image" | "auto">(null);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [shareState, setShareState] = useState<"shared" | "copied" | "text-only" | "failed" | null>(null);

  const liveFares = fares.filter((f) => !f.is_deleted);
  const list = liveFares.filter((f) => {
    const hay = [f.origin, f.destination, f.origin_code, f.destination_code, f.airline, f.flight_date, f.group_type, f.category].join(" ").toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const fare = liveFares.find((f) => f.id === selectedId) ?? list[0] ?? null;

  function defaultInstructions(f: Fare) {
    const route = (f.origin_code || f.origin) + " → " + (f.destination_code || f.destination);
    const details = flightLinesFor(f).join("\n") || (fmtDate(f.flight_date) + " " + route);
    return [
      "Create a ROHI INTERNATIONAL TRAVELS Group Fare marketing pack.",
      "Group Fare: " + route,
      "Airline: " + (f.airline || "Airline").toUpperCase(),
      "Flight details:\n" + details,
      "Baggage: " + ((f.baggage || "").trim() || "Baggage as listed"),
      "Fare: " + ((f.price_text || "").trim() || "FARE ON WHATSAPP"),
      f.seats ? "Seats: " + f.seats : "",
      "",
      "Required WhatsApp-ready message structure:",
      "💥 *Lowest Fares | All Airlines Available* 💥",
      "WEB & GDS",
      "ROHI INTERNATIONAL TRAVELS",
      "📲 *Book Now*",
      "*" + AGENCY_PHONE + "*",
      "",
      "Use only the supplied live fare details. Never invent fare, seats, dates, baggage, availability or airline claims.",
    ].filter(Boolean).join("\n");
  }

  function promptForFare(f: Fare) {
    return instructions.trim() || defaultInstructions(f);
  }

  useEffect(() => {
    if (fare && !instructions.trim()) setInstructions(defaultInstructions(fare));
    // Keep editable instructions aligned to the selected fare; preserve manual edits while staying on the same fare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function displayText(f: Fare) {
    const route = ((f.origin_code || f.origin) + " → " + (f.destination_code || f.destination)).toUpperCase();
    const lines = [
      "💥 *" + route + " — GROUP FARE* 💥",
      (f.airline || "").toUpperCase(),
      ...flightLinesFor(f).map((l) => l.toUpperCase()),
      "BAGGAGE: " + (f.baggage || "AS LISTED").toUpperCase(),
      f.price_text ? "FARE: " + formatFareAmount(f.price_text).toUpperCase() : "FARE: ON WHATSAPP",
      f.seats ? "SEATS: " + String(f.seats).toUpperCase() : "",
      "",
      "*" + AGENCY_NAME + "*",
      "📲 *Book Now*",
      "*" + AGENCY_PHONE + "*",
    ];
    return lines.filter(Boolean).join("\n");
  }

  async function generateAll(f: Fare) {
    // FREE PACK: deliberately uses only the browser-local poster renderer + MediaRecorder.
    // It must never call AI/server generation, so selecting a fare or pressing this button
    // does not consume AI image/copy credits.
    setError(null); setBusy("auto"); setImage(null); setVideo(null);
    try {
      const poster = await capture();
      if (!poster) throw new Error("Could not build the free local image. Try again.");
      const posterUrl = URL.createObjectURL(poster);
      setImage(posterUrl);

      try {
        const reel = await buildReel({
          images: [posterUrl],
          headline: (f.origin_code || f.origin) + " → " + (f.destination_code || f.destination),
          route: (f.origin || f.origin_code) + " → " + (f.destination || f.destination_code),
          airline: f.airline || "GROUP FARE",
          flightDetails: flightLinesFor(f),
          baggage: f.baggage || undefined,
          fare: shareFare && f.price_text && !/whatsapp/i.test(f.price_text) ? formatFareAmount(f.price_text) : undefined,
          seats: f.seats ? String(f.seats) : undefined,
          cta: "WhatsApp ROHI for booking & assistance",
          seconds: 12,
          music: true,
        });
        setVideoExt(reel.ext);
        setVideo(URL.createObjectURL(reel.blob));
      } catch {
        setVideo(null);
      }
      setLastGeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the free marketing pack.");
    } finally { setBusy(null); }
  }

  // IMPORTANT: changing the selected fare must NEVER auto-run AI generation or consume credits.
  useEffect(() => {
    setCopy(null);
    setImage(null);
    setVideo(null);
  }, [selectedId]);

  async function generateCopyOnly() {
    if (!fare) return;
    setError(null); setBusy("copy");
    try { setCopy(await genCopy({ data: { prompt: promptForFare(fare), language, tone, shareFare } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not generate copy."); }
    finally { setBusy(null); }
  }

  async function regenerateImage() {
    if (!fare) return;
    setError(null); setBusy("image");
    try {
      const generated = await genImage({ data: { prompt: copy?.imagePrompt || promptForFare(fare), format: "status", withText: true } });
      setImage(generated.dataUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not regenerate the image."); }
    finally { setBusy(null); }
  }

  const text = fare ? (shareFare ? displayText(fare) : (copy?.status?.trim() || displayText(fare))) : "";
  const field = "w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-gold";
  const label = "mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-navy/55";

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-navy/10 bg-navy p-5 text-white lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-gold" /><h2 className="text-lg font-black">Group Fares Available</h2></div>
            <p className="mt-1 text-xs text-white/65">Select a live group fare. Free image + reel generation runs locally in your browser — no AI credits.</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-right"><div className="text-[9px] font-black uppercase tracking-[0.15em] text-white/55">Live Group Fares</div><div className="text-xl font-black">{liveFares.length}</div></div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(360px,1.15fr)]">
          <section className="overflow-hidden rounded-xl border border-navy/10 bg-secondary/20">
            <div className="border-b border-navy/10 p-3">
              <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-widest text-navy">Group fare</h3><span className="text-[10px] font-bold text-muted-foreground">{list.length} shown</span></div>
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search route, airline, date" className={field + " pl-9"} /></div>
              <div className="mt-3 grid grid-cols-[minmax(0,1.45fr)_minmax(90px,0.8fr)_minmax(80px,0.75fr)_minmax(80px,0.75fr)] gap-2 px-2 text-[8px] font-black uppercase tracking-wider text-muted-foreground"><span>Flight Details</span><span>Baggage</span><span>V.FARE</span><span>VENDOR</span></div>
            </div>
            <div className="max-h-[540px] overflow-y-auto p-2">
              {list.map((f) => {
                const active = f.id === fare?.id;
                return <button key={f.id} type="button" onClick={() => { setSelectedId(f.id); setCopy(null); setImage(null); setVideo(null); setError(null); }} className={"mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all " + (active ? "border-gold bg-gold/10 shadow-sm" : "border-transparent bg-white hover:border-navy/10 hover:shadow-sm")}>
                  <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg border border-navy/10 bg-white p-1"><AirlineLogo name={f.airline} height={26} /></span>
                  <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1.45fr)_minmax(90px,0.8fr)_minmax(80px,0.75fr)_minmax(80px,0.75fr)] items-center gap-2"><span className="min-w-0"><span className="block truncate text-[10px] font-normal text-navy/55">{f.origin_code} → {f.destination_code}</span><span className="block truncate text-[11px] font-black uppercase text-navy">{f.origin || f.origin_code} → {f.destination || f.destination_code}</span><span className="mt-0.5 block truncate text-[9px] font-semibold text-muted-foreground">{f.airline}</span><span className="block truncate text-[8px] text-muted-foreground">{flightLinesFor(f).join(" | ")}</span></span><span className="truncate text-[10px] font-bold text-navy">{f.baggage || "—"}</span><span className="truncate text-[10px] font-black text-navy">{f.vendor_fare || "—"}</span><span className="truncate text-[10px] font-bold text-navy">{f.vendor_name || "—"}</span></span>
                </button>;
              })}
              {list.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No live group fares match your search.</p>}
            </div>
          </section>

          <section className="space-y-4">
            {fare ? <>
              <div className="rounded-xl border border-navy/10 bg-secondary/20 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Selected group fare</p><p className="mt-1 text-[11px] font-normal text-navy/55">{fare.origin_code} → {fare.destination_code}</p><h3 className="mt-0.5 text-base font-black uppercase text-navy">{fare.origin || fare.origin_code} → {fare.destination || fare.destination_code}</h3><p className="mt-1 text-xs font-bold text-navy/65">{fare.airline}</p></div><div className="flex items-center gap-2"><CopyBtn text={text} label="Copy WhatsApp Status" /><label className="flex items-center gap-2 rounded-xl border border-navy/10 bg-white px-3 py-1.5 cursor-pointer"><input type="checkbox" checked={shareFare} onChange={(e) => setShareFare(e.target.checked)} className="h-4 w-4 accent-navy" /><span><span className="block text-[9px] font-black uppercase tracking-wide text-navy">Enable fare sharing</span><span className="block text-[8px] font-semibold text-muted-foreground">{shareFare ? "Fare/price may be included." : "OFF — fare is NEVER shared."}</span></span></label><span className="rounded-full bg-gold/15 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-navy">Live</span></div></div>
                <div className="space-y-3"><div><div className="grid gap-2 sm:grid-cols-2">{flightLinesFor(fare).map((line, i) => <div key={line + i} className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-navy shadow-sm">{line}</div>)}</div></div><div className="rounded-lg border border-navy/10 bg-white px-3 py-2.5 text-[11px] font-black text-navy shadow-sm"><span className="text-muted-foreground">BAGGAGE:</span> {fare.baggage || "As listed"}</div><div className="rounded-lg border border-navy/10 bg-white px-3 py-2.5 text-[11px] font-black text-navy shadow-sm"><span className="text-muted-foreground">FARE:</span> {formatFareAmount(fare.price_text || "On WhatsApp")}</div></div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className={label}>Auto tone + language</span><div className="grid grid-cols-2 gap-2"><select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className={field}><option value="urgent">Urgent</option><option value="viral">Viral</option><option value="premium">Premium</option><option value="friendly">Friendly</option></select><select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} className={field}><option value="mixed">Urdu + English</option><option value="english">English</option><option value="urdu">Urdu</option><option value="roman-urdu">Roman Urdu</option></select></div></label>
                <div><span className={label}>Actions</span><div className="grid grid-cols-2 gap-2"><button type="button" disabled={!!busy} onClick={() => { setInstructions(instructions || defaultInstructions(fare)); setInstructionsOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-3 text-[10px] font-black uppercase tracking-wide text-navy disabled:opacity-50"><Wand2 className="h-4 w-4" /> Instructions</button><button type="button" disabled={!!busy} onClick={() => void generateAll(fare)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-3 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-50">{busy === "auto" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate Free Pack</button></div></div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Free Image</p><h3 className="mt-1 text-sm font-black text-navy">FREE local generation</h3></div><button type="button" disabled={!!busy} onClick={() => void regenerateImage()} className="inline-flex items-center gap-1.5 rounded-lg border border-navy/10 px-2.5 py-1.5 text-[10px] font-black uppercase text-navy disabled:opacity-50"><RefreshCw className={"h-3.5 w-3.5 " + (busy === "image" ? "animate-spin" : "")} /> Regenerate</button></div>
                  {image ? <img src={image} alt={(fare.origin || "") + " to " + (fare.destination || "") + " group fare"} className="max-h-[440px] w-full rounded-xl border border-navy/10 object-contain bg-secondary/20" /> : <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-navy/15 bg-secondary/20 text-center text-xs text-muted-foreground">Selecting a live group fare auto-generates the image.</div>}
                  {image && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => download(image, "rohi-group-fare-" + slugify((fare.origin_code || "") + "-" + (fare.destination_code || "")) + ".png")} className="inline-flex items-center gap-1.5 rounded-lg border border-navy/10 px-3 py-2 text-[10px] font-black uppercase text-navy"><Download className="h-4 w-4" /> Download</button><button type="button" disabled={shareState === "copied" || shareState === "shared"} onClick={async () => { setShareState(null); const result = await shareImageAndCaption(image, text); setShareState(result); setTimeout(() => setShareState(null), 2200); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-[10px] font-black uppercase text-white disabled:opacity-60"><MessageCircle className="h-4 w-4" /> {shareState === "shared" ? "Shared" : shareState === "copied" ? "Image + Caption Copied" : shareState === "text-only" ? "Caption Copied" : "Share Image + Caption"}</button></div>}
                </div>

                <div className="rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Film className="h-4 w-4 text-gold" /><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Free Reel / Video</p><h3 className="text-sm font-black text-navy">FREE local generation</h3></div></div>{video && <button type="button" onClick={() => download(video, "rohi-group-fare-" + slugify((fare.origin_code || "") + "-" + (fare.destination_code || "")) + "." + videoExt)} className="inline-flex items-center gap-1.5 rounded-lg border border-navy/10 px-3 py-2 text-[10px] font-black uppercase text-navy"><Download className="h-4 w-4" /> Download Video</button>}</div>
                  {video ? <video src={video} controls playsInline className="max-h-[520px] w-full rounded-xl bg-black object-contain" /> : <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-navy/15 bg-secondary/20 text-center text-xs text-muted-foreground">The reel/video is generated automatically after the image.</div>}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/40 px-4 py-3"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Changes Daily Auto</p><p className="text-xs font-semibold text-navy">Live fare data is read from the admin fare list each time this studio opens.</p></div>{lastGeneratedAt && <span className="text-[10px] font-bold text-muted-foreground">Generated {lastGeneratedAt}</span>}</div>
            </> : <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-dashed border-navy/15 bg-secondary/20 p-8 text-center"><div><Plane className="mx-auto h-10 w-10 -rotate-45 text-navy/30" /><h3 className="mt-3 text-sm font-black text-navy">No live group fares available</h3><p className="mt-1 text-xs text-muted-foreground">Add or activate a fare in the admin fare manager and it will appear here automatically.</p></div></div>}
          </section>
        </div>
      </section>
      {instructionsOpen && fare && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Editable Instructions</p><h3 className="text-lg font-black text-navy">Customize marketing instructions</h3></div>
              <button type="button" onClick={() => setInstructionsOpen(false)} className="rounded-lg border border-navy/10 px-3 py-1.5 text-xs font-bold text-navy">Close</button>
            </div>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="h-[360px] w-full rounded-xl border border-navy/15 bg-secondary/20 p-4 font-mono text-xs leading-relaxed text-navy outline-none focus:border-gold" />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setInstructions(defaultInstructions(fare))} className="rounded-xl border border-navy/15 bg-white px-4 py-2 text-xs font-bold text-navy">Reset Default</button>
              <button type="button" onClick={() => { setInstructionsOpen(false); void generateCopyOnly(); }} className="rounded-xl bg-navy px-4 py-2 text-xs font-black uppercase tracking-wide text-white">Save & Generate Instructions</button>
            </div>
          </div>
        </div>
      )}
      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">{error}</div>}
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
  const [items, setItems] = useState<SavedItem[]>(loadSaved());
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ title: "", text: "", type: "text" as "text" | "image" | "reel" });
  const [file, setFile] = useState<File | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => { setItems(loadSaved()); }, []);

  function saveItems(next: SavedItem[]) {
    setItems(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      const noImgs = next.map(i => ({ ...i, image: undefined }));
      setItems(noImgs);
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(noImgs));
    }
  }

  function onDragStart(idx: number) {
    setDraggedIdx(idx);
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const next = [...items];
    const item = next.splice(draggedIdx, 1)[0];
    next.splice(idx, 0, item);
    setItems(next);
    setDraggedIdx(idx);
  }

  function onDragEnd() {
    saveItems(items);
    setDraggedIdx(null);
  }

  function remove(id: string) {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    saveItems(items.filter((i) => i.id !== id));
  }

  function startEdit(item: SavedItem) {
    setEditingId(item.id);
    setNewItem({ title: item.title, text: item.text, type: "text" });
    setIsAdding(true);
  }

  async function handleAdd() {
    if (!newItem.title || !newItem.text) return;

    let imageData: string | undefined = undefined;
    if (file) {
      imageData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
    } else if (editingId) {
      imageData = items.find(i => i.id === editingId)?.image;
    }

    const item: SavedItem = {
      id: editingId || crypto.randomUUID(),
      createdAt: editingId ? (items.find(i => i.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      title: newItem.title,
      text: newItem.text,
      image: imageData,
    };

    const next = editingId 
      ? items.map(i => i.id === editingId ? item : i)
      : [item, ...items].slice(0, 20);
    
    saveItems(next);
    setIsAdding(false);
    setEditingId(null);
    setNewItem({ title: "", text: "", type: "text" });
    setFile(null);
  }

  if (items.length === 0 && !isAdding) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-sm text-muted-foreground">No saved campaigns yet.</p>
        <button
          onClick={() => { setIsAdding(true); setEditingId(null); }}
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-xs font-bold uppercase text-white"
        >
          <Sparkles className="h-4 w-4 text-gold" /> Add Manual Campaign
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-widest text-navy">Saved Library</h2>
        {!isAdding && (
          <button
            onClick={() => { setIsAdding(true); setEditingId(null); }}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-[11px] font-bold uppercase text-white"
          >
            <Sparkles className="h-3.5 w-3.5 text-gold" /> Add Campaign
          </button>
        )}
      </div>

      {isAdding && (
        <div className="rounded-2xl border-2 border-dashed border-navy/20 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-navy">
            {editingId ? "Edit Campaign" : "Add New Campaign"}
          </h3>
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Campaign Title
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="e.g. Makkah Umrah Special Oct"
                  className="mt-1 block w-full rounded-md border border-navy/15 bg-background p-2 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
              {!editingId && (
                <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Type
                  <select
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value as any })}
                    className="mt-1 block w-full rounded-md border border-navy/15 bg-background p-2 text-sm text-navy outline-none focus:border-gold"
                  >
                    <option value="text">Text only</option>
                    <option value="image">Image Post</option>
                    <option value="reel">Video Reel</option>
                  </select>
                </label>
              )}
            </div>
            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Campaign Text / Caption
                <textarea
                  value={newItem.text}
                  onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
                  rows={4}
                  placeholder="Paste your campaign text here..."
                  className="mt-1 block w-full rounded-md border border-navy/15 bg-background p-2 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {!editingId && newItem.type !== "text" && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-navy/15 bg-secondary/50 px-4 py-2 text-xs font-bold text-navy hover:bg-secondary">
                  <Upload className="h-4 w-4" />
                  {file ? file.name : `Select ${newItem.type}`}
                  <input
                    type="file"
                    accept={newItem.type === "image" ? "image/*" : "video/*,image/*"}
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
              {editingId && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-navy/15 bg-secondary/50 px-4 py-2 text-xs font-bold text-navy hover:bg-secondary">
                  <Upload className="h-4 w-4" />
                  Replace Image (optional)
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setIsAdding(false); setEditingId(null); setFile(null); }}
                className="rounded-lg border border-navy/10 px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newItem.title || !newItem.text}
                className="rounded-lg bg-navy px-6 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
              >
                {editingId ? "Save Changes" : "Save to Library"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((it, idx) => (
          <article 
            key={it.id} 
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
            className={`flex flex-col rounded-2xl border border-navy/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md cursor-move ${draggedIdx === idx ? 'opacity-50 ring-2 ring-gold' : ''}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <GripVertical className="h-3.5 w-3.5 text-navy/20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-navy uppercase tracking-tight">{it.title}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDateTimeShort(it.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={async () => {
                    const ok = await copyText(it.text);
                    if (ok) alert("Campaign text copied to clipboard.");
                  }}
                  className="rounded-md p-1.5 text-navy hover:bg-navy/5 transition-colors"
                  title="Quick Copy"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => startEdit(it)} className="rounded-md p-1.5 text-navy hover:bg-navy/5 transition-colors" title="Edit">
                  <Wand2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(it.id)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {it.image && (
              <div className="group relative mb-3 overflow-hidden rounded-lg border border-navy/5">
                <img src={it.image} alt={it.title} width={800} height={600} loading="lazy" decoding="async" className="w-full object-cover aspect-[4/3] group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            )}
            <div className="flex-1 bg-secondary/30 rounded-lg p-3 mb-3 max-h-40 overflow-y-auto scrollbar-thin">
              <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-relaxed text-navy/80">{it.text}</pre>
            </div>
            <div className="flex gap-2 pt-2 border-t border-navy/5">
              <CopyBtn text={it.text} label="Copy text" />
              <button onClick={() => openWhatsApp(it.text)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-whatsapp px-2 py-1.5 text-[11px] font-bold uppercase text-whatsapp-foreground hover:bg-whatsapp/90 shadow-sm transition-colors">
                <MessageCircle className="h-3.5 w-3.5" /> Send WhatsApp
              </button>
            </div>
          </article>
        ))}
      </div>
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
            <p className="font-sans text-base font-black tracking-wide">Auto Fare Marketing</p>
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
                    on ? "border-success bg-success-soft/70 ring-1 ring-success/30" : "border-border bg-background hover:border-navy/25"
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${
                      on ? "border-success bg-success text-white" : "border-navy/25 bg-card"
                    }`}
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                    <input type="checkbox" checked={on} onChange={() => toggle(f.id)} className="hidden" />
                  </span>
                  <span className="flex w-14 shrink-0 justify-center"><AirlineLogo name={f.airline} height={24} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-base font-black leading-tight text-navy">
                      {f.origin_code?.toUpperCase()} <span className="text-gold">→</span> {f.destination_code?.toUpperCase()}
                    </span>
                    <span className="block truncate font-sans tabular-nums text-[10px] tracking-tight text-navy/55">
                      {fmtDate(f.flight_date)} · {detail}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-sans tabular-nums text-[10px] font-bold text-muted-foreground">{f.baggage ?? ""}</span>
                    <span className="block font-sans text-[11px] font-black text-navy">{f.price_text}</span>
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
                width={1080} height={596} loading="lazy" decoding="async"
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
                  <img src="/favicon.png" alt="Rohi International Travels logo" crossOrigin="anonymous" style={{ height: 76, width: 76, objectFit: "contain" }}  width={512} height={454} loading="lazy" decoding="async" />
                  <div style={{ lineHeight: 1 }}>
                    <p style={{ margin: 0, fontFamily: "var(--font-sans, serif)", fontSize: 27, fontWeight: 900, letterSpacing: "0.04em", color: "#fff" }}>ROHI INTERNATIONAL</p>
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
                  <h3 style={{ margin: 0, fontFamily: "var(--font-sans, serif)", fontSize: 84, fontWeight: 900, lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#fff" }}>
                    {f.origin.toUpperCase()}
                  </h3>
                  <Plane style={{ width: 54, height: 54, color: brand.accent, marginBottom: 10 }} />
                  <h3 style={{ margin: 0, fontFamily: "var(--font-sans, serif)", fontSize: 84, fontWeight: 900, lineHeight: 0.88, letterSpacing: "-0.02em", textTransform: "uppercase", color: brand.accent }}>
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
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-sans, serif)", fontSize: 40, fontWeight: 900, lineHeight: 1, textTransform: "uppercase" }}>{f.price_text}</p>
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
                <p style={{ margin: 0, fontFamily: "var(--font-sans, serif)", fontSize: 26, fontWeight: 900, letterSpacing: "0.04em", color: "#fff" }}>{AGENCY_NAME}</p>
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

/* ---------------------------- EMAIL NEWSLETTER ---------------------------- */

function EmailNewsletter({ fares }: { fares: Fare[] }) {
  const sendEmail = useServerFn(sendMarketingEmail);
  const validateEmail = useServerFn(validateEmailStatus);

  const [emailList, setEmailList] = useState("");
  const [subject, setSubject] = useState("Exclusive Group Fare Updates - Rohi International Travels");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ successCount: number; failedCount: number } | null>(null);
  const [preview, setPreview] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; type: string; data: string }[]>([]);
  const [showRecipientBox, setShowRecipientBox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Default template
    const fareItems = fares.slice(0, 10).map(f => {
      const legs = flightLinesFor(f);
      const flightDetailsHtml = legs.map(l => `<p style="margin: 2px 0; font-size: 11px; color: #444; font-family: monospace;">${l.toUpperCase()}</p>`).join("");
      
      return `
        <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
          <h3 style="margin: 0; color: #001f3f; font-size: 16px;">${f.origin} to ${f.destination}</h3>
          <p style="margin: 5px 0; color: #666; font-size: 13px;"><strong>${f.airline}</strong></p>
          <div style="margin: 8px 0; background: #f8f8f8; padding: 10px; border-radius: 4px;">
            <p style="margin: 0 0 5px; font-size: 10px; text-transform: uppercase; color: #999; font-weight: bold; letter-spacing: 1px;">Flight Details</p>
            ${flightDetailsHtml}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
            <div>
              <p style="margin: 0; font-weight: bold; color: #D4AF37; font-size: 18px;">${f.price_text}</p>
              <p style="margin: 2px 0 0; font-size: 11px; color: #888;">Baggage: ${f.baggage || '30+7 KG'}</p>
            </div>
          </div>
        </div>
      `;
    }).join("");

    setContent(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #001f3f; color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">ROHI INTERNATIONAL TRAVELS</h1>
          <p style="margin: 10px 0 0; opacity: 0.8; font-size: 14px;">Your Trusted Partner for Better Fares Since 1991</p>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #001f3f; margin-top: 0;">Latest Group Fare Updates</h2>
          <p>Dear Valued Partner,</p>
          <p>We are pleased to share our latest exclusive group fares. These seats are limited and available on a first-come, first-served basis.</p>
          
          <div style="margin: 30px 0;">
            ${fareItems}
          </div>

          <div style="text-align: center; margin-top: 40px;">
            <a href="https://rohitravels.com" style="background-color: #D4AF37; color: #001f3f; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">BOOK NOW ON PORTAL</a>
          </div>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          <p>Sardar Market, Shahi Road, Rahim Yar Khan | 0305 6622988</p>
          <p>&copy; 2026 Rohi International Travels. All rights reserved.</p>
        </div>
      </div>
    `);
  }, [fares]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newAttachments = [...attachments];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        newAttachments.push({
          name: file.name,
          type: file.type,
          data: data.split(",")[1], // Base64 part only
        });
        setAttachments([...newAttachments]);
      };
      reader.readAsDataURL(file);
    }
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSend() {
    const rawEmails = emailList.split(/[\n,;]+/).map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const uniqueEmails = Array.from(new Set(rawEmails));

    if (uniqueEmails.length === 0) {
      alert("Please enter at least one valid email address.");
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const validatedEmails: string[] = [];
      for (const email of uniqueEmails) {
        const { isValid } = await validateEmail({ data: { email } });
        if (isValid) validatedEmails.push(email);
      }

      if (validatedEmails.length === 0) {
        alert("No valid or active emails found in the list.");
        setBusy(false);
        return;
      }

      const res = await sendEmail({
        data: {
          emails: validatedEmails,
          subject,
          html: content,
          attachments: attachments.length > 0 ? attachments : undefined
        }
      });
      setResult(res);
      setPreview(false);
    } catch (e) {
      console.error("[EmailMarketing] Error in handleSend:", e);
      alert(`Failed to send emails: ${e instanceof Error ? e.message : "Unknown error"}. Please try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_450px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-navy">Recipient List</h2>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const { listAgentsAdmin } = await import("@/lib/agent-admin.functions");
                  try {
                    const agents = await listAgentsAdmin();
                    const emails = agents.map(a => a.email).join(", ");
                    setEmailList(prev => prev ? `${prev}, ${emails}` : emails);
                  } catch (e) {
                    alert("Failed to fetch agent list");
                  }
                }}
                className="text-[10px] font-black uppercase text-gold hover:underline"
              >
                Auto-fetch Agents
              </button>
              <button
                onClick={() => setShowRecipientBox(!showRecipientBox)}
                className="text-[10px] font-black uppercase text-navy/50 hover:text-navy hover:underline"
              >
                {showRecipientBox ? "Hide Box" : "Show Saved List"}
              </button>
            </div>
          </div>
          
          <textarea
            value={emailList}
            onChange={(e) => setEmailList(e.target.value)}
            placeholder="Enter email addresses (separated by commas, semicolons, or new lines)"
            className="h-40 w-full rounded-lg border border-navy/15 p-3 text-sm outline-none focus:border-gold"
          />
          
          {showRecipientBox && (
            <div className="mt-4 rounded-lg bg-secondary/30 p-4 border border-navy/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-navy/60">Saved Lists</span>
                <button 
                  onClick={() => {
                    const saved = localStorage.getItem("rohi-saved-email-lists") || "[]";
                    const lists = JSON.parse(saved);
                    const name = prompt("Name this list:");
                    if (name) {
                      lists.push({ name, emails: emailList });
                      localStorage.setItem("rohi-saved-email-lists", JSON.stringify(lists));
                      alert("List saved!");
                    }
                  }}
                  className="text-[9px] font-bold uppercase text-navy hover:underline"
                >
                  Save Current List
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {JSON.parse(localStorage.getItem("rohi-saved-email-lists") || "[]").map((list: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setEmailList(list.emails)}
                    className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-navy shadow-sm hover:bg-gold hover:text-white"
                  >
                    {list.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-2 text-[10px] text-muted-foreground italic">
            * Emails are sent individually (BCC style). Format: example@mail.com, another@mail.com; next@mail.com
          </p>
        </section>

        <section className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-navy">Newsletter Subject</h2>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-navy/15 p-3 text-sm outline-none focus:border-gold"
          />
        </section>

        <section className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-navy">Email Content (HTML)</h2>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-96 w-full rounded-lg border border-navy/15 p-3 font-sans tabular-nums text-xs outline-none focus:border-gold"
          />
        </section>

        <section className="rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-navy">Attachments</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-gold hover:underline"
            >
              <Upload className="h-3 w-3" /> Add Files
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
            />
          </div>
          
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {attachments.map((file, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5 text-xs text-navy">
                  <span className="max-w-[150px] truncate font-bold">{file.name}</span>
                  <button onClick={() => removeAttachment(i)} className="text-destructive hover:scale-110">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">No files attached</p>
          )}
        </section>
      </div>

      <div className="space-y-5">
        <section className="sticky top-6 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-navy">Live Preview</h2>
            <button
              onClick={() => setPreview(!preview)}
              className="text-[10px] font-black uppercase text-gold hover:underline"
            >
              {preview ? "Edit Template" : "Full Preview"}
            </button>
          </div>

          <iframe
            title="Newsletter content preview"
            sandbox=""
            srcDoc={content}
            className="h-[500px] w-full rounded-lg border border-navy/5 bg-gray-50"
          />

          <div className="mt-6 space-y-3">
            <button
              onClick={handleSend}
              disabled={busy}
              className="w-full rounded-xl bg-gold py-4 text-xs font-black uppercase tracking-widest text-gold-foreground shadow-lg hover:brightness-105 disabled:opacity-50"
            >
              {busy ? <RefreshCw className="mx-auto h-4 w-4 animate-spin" /> : "SEND NEWSLETTER NOW"}
            </button>
            
            {result && (
              <div className="rounded-lg bg-success-soft p-3 text-center text-[11px] font-bold text-success">
                ✓ Sent to {result.successCount} recipients ({result.failedCount} failed)
              </div>
            )}
          </div>
        </section>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div className="h-[90vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <span className="text-xs font-bold uppercase tracking-widest text-navy">Newsletter Preview</span>
              <button onClick={() => setPreview(false)} className="rounded-full p-2 hover:bg-gray-100">
                <Trash2 className="h-4 w-4 text-navy" />
              </button>
            </div>
            <iframe
              title="Full newsletter preview"
              sandbox=""
              srcDoc={content}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}


/* ---------------------- 3-COLUMN AUTOMATED STUDIO ---------------------- */

type Channel = "status" | "broadcast" | "community";

function statusTextFor(f: Fare): string {
  // WhatsApp Status skeleton — drops the urgent header and signature block.
  const full = buildShareText(f).split("\n");
  const start = full.findIndex((l) => l.includes("*") && !l.includes("URGENT"));
  const end = full.findIndex((l) => l.startsWith(`*${AGENCY_NAME}`));
  const body = full.slice(start < 0 ? 0 : start, end < 0 ? undefined : end).join("\n").trim();
  return `${body}\n\nBook Now: https://wa.me/923056622988`;
}

function communityTextFor(f: Fare): string {
  const full = buildShareText(f).split("\n");
  const end = full.findIndex((l) => l.startsWith(`*${AGENCY_NAME}`));
  const body = full.slice(0, end < 0 ? undefined : end).join("\n").trim();
  return `${body}\n\nBook Now: *${AGENCY_PHONE}*\nPortal Link: *https://rohitravels.com/agent/register*`;
}

function AutomatedStudio({ fares }: { fares: Fare[] }) {
  const genCopy = useServerFn(generateMarketingCopy);
  const genImage = useServerFn(generateMarketingImage);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(fares[0]?.id ?? null);
  const [channel, setChannel] = useState<Channel>("broadcast");
  const [language, setLanguage] = useState<"english" | "urdu" | "roman-urdu" | "mixed">("mixed");
  const [tone, setTone] = useState<"viral" | "premium" | "urgent" | "friendly">("viral");
  const [format, setFormat] = useState<"status" | "square" | "poster">("status");
  const [useAi, setUseAi] = useState(false);
  const [aiCopy, setAiCopy] = useState<MarketingCopy | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "copy" | "image">(null);
  const [error, setError] = useState<string | null>(null);

  const groups = Array.from(new Set(fares.map((f) => (f.group_type || f.category || "").toUpperCase()).filter(Boolean)));
  const list = fares.filter((f) => {
    const g = (f.group_type || f.category || "").toUpperCase();
    if (group !== "all" && g !== group) return false;
    const hay = `${f.origin} ${f.destination} ${f.origin_code} ${f.destination_code} ${f.airline} ${f.flight_date}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });
  const fare = fares.find((f) => f.id === selectedId) ?? null;

  useEffect(() => { setAiCopy(null); setImage(null); setError(null); }, [selectedId]);

  const templateText = fare
    ? channel === "status" ? statusTextFor(fare) : channel === "community" ? communityTextFor(fare) : buildShareText(fare)
    : "";
  const text = useAi && aiCopy ? aiCopy[channel] : templateText;

  function brief(f: Fare) {
    return [
      `Route: ${f.origin} (${f.origin_code}) → ${f.destination} (${f.destination_code})`,
      `Airline: ${f.airline}`,
      `Flight legs:\n${flightLinesFor(f).join("\n")}`,
      `Baggage: ${f.baggage || "20+10 KG"}`,
      f.price_text && !/whatsapp/i.test(f.price_text) ? `Fare: ${f.price_text}` : "Fare: on WhatsApp",
      f.seats ? `Seats left: ${f.seats}` : "",
    ].filter(Boolean).join("\n");
  }

  async function runCopy() {
    if (!fare) return;
    setBusy("copy"); setError(null);
    try { setAiCopy(await genCopy({ data: { prompt: brief(fare), language, tone } })); setUseAi(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not write copy"); }
    finally { setBusy(null); }
  }

  async function runImage() {
    if (!fare) return;
    setBusy("image"); setError(null);
    try {
      const res = await genImage({ data: { prompt: aiCopy?.imagePrompt || brief(fare), format, withText: true } });
      setImage(res.dataUrl);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create poster"); }
    finally { setBusy(null); }
  }

  const field = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40";
  const label = "mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(280px,1fr)_minmax(320px,1.3fr)]">
      {/* Column 1 — live group fares */}
      <section className="flex max-h-[80vh] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="space-y-2 border-b border-border p-4">
          <h2 className="text-sm font-bold text-foreground">1. Pick a group fare <span className="text-muted-foreground">({list.length})</span></h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search route, airline, date" className={`${field} pl-8`} />
          </div>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className={field} aria-label="Group type">
            <option value="all">All groups</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {list.map((f) => {
            const active = f.id === selectedId;
            return (
              <li key={f.id}>
                <button type="button" onClick={() => setSelectedId(f.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? "bg-accent/10 ring-1 ring-inset ring-accent" : "hover:bg-secondary"}`}>
                  <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded border border-border bg-background p-1">
                    <AirlineLogo name={f.airline} height={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold uppercase text-foreground">{f.origin_code} → {f.destination_code}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{f.airline} · {fmtDate(f.flight_date)}{f.seats ? ` · ${f.seats} seats` : ""}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] font-bold text-accent">{/whatsapp/i.test(f.price_text) ? "On request" : f.price_text}</span>
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No fares match.</li>}
        </ul>
      </section>

      {/* Column 2 — automation controls */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-bold text-foreground">2. Automate the post</h2>
        <div>
          <span className={label}>Channel</span>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
            {(["status", "broadcast", "community"] as const).map((c) => (
              <button key={c} type="button" onClick={() => setChannel(c)}
                className={`rounded-md px-2 py-1.5 text-xs font-bold capitalize ${channel === c ? "bg-foreground text-background" : "text-foreground hover:bg-background"}`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label><span className={label}>Language</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} className={field}>
              <option value="mixed">Urdu + English</option><option value="english">English</option>
              <option value="urdu">Urdu</option><option value="roman-urdu">Roman Urdu</option>
            </select>
          </label>
          <label><span className={label}>Tone</span>
            <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className={field}>
              <option value="viral">Viral</option><option value="premium">Premium</option>
              <option value="urgent">Urgent</option><option value="friendly">Friendly</option>
            </select>
          </label>
        </div>
        <label className="block"><span className={label}>Poster size</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as typeof format)} className={field}>
            <option value="status">Status (9:16)</option><option value="square">Square (1:1)</option><option value="poster">Landscape</option>
          </select>
        </label>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <span className="text-xs font-semibold text-foreground">Use AI copy {aiCopy ? "" : "(generate first)"}</span>
          <input type="checkbox" checked={useAi} disabled={!aiCopy} onChange={(e) => setUseAi(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" aria-label="Use AI copy" />
        </div>
        <div className="grid gap-2">
          <button type="button" disabled={!fare || !!busy} onClick={runCopy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50">
            {busy === "copy" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Write AI copy
          </button>
          <button type="button" disabled={!fare || !!busy} onClick={runImage}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-foreground bg-background px-4 text-sm font-bold text-foreground disabled:opacity-50">
            {busy === "image" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Create poster
          </button>
        </div>
        {error && <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}
        {aiCopy?.hashtags && <p className="text-[11px] leading-relaxed text-muted-foreground">{aiCopy.hashtags}</p>}
      </section>

      {/* Column 3 — live preview */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">3. Preview & share</h2>
          {fare && (
            <div className="flex gap-1.5">
              <CopyBtn text={text} />
              <button type="button" onClick={() => openWhatsApp(text)}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-bold uppercase text-accent-foreground">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </button>
            </div>
          )}
        </div>
        {fare ? (
          <>
            <div className="rounded-lg bg-secondary p-3">
              <pre className="max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-background p-3 font-sans text-[13px] leading-relaxed text-foreground shadow-sm">{text}</pre>
            </div>
            {image ? (
              <div className="space-y-2">
                <img src={image} alt={`${fare.origin} to ${fare.destination} poster`} className="w-full rounded-lg border border-border" />
                <button type="button" onClick={() => download(image, `rohi-${slugify(`${fare.origin_code}-${fare.destination_code}-${fare.flight_date}`)}.png`)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background text-xs font-bold text-foreground hover:bg-secondary">
                  <Download className="h-4 w-4" /> Download poster
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Poster preview appears here after “Create poster”.</p>
            )}
          </>
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">Select a fare to preview.</p>
        )}
      </section>
    </div>
  );
}
