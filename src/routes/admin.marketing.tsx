import { createFileRoute, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
      { name: "description", content: "Manage AI campaigns and email marketing for Rohi International Travels." },
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
  serviceId?: string;
  serviceTitle?: string;
  channel?: "status" | "broadcast" | "community";
  language?: "english" | "urdu" | "roman-urdu" | "mixed";
  tone?: "viral" | "premium" | "urgent" | "friendly";
  shareFare?: boolean;
  instructions?: string;
  status?: string;
  broadcast?: string;
  community?: string;
  hashtags?: string;
  imagePrompt?: string;
  fareSnapshot?: Partial<Fare>;
};

function loadSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]") as SavedItem[]; } catch { return []; }
}

function freeCopyForFare(
  f: Fare,
  language: "english" | "urdu" | "roman-urdu" | "mixed",
  tone: "viral" | "premium" | "urgent" | "friendly",
  shareFare: boolean,
): MarketingCopy {
  const route = ((f.origin || f.origin_code) + " → " + (f.destination || f.destination_code)).toUpperCase();
  const airline = (f.airline || "GROUP FARE").toUpperCase();
  const legs = flightLinesFor(f).map((l) => l.toUpperCase());
  const baggage = (f.baggage || "AS LISTED").toUpperCase();
  const fareLine = shareFare && f.price_text && !/whatsapp/i.test(f.price_text)
    ? "FARE: " + formatFareAmount(f.price_text).toUpperCase()
    : "FARE: ON WHATSAPP";
  const opener = tone === "premium"
    ? "✈️ *PREMIUM GROUP FARE — LIMITED SEATS*"
    : tone === "friendly"
      ? "✈️ *TRAVEL SMART WITH ROHI*"
      : tone === "viral"
        ? "🔥 *HOT GROUP FARE ALERT!* 🔥"
        : "🔥 *URGENT GROUP FARE ALERT!* 🔥";
  const urdu = language === "urdu" || language === "mixed";
  const support = urdu ? "📲 *Book Now / WhatsApp for instant assistance*" : "📲 *Book Now for instant assistance*";
  const lines = [
    opener,
    "",
    "🇵🇰 " + route,
    "",
    airline,
    "",
    ...legs,
    "",
    "BAGGAGE: " + baggage,
    fareLine,
    f.seats ? "SEATS: " + String(f.seats) : "",
    "",
    urdu ? "ROHI INTERNATIONAL TRAVELS — WEB & GDS" : "*ROHI INTERNATIONAL TRAVELS*",
    support,
    "*" + AGENCY_PHONE + "*",
    AGENCY_ADDRESS,
  ].filter(Boolean);

  const status = lines.join("\n");
  const broadcast = [
    "🔥 *URGENT SEAT ALERT!* 🔥",
    "",
    route,
    airline,
    ...legs,
    "",
    "Baggage: " + baggage,
    shareFare && f.price_text && !/whatsapp/i.test(f.price_text) ? "Fare: " + formatFareAmount(f.price_text) : "",
    "",
    "*ROHI INTERNATIONAL TRAVELS*",
    "0305 6622988",
    AGENCY_ADDRESS,
  ].filter(Boolean).join("\n");
  const community = [
    "💥 *GROUP FARE UPDATE* 💥",
    "",
    route,
    airline,
    ...legs,
    "",
    "Baggage: " + baggage,
    shareFare && f.price_text && !/whatsapp/i.test(f.price_text) ? "Fare: " + formatFareAmount(f.price_text) : "",
    "",
    "Book Now: *0305 6622988*",
    "Portal: *https://rohitravels.com/agent/register*",
  ].filter(Boolean).join("\n");

  return {
    status,
    broadcast,
    community,
    hashtags: "#RohiInternationalTravels #GroupFare #AirTickets #TravelPakistan #FlightDeals #B2BTravel #AirlineTickets #TravelAgents",
    imagePrompt: [
      "Create a premium ROHI INTERNATIONAL TRAVELS travel poster.",
      "Exact live fare data only.",
      "Route: " + route,
      "Airline: " + airline,
      "Flight details: " + legs.join(" | "),
      "Baggage: " + baggage,
      shareFare ? fareLine : "Do not print any fare amount.",
      f.seats ? "Seats: " + f.seats : "",
      "Agency: " + AGENCY_NAME,
      "Phone: " + AGENCY_PHONE,
      "Office: " + AGENCY_ADDRESS,
      "Use a premium navy/gold travel-agency layout and clear readable typography.",
    ].filter(Boolean).join("\n"),
  };
}

async function dataUrlFromObjectUrl(url: string): Promise<string | undefined> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
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

function posterRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function posterWrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2): string[] {
  const words = text.split(/\\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function posterFitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, start: number, min: number): number {
  let size = start;
  while (size > min) {
    ctx.font = "900 " + size + "px Arial,sans-serif";
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

/**
 * FREE poster: browser-native Canvas only.
 * No html-to-image, no external image service, no AI call, and no cross-origin assets.
 * This makes the image generation deterministic and much more reliable on Chrome/Edge.
 */
async function buildFreePoster(f: Fare, shareFare: boolean): Promise<Blob> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  const route = ((f.origin || f.origin_code) + " → " + (f.destination || f.destination_code)).toUpperCase();
  const airline = (f.airline || "GROUP FARE").toUpperCase();
  const details = flightLinesFor(f).map((x) => x.toUpperCase()).filter(Boolean).slice(0, 3);
  const baggage = (f.baggage || "AS LISTED").toUpperCase();
  const fareLine = shareFare && f.price_text && !/whatsapp/i.test(f.price_text)
    ? formatFareAmount(f.price_text).toUpperCase()
    : "ON WHATSAPP";

  // Premium navy base with a subtle gold radial glow.
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#061A3A");
  bg.addColorStop(0.55, "#0B2A55");
  bg.addColorStop(1, "#031126");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.82, height * 0.14, 20, width * 0.82, height * 0.14, 520);
  glow.addColorStop(0, "rgba(233,196,106,.30)");
  glow.addColorStop(1, "rgba(233,196,106,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Decorative travel/orbit lines.
  ctx.save();
  ctx.strokeStyle = "rgba(233,196,106,.18)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.18, 250, Math.PI * 0.1, Math.PI * 1.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width * 0.82, height * 0.18, 330, Math.PI * 0.18, Math.PI * 1.18);
  ctx.stroke();
  ctx.restore();

  const margin = 64;
  ctx.fillStyle = "#E9C46A";
  ctx.font = "900 34px Arial,sans-serif";
  ctx.fillText("ROHI INTERNATIONAL TRAVELS", margin, 76);
  ctx.fillStyle = "rgba(255,255,255,.62)";
  ctx.font = "700 18px Arial,sans-serif";
  ctx.fillText("GROUP FARE  •  LIVE TRAVEL OFFER", margin, 106);

  // Hero route card.
  posterRoundRect(ctx, margin, 140, width - margin * 2, 250, 34);
  ctx.fillStyle = "rgba(255,255,255,.075)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,.28)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#E9C46A";
  ctx.font = "900 18px Arial,sans-serif";
  ctx.fillText("FLIGHT ROUTE", margin + 30, 178);

  const routeSize = posterFitFont(ctx, route, width - margin * 2 - 60, 72, 42);
  ctx.font = "900 " + routeSize + "px Arial,sans-serif";
  ctx.fillStyle = "#FFFFFF";
  const routeLines = posterWrap(ctx, route, width - margin * 2 - 60, 2);
  let routeY = 250;
  for (const line of routeLines) {
    ctx.fillText(line, margin + 30, routeY);
    routeY += routeSize * 1.08;
  }

  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "800 24px Arial,sans-serif";
  ctx.fillText(airline, margin + 30, 355);

  // Flight details block.
  const detailY = 425;
  posterRoundRect(ctx, margin, detailY, width - margin * 2, 360, 30);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();

  ctx.fillStyle = "#061A3A";
  ctx.font = "900 24px Arial,sans-serif";
  ctx.fillText("FLIGHT DETAILS", margin + 30, detailY + 42);

  let y = detailY + 88;
  ctx.font = "800 25px Arial,sans-serif";
  for (const line of details) {
    posterRoundRect(ctx, margin + 30, y - 28, width - margin * 2 - 60, 58, 16);
    ctx.fillStyle = "#F4F6F9";
    ctx.fill();
    ctx.fillStyle = "#061A3A";
    const lines = posterWrap(ctx, line, width - margin * 2 - 100, 1);
    ctx.fillText(lines[0] || line, margin + 50, y + 10);
    y += 70;
  }

  // Baggage + fare chips.
  const chipY = detailY + 282;
  const chipW = (width - margin * 2 - 90) / 2;
  posterRoundRect(ctx, margin + 30, chipY, chipW, 58, 18);
  ctx.fillStyle = "#E9C46A";
  ctx.fill();
  ctx.fillStyle = "#061A3A";
  ctx.font = "900 20px Arial,sans-serif";
  ctx.fillText("BAGGAGE  " + baggage, margin + 50, chipY + 37);

  posterRoundRect(ctx, margin + 60 + chipW, chipY, chipW, 58, 18);
  ctx.fillStyle = "#061A3A";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,.65)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#E9C46A";
  ctx.font = "900 20px Arial,sans-serif";
  ctx.fillText("FARE  " + fareLine, margin + 80 + chipW, chipY + 37);

  // Strong CTA area.
  const ctaY = 825;
  posterRoundRect(ctx, margin, ctaY, width - margin * 2, 350, 34);
  ctx.fillStyle = "rgba(255,255,255,.055)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#E9C46A";
  ctx.font = "900 22px Arial,sans-serif";
  ctx.fillText("READY TO BOOK?", margin + 32, ctaY + 48);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 44px Arial,sans-serif";
  ctx.fillText("WHATSAPP ROHI", margin + 32, ctaY + 112);
  ctx.font = "800 28px Arial,sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.78)";
  ctx.fillText("Instant booking • Confirmation • Travel assistance", margin + 32, ctaY + 158);

  posterRoundRect(ctx, margin + 32, ctaY + 190, width - margin * 2 - 64, 78, 22);
  ctx.fillStyle = "#E9C46A";
  ctx.fill();
  ctx.fillStyle = "#061A3A";
  ctx.font = "900 34px Arial,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(AGENCY_PHONE, width / 2, ctaY + 240);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(255,255,255,.60)";
  ctx.font = "700 18px Arial,sans-serif";
  const address = AGENCY_ADDRESS;
  ctx.fillText(address, margin + 32, ctaY + 316);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Browser could not export the free poster image."));
    }, "image/png", 1);
  });
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
            ["email", "Email Marketing", Megaphone],
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

/* ---------------------------- FREE COPY / MEDIA STUDIO ---------------------------- */

function GroupFaresStudio({ fares }: { fares: Fare[] }) {
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
      const poster = await buildFreePoster(f, shareFare);
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
      } catch (reelError) {
        setVideo(null);
        const message = reelError instanceof Error ? reelError.message : "Unknown browser recording error.";
        setError("Free image created successfully, but the local reel could not be recorded: " + message);
      }
      setLastGeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the free marketing pack.");
    } finally { setBusy(null); }
  }

  // FREE AUTO BUILD: changing the selected fare rebuilds image + reel locally.
  // No AI/server generation is called, so this never consumes AI credits.
  useEffect(() => {
    setCopy(null);
    setImage(null);
    setVideo(null);
    if (fare) void generateAll(fare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function generateCopyOnly() {
    if (!fare) return;
    setError(null); setBusy("copy");
    try {
      setCopy(freeCopyForFare(fare, language, tone, shareFare));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate free copy.");
    } finally {
      setBusy(null);
    }
  }

  async function regenerateImage() {
    if (!fare) return;
    setError(null); setBusy("image");
    try {
      const poster = await buildFreePoster(fare, shareFare);
      setImage(URL.createObjectURL(poster));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not rebuild the free image.");
    } finally {
      setBusy(null);
    }
  }

  async function saveCurrentCampaign() {
    if (!fare) return;
    const savedImage = image ? await dataUrlFromObjectUrl(image) : undefined;
    const generated = copy || freeCopyForFare(fare, language, tone, shareFare);
    const snapshot: SavedItem = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      title: ((fare.origin || fare.origin_code) + " → " + (fare.destination || fare.destination_code)).toUpperCase() + " · " + (fare.airline || "Group Fare"),
      text: generated.status,
      image: savedImage,
      serviceId: "group-air-tickets",
      serviceTitle: "Group Air Tickets",
      channel: "status",
      language,
      tone,
      shareFare,
      instructions: instructions || defaultInstructions(fare),
      status: generated.status,
      broadcast: generated.broadcast,
      community: generated.community,
      hashtags: generated.hashtags,
      imagePrompt: generated.imagePrompt,
      fareSnapshot: {
        id: fare.id,
        origin: fare.origin,
        destination: fare.destination,
        origin_code: fare.origin_code,
        destination_code: fare.destination_code,
        airline: fare.airline,
        flight_date: fare.flight_date,
        flight_details: fare.flight_details,
        baggage: fare.baggage,
        price_text: fare.price_text,
        seats: fare.seats,
        vendor_fare: fare.vendor_fare,
        vendor_name: fare.vendor_name,
      },
    };
    const existing = loadSaved();
    const next = [snapshot, ...existing.filter((x) => x.id !== snapshot.id)].slice(0, 50);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      setLastGeneratedAt("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next.map((x) => ({ ...x, image: undefined }))));
      setLastGeneratedAt("Saved campaign data");
    }
  }

  const text = fare
    ? (shareFare
      ? (copy?.status?.trim() || displayText(fare))
      : (copy?.status?.trim() || displayText(fare)).replace(/\n?FARE:\s*[^\n]*/gi, ""))
    : "";
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
                <div><span className={label}>Actions</span><div className="grid grid-cols-2 gap-2"><button type="button" disabled={!!busy} onClick={() => { setInstructions(instructions || defaultInstructions(fare)); setInstructionsOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-navy/15 bg-white px-3 text-[10px] font-black uppercase tracking-wide text-navy disabled:opacity-50"><Wand2 className="h-4 w-4" /> Instructions</button><button type="button" disabled={!!busy} onClick={() => void generateAll(fare)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-navy px-3 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-50">{busy === "auto" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {image || video ? "Regenerate Free Pack" : "Generate Free Pack"}</button></div></div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Free Image</p><h3 className="mt-1 text-sm font-black text-navy">FREE local generation</h3></div><button type="button" disabled={!!busy} onClick={() => void regenerateImage()} className="inline-flex items-center gap-1.5 rounded-lg border border-navy/10 px-2.5 py-1.5 text-[10px] font-black uppercase text-navy disabled:opacity-50"><RefreshCw className={"h-3.5 w-3.5 " + (busy === "image" ? "animate-spin" : "")} /> Rebuild Free</button></div>
                  {image ? <img src={image} alt={(fare.origin || "") + " to " + (fare.destination || "") + " group fare"} className="max-h-[440px] w-full rounded-xl border border-navy/10 object-contain bg-secondary/20" /> : <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-navy/15 bg-secondary/20 text-center text-xs text-muted-foreground">Press “Generate Free Pack” to build the image + reel locally.</div>}
                  {image && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => download(image, "rohi-group-fare-" + slugify((fare.origin_code || "") + "-" + (fare.destination_code || "")) + ".png")} className="inline-flex items-center gap-1.5 rounded-lg border border-navy/10 px-3 py-2 text-[10px] font-black uppercase text-navy"><Download className="h-4 w-4" /> Download</button><button type="button" disabled={shareState === "copied" || shareState === "shared"} onClick={async () => { setShareState(null); const result = await shareImageAndCaption(image, text); setShareState(result); setTimeout(() => setShareState(null), 2200); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-[10px] font-black uppercase text-white disabled:opacity-60"><MessageCircle className="h-4 w-4" /> {shareState === "shared" ? "Shared" : shareState === "copied" ? "Image + Caption Copied" : shareState === "text-only" ? "Caption Copied" : "Share Image + Caption"}</button></div>}
                </div>

                <div className="rounded-xl border border-navy/10 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Film className="h-4 w-4 text-gold" /><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Free Reel / Video</p><h3 className="text-sm font-black text-navy">FREE local generation</h3></div></div>{video && <button type="button" onClick={() => download(video, "rohi-group-fare-" + slugify((fare.origin_code || "") + "-" + (fare.destination_code || "")) + "." + videoExt)} className="inline-flex items-center gap-1.5 rounded-lg border border-navy/10 px-3 py-2 text-[10px] font-black uppercase text-navy"><Download className="h-4 w-4" /> Download Video</button>}</div>
                  {video ? <video src={video} controls playsInline className="max-h-[520px] w-full rounded-xl bg-black object-contain" /> : <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-dashed border-navy/15 bg-secondary/20 text-center text-xs text-muted-foreground">Click “Regenerate Free Pack” to rebuild the free image + reel.</div>}
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
              <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Free Instructions</p><h3 className="text-lg font-black text-navy">Customize free marketing instructions</h3></div>
              <button type="button" onClick={() => setInstructionsOpen(false)} className="rounded-lg border border-navy/10 px-3 py-1.5 text-xs font-bold text-navy">Close</button>
            </div>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="h-[360px] w-full rounded-xl border border-navy/15 bg-secondary/20 p-4 font-mono text-xs leading-relaxed text-navy outline-none focus:border-gold" />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setInstructions(defaultInstructions(fare))} className="rounded-xl border border-navy/15 bg-white px-4 py-2 text-xs font-bold text-navy">Reset Default</button>
              <button type="button" onClick={() => { setInstructionsOpen(false); void generateCopyOnly(); }} className="rounded-xl bg-navy px-4 py-2 text-xs font-black uppercase tracking-wide text-white">Save & Generate Free Copy</button>
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
  const [serviceId, setServiceId] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(loadSaved()[0]?.id ?? null);
  const [campaignTitle, setCampaignTitle] = useState("");
  const [serviceItems, setServiceItems] = useState<MarketingService[]>(loadServices());
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingServiceTitle, setEditingServiceTitle] = useState("");
  const [editingServiceDescription, setEditingServiceDescription] = useState("");
  const [language, setLanguage] = useState<"english" | "urdu" | "roman-urdu" | "mixed">("mixed");
  const [tone, setTone] = useState<"viral" | "premium" | "urgent" | "friendly">("urgent");
  const [shareFare, setShareFare] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [textMode, setTextMode] = useState<"status" | "broadcast" | "community">("status");
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [videoExt, setVideoExt] = useState<"mp4" | "webm">("mp4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = loadSaved();
    setItems(next);
    if (!selectedId && next[0]) setSelectedId(next[0].id);
  }, [selectedId]);

  const selected = items.find((x) => x.id === selectedId) ?? null;
  const services = serviceItems;
  const filtered = items.filter((x) => serviceId === "all" || x.serviceId === serviceId);

  function persistServices(next: MarketingService[]) {
    setServiceItems(next);
    window.localStorage.setItem(SERVICE_KEY, JSON.stringify(next));
  }
  function startEditService(s: MarketingService) {
    setEditingServiceId(s.id);
    setEditingServiceTitle(s.title);
    setEditingServiceDescription(s.description);
  }
  function saveServiceEdit() {
    if (!editingServiceId || !editingServiceTitle.trim()) return;
    const next = serviceItems.map((s) => s.id === editingServiceId ? { ...s, title: editingServiceTitle.trim(), description: editingServiceDescription.trim() || s.description } : s);
    persistServices(next);
    const edited = next.find((s) => s.id === editingServiceId);
    if (edited) {
      const updated = items.map((x) => x.serviceId === edited.id ? { ...x, serviceTitle: edited.title } : x);
      setItems(updated);
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
    }
    setEditingServiceId(null);
  }
  function addService() {
    const title = prompt("Service name:");
    if (!title?.trim()) return;
    const description = prompt("Service description:", "Create and manage campaigns for this service.") || "";
    const id = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    persistServices([...serviceItems, { id, title: title.trim(), description: description.trim() }]);
    setServiceId(id);
    setSelectedId(null);
  }
  function deleteService(s: MarketingService) {
    const count = items.filter((x) => x.serviceId === s.id).length;
    if (!confirm(count ? "Delete this service? Its saved campaigns will remain under All Campaigns but will no longer be assigned to this service." : "Delete this service?")) return;
    persistServices(serviceItems.filter((x) => x.id !== s.id));
    if (count) {
      const next = items.map((x) => x.serviceId === s.id ? { ...x, serviceId: undefined, serviceTitle: undefined } : x);
      setItems(next);
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    }
    if (serviceId === s.id) {
      setServiceId("all");
      setSelectedId(items[0]?.id ?? null);
    }
  }

  function openService(id: string) {
    setServiceId(id);
    // Selecting a service opens its WhatsApp Status content in column 2.
    setSelectedId(null);
  }

  function serviceStatusText(service: MarketingService): string {
    return [
      `📢 *${service.title.toUpperCase()}*`,
      "",
      service.description.trim(),
      "",
      "*ROHI INTERNATIONAL TRAVELS*",
      "📲 Book Now / WhatsApp for assistance",
      AGENCY_PHONE,
      AGENCY_ADDRESS,
    ].join(String.fromCharCode(10));
  }

  useEffect(() => {
    if (!selected) return;
    setCampaignTitle(selected.title || "");
    setLanguage(selected.language || "mixed");
    setTone(selected.tone || "urgent");
    setShareFare(Boolean(selected.shareFare));
    setInstructions(selected.instructions || "");
    setTextMode(selected.channel || "status");
    setImage(selected.image || null);
    setVideo(null);
    setError(null);
  }, [selectedId]);

  function currentFare(): Fare | null {
    const s = selected?.fareSnapshot;
    if (!s?.origin && !s?.origin_code) return null;
    return s as Fare;
  }

  function freeCopy() {
    const f = currentFare();
    if (!f) return null;
    return freeCopyForFare(f, language, tone, shareFare);
  }

  const generated = freeCopy();
  const currentText = selected
    ? (textMode === "status" ? (selected.status || selected.text) : textMode === "broadcast" ? (selected.broadcast || selected.text) : (selected.community || selected.text))
    : "";
  const liveText = generated
    ? (textMode === "status" ? generated.status : textMode === "broadcast" ? generated.broadcast : generated.community)
    : currentText;

  async function saveSelectedChanges() {
    if (!selected) return;
    const next = items.map((x) => x.id === selected.id ? {
      ...x,
      title: campaignTitle.trim() || x.title,
      serviceId: x.serviceId || "group-air-tickets",
      serviceTitle: x.serviceTitle || "Group Air Tickets",
      language,
      tone,
      shareFare,
      instructions,
      channel: textMode,
      status: generated?.status || x.status || x.text,
      broadcast: generated?.broadcast || x.broadcast || x.text,
      community: generated?.community || x.community || x.text,
      hashtags: generated?.hashtags || x.hashtags,
      imagePrompt: generated?.imagePrompt || x.imagePrompt,
      text: liveText,
    } : x);
    setItems(next);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }

  async function generateFreeImage() {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      const fare = currentFare();
      if (!fare) throw new Error("This saved campaign has no fare snapshot. Edit/re-save it from Marketing Studio.");
      const blob = await buildFreePoster(fare, shareFare);
      setImage(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the free image.");
    } finally { setBusy(false); }
  }

  async function generateFreeReel() {
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      const fare = currentFare();
      if (!fare) throw new Error("This saved campaign has no fare snapshot. Edit/re-save it from Marketing Studio.");
      let imageUrl = image;
      if (!imageUrl) {
        const blob = await buildFreePoster(fare, shareFare);
        imageUrl = URL.createObjectURL(blob);
        setImage(imageUrl);
      }
      const reel = await buildReel({
        images: [imageUrl],
        headline: (fare.origin_code || fare.origin) + " → " + (fare.destination_code || fare.destination),
        route: (fare.origin || fare.origin_code) + " → " + (fare.destination || fare.destination_code),
        airline: fare.airline || "GROUP FARE",
        flightDetails: flightLinesFor(fare),
        baggage: fare.baggage || undefined,
        fare: shareFare && fare.price_text && !/whatsapp/i.test(fare.price_text) ? formatFareAmount(fare.price_text) : undefined,
        seats: fare.seats ? String(fare.seats) : undefined,
        cta: "WhatsApp ROHI for booking & assistance",
        seconds: 12,
        music: true,
      });
      setVideoExt(reel.ext);
      setVideo(URL.createObjectURL(reel.blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the free reel/video.");
    } finally { setBusy(false); }
  }

  async function generateFreeMedia(savedShareFare?: boolean) {
    const effectiveShareFare = savedShareFare ?? shareFare;
    if (!selected) return;
    setBusy(true); setError(null); setImage(null); setVideo(null);
    try {
      const fare = currentFare();
      if (!fare) throw new Error("This saved campaign has no fare snapshot. Edit/re-save it from Marketing Studio.");
      const blob = await buildFreePoster(fare, effectiveShareFare);
      const imageUrl = URL.createObjectURL(blob);
      setImage(imageUrl);
      const reel = await buildReel({
        images: [imageUrl],
        headline: (fare.origin_code || fare.origin) + " → " + (fare.destination_code || fare.destination),
        route: (fare.origin || fare.origin_code) + " → " + (fare.destination || fare.destination_code),
        airline: fare.airline || "GROUP FARE",
        flightDetails: flightLinesFor(fare),
        baggage: fare.baggage || undefined,
        fare: effectiveShareFare && fare.price_text && !/whatsapp/i.test(fare.price_text) ? formatFareAmount(fare.price_text) : undefined,
        seats: fare.seats ? String(fare.seats) : undefined,
        cta: "WhatsApp ROHI for booking & assistance",
        seconds: 12,
        music: true,
      });
      setVideoExt(reel.ext);
      setVideo(URL.createObjectURL(reel.blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the free media.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (!selected) {
      setImage(null);
      setVideo(null);
      return;
    }
    setCampaignTitle(selected.title);
    setLanguage(selected.language || "mixed");
    setTone(selected.tone || "urgent");
    const savedShareFare = Boolean(selected.shareFare);
    setShareFare(savedShareFare);
    setInstructions(selected.instructions || "");
    setImage(null);
    setVideo(null);
    if (selected.fareSnapshot) void generateFreeMedia(savedShareFare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);


  function removeSelected() {
    if (!selected) return;
    if (!confirm("Delete this saved campaign?")) return;
    const next = items.filter((x) => x.id !== selected.id);
    setItems(next);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSelectedId(next[0]?.id ?? null);
  }

  const field = "w-full rounded-xl border border-navy/10 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-gold";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(250px,0.8fr)_minmax(360px,1.2fr)_minmax(320px,1fr)]">
      <section className="flex max-h-[78vh] flex-col overflow-hidden rounded-2xl border border-navy/10 bg-white shadow-sm">
        <div className="border-b border-navy/10 bg-navy p-4 text-white">
          <div className="flex items-center justify-between"><h2 className="text-sm font-black uppercase tracking-widest">Services</h2><span className="text-[10px] font-bold text-white/60">{items.length} saved</span></div>
          <p className="mt-1 text-[10px] text-white/60">All services + saved campaigns</p>
        </div>
        <div className="border-b border-navy/10 p-2">
          <div className="mb-2 flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
            <div><div className="text-[10px] font-black uppercase tracking-widest text-navy">Services</div><div className="text-[9px] text-muted-foreground">All services + saved campaigns</div></div>
            <button type="button" onClick={addService} className="inline-flex items-center gap-1 rounded-lg bg-navy px-2.5 py-1.5 text-[9px] font-black uppercase text-white"><Plus className="h-3 w-3" /> Add</button>
          </div>
          <button type="button" onClick={() => { setServiceId("all"); if (!selectedId && items[0]) setSelectedId(items[0].id); }} className={"mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-black " + (serviceId === "all" ? "bg-gold/15 text-navy" : "hover:bg-secondary")}>
            <span>All Campaigns</span><span>{items.length} saved</span>
          </button>
          {services.map((s) => {
            const count = items.filter((x) => x.serviceId === s.id).length;
            return editingServiceId === s.id ? (
              <div key={s.id} className="mb-2 rounded-xl border border-gold/40 bg-gold/5 p-2">
                <input value={editingServiceTitle} onChange={(e) => setEditingServiceTitle(e.target.value)} className="mb-1 w-full rounded-lg border border-navy/10 bg-white px-2 py-1.5 text-[10px] font-bold outline-none" />
                <input value={editingServiceDescription} onChange={(e) => setEditingServiceDescription(e.target.value)} className="mb-2 w-full rounded-lg border border-navy/10 bg-white px-2 py-1.5 text-[9px] outline-none" />
                <div className="flex gap-1"><button type="button" onClick={saveServiceEdit} className="flex-1 rounded-md bg-navy px-2 py-1.5 text-[9px] font-black uppercase text-white">Save</button><button type="button" onClick={() => setEditingServiceId(null)} className="rounded-md border px-2 py-1.5 text-[9px] font-black uppercase">Cancel</button></div>
              </div>
            ) : (
              <div key={s.id} className={"mb-1 flex items-center gap-1 rounded-lg px-2 py-1.5 " + (serviceId === s.id ? "bg-gold/15" : "hover:bg-secondary")}>
                <button type="button" onClick={() => openService(s.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs font-black text-navy">{s.title}</span>
                  <span className="block truncate text-[9px] text-muted-foreground">{count} saved · {s.description}</span>
                </button>
                <button type="button" title="Edit service" onClick={() => startEditService(s)} className="rounded-md p-1.5 text-navy/55 hover:bg-white hover:text-navy"><Wand2 className="h-3.5 w-3.5" /></button>
                <button type="button" title="Delete service" onClick={() => deleteService(s)} className="rounded-md p-1.5 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={"mb-2 w-full rounded-xl border p-3 text-left " + (item.id === selectedId ? "border-gold bg-gold/10" : "border-transparent bg-secondary/30 hover:border-navy/10")}>
              <div className="flex items-center justify-between gap-2"><span className="truncate text-[11px] font-black text-navy">{item.title}</span><span className="shrink-0 text-[9px] text-muted-foreground">{fmtDate(item.fareSnapshot?.flight_date || "")}</span></div>
              <div className="mt-1 text-[9px] font-semibold text-muted-foreground">{item.serviceTitle || "Marketing Campaign"} · {new Date(item.createdAt).toLocaleDateString()}</div>
              <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-[10px] text-navy/70">{item.text}</div>
            </button>
          ))}
          {filtered.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">No saved campaigns in this service.</p>}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
        {serviceId !== "all" && !selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-navy/10 pb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">WhatsApp Status</p>
                <h2 className="mt-1 text-base font-black text-navy">{services.find((s) => s.id === serviceId)?.title}</h2>
              </div>
              <CopyBtn text={serviceStatusText(services.find((s) => s.id === serviceId) || { id: "", title: "", description: "" })} label="Copy Status" />
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-secondary/30 p-4 font-sans text-[13px] leading-relaxed text-navy">{serviceStatusText(services.find((s) => s.id === serviceId) || { id: "", title: "", description: "" })}</pre>
          </div>
        ) : selected ? <>
          <div className="flex items-start justify-between gap-3 border-b border-navy/10 pb-3">
            <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{selected.serviceTitle || "Marketing Campaign"}</p><h2 className="mt-1 text-base font-black text-navy">{selected.title}</h2></div>
            <button type="button" onClick={removeSelected} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/20 px-2.5 py-1.5 text-[10px] font-black uppercase text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
          </div>
          <label className="block"><span className="mb-1 block text-[9px] font-black uppercase text-muted-foreground">Campaign Name</span><input value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} className={field} placeholder="Campaign name" /></label>
          <label className="block"><span className="mb-1 block text-[9px] font-black uppercase text-muted-foreground">Service</span><select value={selected.serviceId || "group-air-tickets"} onChange={(e) => {
            const svc = services.find((s) => s.id === e.target.value);
            setItems((prev) => prev.map((x) => x.id === selected.id ? { ...x, serviceId: e.target.value, serviceTitle: svc?.title || e.target.value } : x));
          }} className={field}>{services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="mb-1 block text-[9px] font-black uppercase text-muted-foreground">Tone</span><select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className={field}><option value="urgent">Urgent</option><option value="viral">Viral</option><option value="premium">Premium</option><option value="friendly">Friendly</option></select></label>
            <label><span className="mb-1 block text-[9px] font-black uppercase text-muted-foreground">Language</span><select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} className={field}><option value="mixed">Urdu + English</option><option value="english">English</option><option value="urdu">Urdu</option><option value="roman-urdu">Roman Urdu</option></select></label>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-navy/10 bg-secondary/20 px-3 py-2.5"><input type="checkbox" checked={shareFare} onChange={(e) => setShareFare(e.target.checked)} className="h-4 w-4 accent-navy" /><span><span className="block text-[9px] font-black uppercase text-navy">Enable fare sharing</span><span className="block text-[8px] text-muted-foreground">{shareFare ? "Fare may be included." : "OFF — fare is never shared."}</span></span></label>
          <div>
            <label className="mb-1 block text-[9px] font-black uppercase text-muted-foreground">Instructions</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} className="h-36 w-full rounded-xl border border-navy/10 bg-secondary/20 p-3 font-mono text-[10px] text-navy outline-none focus:border-gold" />
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1">
            {(["status","broadcast","community"] as const).map((m) => <button key={m} type="button" onClick={() => setTextMode(m)} className={"rounded-md px-2 py-2 text-[10px] font-black uppercase " + (textMode === m ? "bg-navy text-white" : "text-navy hover:bg-white")}>{m}</button>)}
          </div>
          <pre className="max-h-[34vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-secondary/30 p-4 font-sans text-[12px] leading-relaxed text-navy">{liveText || "No saved text."}</pre>
          <div className="grid grid-cols-2 gap-2">
            <CopyBtn text={liveText} label="Copy Text" />
            <button type="button" onClick={() => openWhatsApp(liveText)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-3 py-2 text-[10px] font-black uppercase text-white"><MessageCircle className="h-4 w-4" /> WhatsApp Status</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void saveSelectedChanges()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-3 py-2 text-[10px] font-black uppercase text-white"><Save className="h-4 w-4" /> Save Settings</button>
            <button type="button" onClick={() => void generateFreeMedia()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 px-3 py-2 text-[10px] font-black uppercase text-navy disabled:opacity-50">{busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Regenerate Free Pack</button>
          </div>
          {error && <p className="rounded-lg bg-destructive/10 p-2 text-[10px] text-destructive">{error}</p>}
        </> : <div className="flex min-h-[520px] items-center justify-center text-center text-sm text-muted-foreground"><div><Bookmark className="mx-auto h-10 w-10 text-navy/20" /><p className="mt-2">Select a saved campaign from the Services column.</p></div></div>}
      </section>

      <section className="space-y-4 rounded-2xl border border-navy/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saved campaign media</p><h2 className="text-sm font-black text-navy">Free Image + Reel / Video</h2></div>{selected && <div className="flex gap-1"><button type="button" disabled={busy} onClick={() => void generateFreeImage()} className="inline-flex items-center gap-1 rounded-lg border border-navy/10 px-2 py-1.5 text-[9px] font-black uppercase text-navy disabled:opacity-50"><RefreshCw className="h-3 w-3" /> Rebuild Image</button><button type="button" disabled={busy} onClick={() => void generateFreeReel()} className="inline-flex items-center gap-1 rounded-lg border border-navy/10 px-2 py-1.5 text-[9px] font-black uppercase text-navy disabled:opacity-50"><Film className="h-3 w-3" /> Rebuild Reel</button></div>}</div>
        {image ? <img src={image} alt="Saved campaign poster" className="max-h-[430px] w-full rounded-xl border border-navy/10 object-contain bg-secondary/20" /> : <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-navy/15 bg-secondary/20 text-xs text-muted-foreground">Building free image locally…</div>}
        {image && <button type="button" onClick={() => download(image, "rohi-saved-campaign.png")} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-navy/10 px-3 py-2 text-[10px] font-black uppercase text-navy"><Download className="h-4 w-4" /> Download Image</button>}
        {video ? <><video src={video} controls playsInline className="max-h-[460px] w-full rounded-xl bg-black object-contain" /><button type="button" onClick={() => download(video, "rohi-saved-campaign." + videoExt)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-navy/10 px-3 py-2 text-[10px] font-black uppercase text-navy"><Download className="h-4 w-4" /> Download Reel / Video</button></> : <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-navy/15 bg-secondary/20 text-xs text-muted-foreground">Building free reel/video locally…</div>}
      </section>
    </div>
  );
}

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
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-navy">Email Subject</h2>
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

          <div aria-label="Live email preview" className="h-[500px] w-full overflow-y-auto rounded-lg border border-navy/5 bg-gray-50 p-3">
            <div className="min-h-full bg-white" dangerouslySetInnerHTML={{ __html: content || "<p style='padding:24px;font-family:Arial,sans-serif;color:#777'>Start editing the HTML to see a live preview.</p>" }} />
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={handleSend}
              disabled={busy}
              className="w-full rounded-xl bg-gold py-4 text-xs font-black uppercase tracking-widest text-gold-foreground shadow-lg hover:brightness-105 disabled:opacity-50"
            >
              {busy ? <RefreshCw className="mx-auto h-4 w-4 animate-spin" /> : "SEND EMAIL NOW"}
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
              <span className="text-xs font-bold uppercase tracking-widest text-navy">Email Preview</span>
              <button onClick={() => setPreview(false)} className="rounded-full p-2 hover:bg-gray-100">
                <Trash2 className="h-4 w-4 text-navy" />
              </button>
            </div>
            <div className="h-full overflow-y-auto bg-white p-4">
              <div aria-label="Full live email preview" className="min-h-full" dangerouslySetInnerHTML={{ __html: content || "<p style='padding:24px;font-family:Arial,sans-serif;color:#777'>No email content yet.</p>" }} />
            </div>
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
