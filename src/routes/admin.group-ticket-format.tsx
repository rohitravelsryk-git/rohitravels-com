import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, Download, Plus, Trash2, Ticket, Stamp, FileText, Settings, Link2, Pencil, Phone, MessageCircle, Save, RotateCcw, Check, Upload, X } from "lucide-react";
import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { checkAdminUnlocked, listFaresAdmin, listLocations, listAirlines } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import flyadealLogoAsset from "@/assets/flyadeal-logo.png.asset.json";
import salamLogoAsset from "@/assets/salam-air-logo.png.asset.json";
import flydubaiLogoAsset from "@/assets/airlines/flydubai.jpg.asset.json";
import flydubaiFormatAsset from "@/assets/airlines/flydubai-format.png.asset.json";
import defaultLogo from "@/assets/default-logo.png";
import { AdminTabs } from "@/components/AdminTabs";

const DEFAULT_NAME = "ROHI INTERNATIONAL TRAVELS";
const DEFAULT_TAGLINE = "Your's Trust";
const DEFAULT_ADDRESS = "Sardar Market Shahi Road Rahim Yar Khan";
const DEFAULT_PHONE = "0305 6622988";
const DEFAULT_AGENT = "Abdul Razzaq";
const DEFAULT_LOGO = defaultLogo as unknown as string;
const MAPS_URL = "https://www.google.com/maps/place/Rohi+International+Travels";

const PROFILE_STORAGE_KEY = "rohi.printFormat.profile.v1";
type SavedProfile = {
  agencyName: string;
  tagline: string;
  address: string;
  phone: string;
  agent: string;
  logoDataUrl: string;
};
function loadSavedProfile(): SavedProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedProfile;
  } catch { return null; }
}

type BrandProfile = {
  agencyName: string;
  tagline: string;
  address: string;
  phone: string;
  agent: string;
  logoDataUrl: string;
};
function waLink(p: string) {
  const digits = p.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "92" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

/* Scales the fixed-width 794px A4 preview to fit its parent container width,
   without affecting the DOM captured for PDF export. */
function ScaledPreview({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState(1123);
  useEffect(() => {
    if (!wrapRef.current || !innerRef.current) return;
    const compute = () => {
      const cw = wrapRef.current!.clientWidth - 32; // p-4
      const iw = 794;
      const s = Math.min(1, cw / iw);
      setScale(s);
      const ih = innerRef.current!.getBoundingClientRect().height / (scale || 1);
      setH(ih * s + 32);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrapRef.current);
    ro.observe(innerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={wrapRef} className="bg-background p-4" style={{ height: h }}>
      <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 794 }}>
        {children}
      </div>
    </div>
  );
}

function BrandHeader({ profile, qrDataUrl }: { profile: BrandProfile; qrDataUrl: string }) {
  const name = profile.agencyName.trim() || DEFAULT_NAME;
  const tagline = profile.tagline.trim() || (profile.agencyName.trim() ? "" : DEFAULT_TAGLINE);
  const address = profile.address.trim() || (profile.agencyName.trim() ? "" : DEFAULT_ADDRESS);
  const phone = profile.phone.trim() || DEFAULT_PHONE;
  const logo = profile.logoDataUrl || DEFAULT_LOGO;
  return (
    <div className="mx-6 mt-6 flex items-center justify-between gap-6 border-b-4 border-double border-navy pb-4">
      <div className="flex min-w-0 items-center gap-3">
        {logo && <img src={logo} alt="Agency logo" crossOrigin="anonymous" className="h-20 w-20 shrink-0 object-contain" />}
        <div className="min-w-0">
          <p className="font-serif text-xl font-black leading-tight text-navy">{name}</p>
          {tagline && <p className="mt-0.5 text-[10px] font-bold tracking-[0.25em] text-muted-foreground">{tagline}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right text-navy">
          <a
            href={waLink(phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 whitespace-nowrap text-[18px] font-extrabold leading-none tracking-tight no-underline hover:opacity-80"
          >
            <span className="inline-flex items-center gap-1">
              <Phone className="h-4 w-4" style={{ color: "#25D366" }} fill="#25D366" />
              <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} fill="#25D366" />
            </span>
            <span className="whitespace-nowrap">{phone}</span>
          </a>
          {profile.agent.trim() && (
            <p className="mt-1.5 text-[11px] font-semibold text-navy">
              <span className="text-muted-foreground">Travel Arranger:</span>{" "}
              <span className="font-black">{profile.agent.trim()}</span>
            </p>
          )}
          {address && <p className="mt-1 text-[10px] font-semibold text-muted-foreground">{address}</p>}
        </div>
        {qrDataUrl && (
          <a
            href={waLink(phone)}
            target="_blank"
            rel="noopener noreferrer"
            title="Scan or click to chat on WhatsApp"
            className="group shrink-0 rounded-md border border-gold/60 bg-white p-1 shadow-sm no-underline hover:border-gold hover:shadow-md"
          >
            <img src={qrDataUrl} alt="WhatsApp QR" className="h-[72px] w-[72px] [image-rendering:pixelated]" />
          </a>
        )}
      </div>
    </div>
  );
}

function StampBar() {
  return (
    <div className="mx-6 mt-3 flex items-center justify-center">
      <div className="relative inline-flex items-center gap-3 px-6 py-2 text-red-600">
        <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-[2.5px] border-t-[2.5px] border-red-600" />
        <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-[2.5px] border-t-[2.5px] border-red-600" />
        <span className="pointer-events-none absolute left-0 bottom-0 h-3 w-3 border-l-[2.5px] border-b-[2.5px] border-red-600" />
        <span className="pointer-events-none absolute right-0 bottom-0 h-3 w-3 border-r-[2.5px] border-b-[2.5px] border-red-600" />
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-[2px] border-red-600">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16z" />
          </svg>
        </div>
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[15px] font-black tracking-[0.14em]">GROUP TICKET</span>
          <span className="my-0.5 h-[1.5px] w-full bg-red-600" />
          <span className="text-[10px] font-black tracking-[0.18em]">NON REFUNDABLE</span>
          <span className="text-[10px] font-black tracking-[0.18em]">NON CHANGEABLE</span>
        </div>
      </div>
    </div>
  );
}

function BrandFooter({ profile }: { profile: BrandProfile }) {
  const name = profile.agencyName.trim() || DEFAULT_NAME;
  const address = profile.address.trim() || (profile.agencyName.trim() ? "" : DEFAULT_ADDRESS);
  const phone = profile.phone.trim() || DEFAULT_PHONE;
  return (
    <div className="mx-6 mt-4 mb-6 border-t-2 border-navy pt-2 text-center text-[10px] font-semibold tracking-widest text-navy">
      <p>
        {name}
        {address ? (
          <>
            {` · `}
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="no-underline hover:text-gold">
              {address}
            </a>
          </>
        ) : null}
        {` · `}
        <a href={waLink(phone)} target="_blank" rel="noopener noreferrer" className="font-black no-underline hover:text-gold">
          {phone}
        </a>
      </p>
      <p className="mt-0.5 text-muted-foreground">Thank you for booking with us — Have Safe Journey!</p>
    </div>
  );
}



/* ---------------- Parsing / date helpers ---------------- */

type Segment = {
  flightNo: string;
  dateRaw: string;   // e.g. "17 AUG"
  origin: string;    // IATA
  destination: string;
  dep: string;       // HHMM
  arr: string;       // HHMM
};

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, SEPT: 8, OCT: 9, NOV: 10, DEC: 11,
};

/* IATA → { full airport name, city } — used to auto-populate airport fields
   when the user (or a linked group fare) provides a 3-letter code. */
const AIRPORTS: Record<string, { name: string; city: string }> = {
  KHI: { name: "Jinnah International Airport", city: "Karachi" },
  LHE: { name: "Allama Iqbal International Airport", city: "Lahore" },
  ISB: { name: "Islamabad International Airport", city: "Islamabad" },
  MUX: { name: "Multan International Airport", city: "Multan" },
  PEW: { name: "Bacha Khan International Airport", city: "Peshawar" },
  SKT: { name: "Sialkot International Airport", city: "Sialkot" },
  UET: { name: "Quetta International Airport", city: "Quetta" },
  FSD: { name: "Faisalabad International Airport", city: "Faisalabad" },
  JED: { name: "King Abdulaziz International Airport", city: "Jeddah" },
  MED: { name: "Prince Mohammad bin Abdulaziz International Airport", city: "Madinah" },
  RUH: { name: "King Khalid International Airport", city: "Riyadh" },
  DMM: { name: "King Fahd International Airport", city: "Dammam" },
  AHB: { name: "Abha International Airport", city: "Abha" },
  TUU: { name: "Tabuk Regional Airport", city: "Tabuk" },
  YNB: { name: "Prince Abdul Mohsin bin Abdulaziz Airport", city: "Yanbu" },
  DXB: { name: "Dubai International Airport", city: "Dubai" },
  DWC: { name: "Al Maktoum International Airport", city: "Dubai" },
  AUH: { name: "Zayed International Airport", city: "Abu Dhabi" },
  SHJ: { name: "Sharjah International Airport", city: "Sharjah" },
  MCT: { name: "Muscat International Airport", city: "Muscat" },
  SLL: { name: "Salalah Airport", city: "Salalah" },
  DOH: { name: "Hamad International Airport", city: "Doha" },
  BAH: { name: "Bahrain International Airport", city: "Bahrain" },
  KWI: { name: "Kuwait International Airport", city: "Kuwait" },
  IST: { name: "Istanbul Airport", city: "Istanbul" },
  SAW: { name: "Sabiha Gökçen International Airport", city: "Istanbul" },
  CAI: { name: "Cairo International Airport", city: "Cairo" },
  KUL: { name: "Kuala Lumpur International Airport", city: "Kuala Lumpur" },
  BKK: { name: "Suvarnabhumi Airport", city: "Bangkok" },
};
function airportName(code: string) { return AIRPORTS[code.toUpperCase()]?.name ?? ""; }
function airportCity(code: string) { return AIRPORTS[code.toUpperCase()]?.city ?? ""; }


// Line examples:
//   "17 AUG KHI MCT 0640 0730"
//   "FZ-330 28 JUL KHI DXB 2355 0110"
export function parseSegments(text: string | null | undefined): Segment[] {
  if (!text) return [];
  const re = /^\s*(?:([A-Z0-9][A-Z0-9-]{1,7})\s+)?(\d{1,2})\s+([A-Z]{3,4})\s+([A-Z]{3})\s+([A-Z]{3})\s+(\d{3,4})\s+(\d{3,4})/;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const m = line.toUpperCase().match(re);
      if (!m) return null;
      const [, flightNo, day, mon, o, d, dep, arr] = m;
      return {
        flightNo: flightNo ?? "",
        dateRaw: `${day.padStart(2, "0")} ${mon}`,
        origin: o,
        destination: d,
        dep: dep.padStart(4, "0"),
        arr: arr.padStart(4, "0"),
      } as Segment;
    })
    .filter((s): s is Segment => Boolean(s));
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt4to24(hhmm: string) {
  if (!/^\d{3,4}$/.test(hhmm)) return hhmm;
  const s = hhmm.padStart(4, "0");
  return `${s.slice(0, 2)}:${s.slice(2)}`;
}
function fmt24toAmPm(hhmm: string) {
  const m = hhmm.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return hhmm;
  let h = Number(m[1]); const mm = m[2];
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (h === 0) h = 12;
  return `${pad(h)}:${mm}${ap}`;
}
function computeDuration(dep: string, arr: string) {
  const d = dep.match(/^(\d{1,2}):?(\d{2})/);
  const a = arr.match(/^(\d{1,2}):?(\d{2})/);
  if (!d || !a) return "";
  let mins = (Number(a[1]) * 60 + Number(a[2])) - (Number(d[1]) * 60 + Number(d[2]));
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} hrs ${m} mins` : `${h} hrs`;
}
function formatDuration(totalMins: number) {
  const h = Math.floor(totalMins / 60), m = totalMins % 60;
  return m ? `${h} hrs ${m} mins` : `${h} hrs`;
}
function toMinutes(t: string): number | null {
  const m = t.trim().match(/^(\d{1,2}):?(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]); const mm = Number(m[2]); const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + mm;
}
function computeDurationBetween(dep: string, arr: string) {
  const d = toMinutes(dep), a = toMinutes(arr);
  if (d == null || a == null) return computeDuration(dep, arr);
  let mins = a - d;
  if (mins < 0) mins += 24 * 60;
  return formatDuration(mins);
}
function fromMinutes(total: number, ampm: boolean) {
  const norm = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60), m = norm % 60;
  const raw = `${pad(h)}:${pad(m)}`;
  return ampm ? fmt24toAmPm(raw) : raw;
}
function addMinutes(t: string, add: number) {
  const mm = toMinutes(t); if (mm == null) return "";
  return fromMinutes(mm + add, /AM|PM/i.test(t));
}
function connectionMins(arr: string, dep: string): number | null {
  const a = toMinutes(arr), d = toMinutes(dep);
  if (a == null || d == null) return null;
  let x = d - a; if (x < 0) x += 1440;
  return x;
}
function layoverLabel(arr: string, dep: string) {
  const m = connectionMins(arr, dep);
  if (m == null) return "";
  const h = Math.floor(m / 60), mm = m % 60;
  return mm ? `${h}h ${mm}m layover` : `${h}h layover`;
}
function dateFromISO(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}
function formatWeekdayHeader(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" }).toUpperCase();
}
const MONTH_NAMES: Record<string, number> = {
  JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
  JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11,
};
function parseLongDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const mon = MONTH_NAMES[m[2].toUpperCase()];
  if (mon === undefined) return null;
  return new Date(Number(m[3]), mon, Number(m[1]));
}
function addDays(d: Date, n: number) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function deriveLeg2DepartureDate(baseDate: string, leg1Dep: string, leg1Arr: string, leg2Dep: string): Date | null {
  const base = parseLongDate(baseDate);
  if (!base) return null;
  const dep1 = toMinutes(leg1Dep), arr1 = toMinutes(leg1Arr), dep2 = toMinutes(leg2Dep);
  if (arr1 == null || dep2 == null) return base;
  const leg1ArrDayOffset = dep1 != null && arr1 < dep1 ? 1 : 0;
  const leg2DayOffset = leg1ArrDayOffset + (dep2 < arr1 ? 1 : 0);
  return addDays(base, leg2DayOffset);
}

function inferYear(monthIdx: number) {
  const now = new Date();
  const y = now.getFullYear();
  // If month already passed this year, assume next year
  if (monthIdx < now.getMonth() - 1) return y + 1;
  return y;
}
function dateFromSegment(dateRaw: string): Date | null {
  const m = dateRaw.match(/^(\d{1,2})\s+([A-Z]{3,4})$/);
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return null;
  return new Date(inferYear(mon), mon, Number(m[1]));
}

/* Fetch external/CDN logo as a data URL so html-to-image can embed it in
   the PDF and the <img> can render without CORS issues. Falls back to the
   raw URL if fetching fails. */
const LOGO_CACHE = new Map<string, string>();
function useLogoDataUrl(url: string): string {
  const [d, setD] = useState<string>(() => LOGO_CACHE.get(url) ?? "");
  useEffect(() => {
    if (!url) { setD(""); return; }
    const cached = LOGO_CACHE.get(url);
    if (cached) { setD(cached); return; }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(url, { mode: "cors", cache: "force-cache" });
        if (!r.ok) throw new Error("bad status");
        const b = await r.blob();
        const dataUrl: string = await new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onloadend = () => res(String(fr.result || ""));
          fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(b);
        });
        LOGO_CACHE.set(url, dataUrl);
        if (alive) setD(dataUrl);
      } catch {
        if (alive) setD(url);
      }
    })();
    return () => { alive = false; };
  }, [url]);
  return d || url;
}

export const Route = createFileRoute("/admin/group-ticket-format")({
  component: Page,
});

/* -------------------------------------------------------------
   Template registry — built-in airlines + user-defined "custom"
   ------------------------------------------------------------- */

type TemplateStyle = "flyadeal" | "salam" | "flydubai" | "flyjinnah" | "generic" | "custom-pdf";

type AirlineTemplate = {
  id: string;
  name: string;
  iata?: string;      // used to auto-fetch a logo when logoUrl is blank
  logoUrl: string;
  primary: string;   // brand primary
  accent: string;    // secondary accent
  ink: string;       // ticket ink/text
  style: TemplateStyle;
  builtIn?: boolean;
  /** For style="custom-pdf": data URL of the official ticket background
   *  (PDF page 1 rendered to PNG, or an uploaded image). */
  backgroundUrl?: string;
};


const BUILT_IN: AirlineTemplate[] = [
  {
    id: "flyadeal",
    name: "Flyadeal",
    iata: "F3",
    logoUrl: flyadealLogoAsset.url,
    primary: "#4B1E78",
    accent: "#F4E400",
    ink: "#1a1a1a",
    style: "flyadeal",
    builtIn: true,
  },
  {
    id: "salam",
    name: "SalamAir",
    iata: "OV",
    logoUrl: salamLogoAsset.url,
    primary: "#8BC53F",
    accent: "#6BA82F",
    ink: "#1a1a1a",
    style: "salam",
    builtIn: true,
  },
  {
    id: "flydubai",
    name: "Flydubai",
    iata: "FZ",
    logoUrl: flydubaiLogoAsset.url,
    primary: "#002F5F",
    accent: "#F58220",
    ink: "#1a1a1a",
    style: "flydubai",

    builtIn: true,
  },
  {
    id: "flyjinnah",
    name: "Fly Jinnah",
    iata: "9P",
    logoUrl: "",
    primary: "#E4187C",
    accent: "#B01566",
    ink: "#1a1a1a",
    style: "flyjinnah",
    builtIn: true,
  },
];

/** Resolve the best logo for a template: explicit URL wins, else auto-fetch
 *  the official airline logo from the avs.io CDN using the IATA code. */
export function logoFor(t: AirlineTemplate): string {
  if (t.logoUrl && t.logoUrl.trim()) return t.logoUrl.trim();
  if (t.iata && t.iata.trim())
    return `https://pics.avs.io/200/50/${t.iata.trim().toUpperCase()}.png`;
  return "";
}

const STORAGE_KEY = "rohi.ticket.customAirlines.v1";
const OVERRIDES_KEY = "rohi.ticket.builtinOverrides.v1";

type Overrides = Record<string, Partial<AirlineTemplate>>;

function loadCustom(): AirlineTemplate[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? (JSON.parse(raw) as AirlineTemplate[]) : [];
  } catch {
    return [];
  }
}
function saveCustom(list: AirlineTemplate[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}
function loadOverrides(): Overrides {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(OVERRIDES_KEY) : null;
    return raw ? (JSON.parse(raw) as Overrides) : {};
  } catch { return {}; }
}
function saveOverrides(o: Overrides) {
  try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o)); } catch {}
}

/* ---------------- Form model ---------------- */

type Pax = {
  name: string;
  ticketNo: string;
  seat: string;
  bag: string;
  meal: string;
  others: string;
};

type Form = {
  bookingRef: string;
  eTicket: string;
  originCode: string;
  originCity: string;
  originAirport: string;
  destCode: string;
  destCity: string;
  destAirport: string;
  flightNo: string;
  date: string;
  weekday: string;
  depTime: string;
  arrTime: string;
  duration: string;
  stops: string;
  fareType: string;
  passengers: Pax[];
  // Optional second connecting leg (e.g. KHI-MCT then MCT-JED)
  hasConnection: boolean;
  c2OriginCode: string;
  c2OriginCity: string;
  c2OriginAirport: string;
  c2DestCode: string;
  c2DestCity: string;
  c2DestAirport: string;
  c2FlightNo: string;
  c2DepTime: string;
  c2ArrTime: string;
  c2Duration: string;
  c2Date: string;
  c2Weekday: string;
};

const emptyConnection = () => ({
  hasConnection: false,
  c2OriginCode: "", c2OriginCity: "", c2OriginAirport: "",
  c2DestCode: "", c2DestCity: "", c2DestAirport: "",
  c2FlightNo: "", c2DepTime: "", c2ArrTime: "", c2Duration: "",
  c2Date: "", c2Weekday: "",
});


const emptyPax = (): Pax => ({ name: "", ticketNo: "", seat: "None", bag: "", meal: "None", others: "" });

function defaultsFor(_t: AirlineTemplate): Form {
  // Blank slate on load / template switch — fields fill via "Link with Group Fare"
  // or manual entry.
  return {
    bookingRef: "", eTicket: "",
    originCode: "", originCity: "", originAirport: "",
    destCode: "", destCity: "", destAirport: "",
    flightNo: "", date: "", weekday: "",
    depTime: "", arrTime: "", duration: "",
    stops: "", fareType: "",
    passengers: [emptyPax()],
    ...emptyConnection(),
  };
}


/* ---------------- Page ---------------- */

function Page() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });
  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!status?.unlocked)
    return (
      <div className="p-10 text-center">
        <p className="mb-4">Admin sign-in required.</p>
        <Link to="/admin" className="rounded-md bg-gold px-4 py-2 text-sm font-bold text-gold-foreground">Go to Admin</Link>
      </div>
    );
  return <Editor />;
}

function Editor() {
  const [custom, setCustom] = useState<AirlineTemplate[]>([]);
  const [overrides, setOverrides] = useState<Overrides>({});
  useEffect(() => { setCustom(loadCustom()); setOverrides(loadOverrides()); }, []);
  // Pull latest airline logos from the admin airlines table so link updates
  // there flow through to templates automatically (no manual re-sync needed).
  const { data: dbAirlines } = useQuery({
    queryKey: ["airlines", "for-templates"],
    queryFn: () => listAirlines(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const templates = useMemo(() => {
    const dbByIata = new Map<string, string>();
    const dbByName = new Map<string, string>();
    for (const a of dbAirlines ?? []) {
      if (!a.logo_url) continue;
      if (a.iata_code) dbByIata.set(a.iata_code.toUpperCase(), a.logo_url);
      if (a.name) dbByName.set(a.name.trim().toLowerCase(), a.logo_url);
    }
    const applyDbLogo = (t: AirlineTemplate): AirlineTemplate => {
      const fromDb =
        (t.iata && dbByIata.get(t.iata.toUpperCase())) ||
        dbByName.get(t.name.trim().toLowerCase()) ||
        "";
      return fromDb ? { ...t, logoUrl: fromDb } : t;
    };
    const built = BUILT_IN.map((t) => {
      const ov = { ...(overrides[t.id] ?? {}) };
      // Never let a stale override change a built-in template's core layout
      // style or its uploaded-format background — those are code-owned.
      delete (ov as Partial<AirlineTemplate>).style;
      delete (ov as Partial<AirlineTemplate>).backgroundUrl;
      return applyDbLogo({ ...t, ...ov } as AirlineTemplate);
    });
    const cust = custom.map(applyDbLogo);
    return [...built, ...cust];
  }, [custom, overrides, dbAirlines]);

  const [airlineId, setAirlineId] = useState<string>("flyadeal");
  const airline = templates.find((t) => t.id === airlineId) ?? templates[0];

  const [form, setForm] = useState<Form>(defaultsFor(BUILT_IN[0]));
  const [busy, setBusy] = useState(false);
  const [noBrand, setNoBrand] = useState(false);
  const [agencyName, setAgencyName] = useState<string>(DEFAULT_NAME);
  const [tagline, setTagline] = useState<string>(DEFAULT_TAGLINE);
  const [address, setAddress] = useState<string>(DEFAULT_ADDRESS);
  const [phone, setPhone] = useState<string>(DEFAULT_PHONE);
  const [agent, setAgent] = useState<string>(DEFAULT_AGENT);
  const [logoDataUrl, setLogoDataUrl] = useState<string>(DEFAULT_LOGO);
  const [hasSavedProfile, setHasSavedProfile] = useState<boolean>(false);
  const [savedFlash, setSavedFlash] = useState<boolean>(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const brandProfile: BrandProfile = { agencyName, tagline, address, phone, agent, logoDataUrl };

  useEffect(() => {
    const p = loadSavedProfile();
    if (!p) return;
    setAgencyName(p.agencyName ?? DEFAULT_NAME);
    setTagline(p.tagline ?? DEFAULT_TAGLINE);
    setAddress(p.address ?? DEFAULT_ADDRESS);
    setPhone(p.phone ?? DEFAULT_PHONE);
    setAgent(p.agent ?? DEFAULT_AGENT);
    setLogoDataUrl(p.logoDataUrl ?? DEFAULT_LOGO);
    setHasSavedProfile(true);
  }, []);

  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(waLink(phone || DEFAULT_PHONE), { margin: 1, width: 240, color: { dark: "#0B1F3A", light: "#FFFFFF" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [phone]);

  function saveProfileAsDefault() {
    const profile: SavedProfile = { agencyName, tagline, address, phone, agent, logoDataUrl };
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      setHasSavedProfile(true);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
    } catch {
      alert("Couldn't save profile — your browser storage may be full or blocked.");
    }
  }
  function resetSavedDefaults() {
    try { window.localStorage.removeItem(PROFILE_STORAGE_KEY); } catch { /* noop */ }
    setHasSavedProfile(false);
    setAgencyName(DEFAULT_NAME);
    setTagline(DEFAULT_TAGLINE);
    setAddress(DEFAULT_ADDRESS);
    setPhone(DEFAULT_PHONE);
    setAgent(DEFAULT_AGENT);
    setLogoDataUrl(DEFAULT_LOGO);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }
  async function onLogoFile(f: File | undefined | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Please upload an image file for the logo."); return; }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });
    setLogoDataUrl(dataUrl);
  }


  /* Auto-derive connection date/weekday/dep-time and stops so the user
     doesn't have to type them. Runs whenever the leg-1 date, arrival time
     or the connection toggle changes. */
  const { hasConnection, date, weekday, arrTime, stops, c2Date, c2Weekday, c2DepTime } = form;
  useEffect(() => {
    setForm((f) => {
      const patch: Partial<Form> = {};
      const desiredStops = f.hasConnection ? "1 stop" : "Non-stop";
      const stopsIsAuto = f.stops === "" || f.stops === "Non-stop" || /^\d+\s+stops?$/i.test(f.stops);
      if (stopsIsAuto && f.stops !== desiredStops) patch.stops = desiredStops;
      // Auto-fill weekday header from leg-1 date whenever the parsed date changes
      const leg1Date = parseLongDate(f.date);
      if (leg1Date) {
        const wanted = formatWeekdayHeader(leg1Date);
        if (f.weekday !== wanted) patch.weekday = wanted;
      }
      if (f.hasConnection) {
        const leg1ArrMin = toMinutes(f.arrTime);
        const c2Dep = f.c2DepTime || (f.arrTime ? addMinutes(f.arrTime, 90) : "");
        if (!f.c2DepTime && c2Dep) patch.c2DepTime = c2Dep;
        const d2 = deriveLeg2DepartureDate(f.date, f.depTime, f.arrTime, c2Dep);
        if (leg1Date && leg1ArrMin != null && d2) {
          const nd = formatLongDate(d2);
          const nw = formatWeekdayHeader(d2);
          if (!f.c2Date || f.c2Date === f.date) patch.c2Date = nd;
          if (!f.c2Weekday || f.c2Weekday === f.weekday || f.c2Weekday === patch.weekday) patch.c2Weekday = nw;
        } else {
          if (!f.c2Date && f.date) patch.c2Date = f.date;
          if (!f.c2Weekday && f.weekday) patch.c2Weekday = f.weekday;
        }
        // Derive weekday from manually-typed c2Date
        const c2ParsedDate = parseLongDate(patch.c2Date ?? f.c2Date);
        if (c2ParsedDate) {
          const wantedC2 = formatWeekdayHeader(c2ParsedDate);
          const currentC2 = patch.c2Weekday ?? f.c2Weekday;
          if (currentC2 !== wantedC2) patch.c2Weekday = wantedC2;
        }
      }
      return Object.keys(patch).length ? { ...f, ...patch } : f;
    });
  }, [hasConnection, date, weekday, arrTime, stops, c2Date, c2Weekday, c2DepTime]);



  const [editing, setEditing] = useState<AirlineTemplate | "new" | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Link with existing group fares
  const { data: fares = [] } = useQuery({ queryKey: ["admin", "faresAll"], queryFn: () => listFaresAdmin() });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const cityByCode = useMemo(() => {
    const m = new Map<string, string>();
    locations.forEach((l) => m.set(l.code.toUpperCase(), l.city));
    return m;
  }, [locations]);

  const [fareId, setFareId] = useState<string>("");
  const [segIdx, setSegIdx] = useState<number>(0);
  const selectedFare = fares.find((f) => f.id === fareId);
  const segments = useMemo(
    () => (selectedFare ? parseSegments(selectedFare.flight_details) : []),
    [selectedFare],
  );

  function applyFareSegment(fare: typeof selectedFare, idx: number) {
    if (!fare) return;
    const segs = parseSegments(fare.flight_details);
    const s = segs[idx];
    if (!s) return;
    const d = dateFromSegment(s.dateRaw);
    const dep24 = fmt4to24(s.dep);
    const arr24 = fmt4to24(s.arr);
    const originCity = airportCity(s.origin) || cityByCode.get(s.origin) || fare.origin || "";
    const destCity = airportCity(s.destination) || cityByCode.get(s.destination) || fare.destination || "";
    const bag = (fare.baggage || "").trim();
    setForm((f) => syncLegs({
      ...f,
      ...emptyConnection(),
      hasConnection: false,
      originCode: s.origin,
      destCode: s.destination,
      originCity,
      destCity,
      originAirport: airportName(s.origin) || f.originAirport,
      destAirport: airportName(s.destination) || f.destAirport,
      flightNo: s.flightNo || f.flightNo,
      date: d ? formatLongDate(d) : f.date,
      weekday: d ? formatWeekdayHeader(d) : f.weekday,
      depTime: airline.style === "flyadeal" ? fmt24toAmPm(dep24) : dep24,
      arrTime: airline.style === "flyadeal" ? fmt24toAmPm(arr24) : arr24,
      duration: computeDurationBetween(dep24, arr24) || f.duration,
      stops: "Non-stop",
      passengers: bag ? f.passengers.map((p) => ({ ...p, bag })) : f.passengers,
    } as Form));
  }




  // Fill leg 1 from segments[0] and leg 2 (connection) from segments[1].
  function applyAllSegments(fare: typeof selectedFare) {
    if (!fare) return;
    const segs = parseSegments(fare.flight_details);
    if (segs.length === 0) return;
    const [s1, s2] = segs;
    const d1 = dateFromSegment(s1.dateRaw);
    const dep1 = fmt4to24(s1.dep), arr1 = fmt4to24(s1.arr);
    const isFly = airline.style === "flyadeal";
    const bag = (fare.baggage || "").trim();
    setForm((f) => {
      const base: Form = {
        ...f,
        passengers: bag ? f.passengers.map((p) => ({ ...p, bag })) : f.passengers,
        originCode: s1.origin,
        destCode: s1.destination,
        originCity: airportCity(s1.origin) || cityByCode.get(s1.origin) || fare.origin || "",
        destCity: airportCity(s1.destination) || cityByCode.get(s1.destination) || "",
        originAirport: airportName(s1.origin) || f.originAirport,
        destAirport: airportName(s1.destination) || f.destAirport,
        flightNo: s1.flightNo || f.flightNo,
        date: d1 ? formatLongDate(d1) : f.date,
        weekday: d1 ? formatWeekdayHeader(d1) : f.weekday,
        depTime: isFly ? fmt24toAmPm(dep1) : dep1,
        arrTime: isFly ? fmt24toAmPm(arr1) : arr1,
        duration: computeDurationBetween(dep1, arr1) || f.duration,
      };
      if (!s2) return syncLegs({ ...base, ...emptyConnection() });
      const d2 = dateFromSegment(s2.dateRaw);
      const dep2 = fmt4to24(s2.dep), arr2 = fmt4to24(s2.arr);
      return syncLegs({
        ...base,
        // Leg 1 keeps its own destination (the connection point); leg 2 carries the final destination.
        hasConnection: true,

        c2OriginCode: s2.origin,
        c2DestCode: s2.destination,
        c2OriginCity: airportCity(s2.origin) || cityByCode.get(s2.origin) || "",
        c2DestCity: airportCity(s2.destination) || cityByCode.get(s2.destination) || "",
        c2OriginAirport: airportName(s2.origin),
        c2DestAirport: airportName(s2.destination),
        c2FlightNo: s2.flightNo,
        c2DepTime: isFly ? fmt24toAmPm(dep2) : dep2,
        c2ArrTime: isFly ? fmt24toAmPm(arr2) : arr2,
        c2Duration: computeDurationBetween(dep2, arr2),
        c2Date: d2 ? formatLongDate(d2) : "",
        c2Weekday: d2 ? formatWeekdayHeader(d2) : "",
      });
    });
  }

  // When user types/edits a code, auto-fill matching city & airport if known.
  function updateCode(field: "originCode" | "destCode" | "c2OriginCode" | "c2DestCode", raw: string) {
    const v = raw.toUpperCase();
    const meta = AIRPORTS[v];
    setForm((f) => {
      const patch: Partial<Form> = { [field]: v } as Partial<Form>;
      if (meta) {
        if (field === "originCode") { patch.originCity = meta.city; patch.originAirport = meta.name; }
        if (field === "destCode") { patch.destCity = meta.city; patch.destAirport = meta.name; }
        if (field === "c2OriginCode") { patch.c2OriginCity = meta.city; patch.c2OriginAirport = meta.name; }
        if (field === "c2DestCode") { patch.c2DestCity = meta.city; patch.c2DestAirport = meta.name; }
      }
      return { ...f, ...patch };
    });
  }


  // Date picker → auto-fill formatted date + weekday
  function pickDate(iso: string) {
    const d = dateFromISO(iso);
    if (!d) return;
    setForm((f) => ({ ...f, date: formatLongDate(d), weekday: formatWeekdayHeader(d) }));
  }
  // Shared for every airline template (built-in + custom): whenever any leg
  // time changes, recompute that leg's duration and — if leg-2 exists — roll
  // its date/weekday forward when its departure precedes leg-1's arrival.
  function syncLegs(next: Form): Form {
    const d1 = computeDurationBetween(next.depTime, next.arrTime);
    if (d1) next.duration = d1;
    const d2 = computeDurationBetween(next.c2DepTime, next.c2ArrTime);
    if (d2) next.c2Duration = d2;
    const hasLeg2 = !!(next.c2OriginCode || next.c2DestCode || next.c2DepTime || next.c2ArrTime);
    const dd = deriveLeg2DepartureDate(next.date, next.depTime, next.arrTime, next.c2DepTime);
    if (hasLeg2 && dd) {
      // Only auto-fill when the user hasn't typed a c2 date themselves.
      // Preserve manual input so typed values don't get overwritten.
      if (!next.c2Date || next.c2Date === next.date) {
        next.c2Date = formatLongDate(dd);
      }
      if (!next.c2Weekday || next.c2Weekday === next.weekday) {
        next.c2Weekday = formatWeekdayHeader(dd);
      }
    }
    return next;
  }
  function updateTime(field: "depTime" | "arrTime", v: string) {
    setForm((f) => syncLegs({ ...f, [field]: v } as Form));
  }
  function updateC2Time(field: "c2DepTime" | "c2ArrTime", v: string) {
    setForm((f) => syncLegs({ ...f, [field]: v } as Form));
  }




  function selectAirline(id: string) {
    setAirlineId(id);
    const t = templates.find((x) => x.id === id);
    if (t) setForm(defaultsFor(t));
  }

  function update<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => syncLegs({ ...f, [k]: v } as Form));
  }
  function updatePax(i: number, patch: Partial<Pax>) {
    setForm((f) => ({ ...f, passengers: f.passengers.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));
  }
  function addPax() {
    const base = airline.style === "flyadeal"
      ? { ...emptyPax(), bag: "1 x 20 Kgs Baggage", others: "1 x Airport Check-in" }
      : airline.style === "salam"
        ? { ...emptyPax(), bag: "5kg Hand baggage(Under seat)\n1 piece × 10kg\n1 piece × 20kg", others: "Counter Check-in" }
        : emptyPax();
    setForm((f) => ({ ...f, passengers: [...f.passengers, base] }));
  }
  function removePax(i: number) {
    setForm((f) => ({ ...f, passengers: f.passengers.length > 1 ? f.passengers.filter((_, idx) => idx !== i) : f.passengers }));
  }

  function addCustom(t: AirlineTemplate) {
    const next = [...custom, t];
    setCustom(next); saveCustom(next);
    setAirlineId(t.id);
    setForm(defaultsFor(t));
    setEditing(null);
  }
  function saveTemplate(next: AirlineTemplate) {
    if (next.builtIn) {
      // Persist as an override patch (name/iata/logoUrl/colors) on the built-in
      const patch: Partial<AirlineTemplate> = {
        name: next.name, iata: next.iata, logoUrl: next.logoUrl,
        primary: next.primary, accent: next.accent, ink: next.ink,
      };
      const nextOv = { ...overrides, [next.id]: patch };
      setOverrides(nextOv); saveOverrides(nextOv);
    } else {
      const nextList = custom.map((t) => (t.id === next.id ? next : t));
      setCustom(nextList); saveCustom(nextList);
    }
    setAirlineId(next.id);
    setEditing(null);
  }
  function resetBuiltIn(id: string) {
    const nextOv = { ...overrides }; delete nextOv[id];
    setOverrides(nextOv); saveOverrides(nextOv);
  }
  function deleteCustom(id: string) {
    const next = custom.filter((t) => t.id !== id);
    setCustom(next); saveCustom(next);
    if (airlineId === id) selectAirline("flyadeal");
  }

  async function download() {
    if (!previewRef.current) return;
    setBusy(true);
    try {
      const pngUrl = await toPng(previewRef.current, { pixelRatio: 3, cacheBust: false, backgroundColor: "#ffffff", skipFonts: false, filter: (node) => !(node instanceof HTMLElement && node.dataset.noExport === "1") });
      const bytes = Uint8Array.from(atob(pngUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const pdf = await PDFDocument.create();
      const img = await pdf.embedPng(bytes);
      const pageW = 595.28, pageH = 841.89, margin = 24;
      const scale = Math.min((pageW - margin * 2) / img.width, (pageH - margin * 2) / img.height);
      const w = img.width * scale, h = img.height * scale;
      const page = pdf.addPage([pageW, pageH]);
      page.drawImage(img, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const label = form.passengers[0]?.name?.trim().replace(/\s+/g, "_") || "group-ticket";
      a.href = url;
      a.download = `${airline.name}_${label}_${form.bookingRef || "ticket"}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-background animate-premium-fade">
      <header className="border-b border-white/10 bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 text-gold" />
            <div className="text-sm font-bold uppercase tracking-widest">Admin · Group Ticket Format</div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <Link to="/admin" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">Back to Admin</Link>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* LEFT — form */}
        <div className="space-y-4">
          <div className="rounded-xl bg-card p-4 ring-1 ring-border">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Airline Template</div>
              <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1 rounded-md bg-navy px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                <Plus className="h-3 w-3" /> Add Airline
              </button>
            </div>

            {/* Compact picker: logo + searchable dropdown + inline actions */}
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded border border-border bg-white">
                {logoFor(airline)
                  ? <img src={logoFor(airline)} alt={airline.name} className="max-h-8 max-w-12 object-contain" />
                  : <span className="text-[9px] font-bold text-muted-foreground">{airline.iata || "—"}</span>}
              </div>
              <select
                value={airline.id}
                onChange={(e) => selectAirline(e.target.value)}
                className="flex-1 rounded border border-input bg-background px-2 py-2 text-sm font-semibold"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.iata ? ` (${t.iata})` : ""}{t.builtIn ? "" : " · custom"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setEditing(airline)}
                className="inline-flex h-10 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-bold text-navy hover:border-gold"
                title="Edit template"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              {airline.builtIn && overrides[airline.id] && (
                <button
                  type="button"
                  onClick={() => { if (confirm(`Reset "${airline.name}" to defaults?`)) resetBuiltIn(airline.id); }}
                  className="inline-flex h-10 items-center rounded-md border border-border px-2 text-[11px] font-bold text-muted-foreground hover:border-navy"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
              {!airline.builtIn && (
                <button
                  type="button"
                  onClick={() => { if (confirm(`Delete template "${airline.name}"?`)) deleteCustom(airline.id); }}
                  className="inline-flex h-10 items-center rounded-md border border-border px-2 text-destructive hover:border-destructive"
                  title="Delete template"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              {templates.length} template{templates.length === 1 ? "" : "s"} · layout style: <span className="font-semibold uppercase">{airline.style}</span>
            </div>
          </div>

          <div className="rounded-xl bg-card p-4 ring-1 ring-border">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" /> Link with Group Fare
            </div>
            <label className="mb-2 flex flex-col text-xs">
              <span className="mb-1 font-semibold text-muted-foreground">Pick an uploaded group fare (optional)</span>
              <select
                value={fareId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFareId(id);
                  setSegIdx(0);
                  const f = fares.find((x) => x.id === id);
                  if (f) applyAllSegments(f);
                }}
                className="rounded border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— Manual entry —</option>
                {fares.map((f) => {
                  const segs = parseSegments(f.flight_details);
                  const sector = segs.length
                    ? segs.map((s) => `${s.dateRaw} ${s.origin}→${s.destination} ${s.dep}-${s.arr}`).join("  |  ")
                    : `${f.origin_code}→${f.destination_code}`;
                  return (
                    <option key={f.id} value={f.id}>
                      {f.airline} · {sector}
                    </option>
                  );
                })}
              </select>
            </label>
            {segments.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Segments ({segments.length}) — click to fill
                  </div>
                  {segments.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => applyAllSegments(selectedFare)}
                      className="rounded bg-navy px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white"
                    >
                      Fill all as connection
                    </button>
                  )}
                </div>
                <div className="grid gap-1.5">
                  {segments.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSegIdx(i); applyFareSegment(selectedFare, i); }}
                      className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs font-mono ${
                        segIdx === i ? "border-gold bg-gold/10" : "border-border hover:border-gold/60"
                      }`}
                    >
                      <span>
                        {s.flightNo ? `${s.flightNo}  ` : ""}
                        {s.dateRaw}  {s.origin} → {s.destination}  {s.dep} · {s.arr}
                      </span>
                      <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-navy">Apply this fare</span>

                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedFare && segments.length === 0 && (
              <div className="rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                Could not parse segments from this fare's flight details. Fill fields manually below.
              </div>
            )}
          </div>


          <div className="rounded-xl bg-card p-4 ring-1 ring-border">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Booking</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Booking Ref (PNR)" value={form.bookingRef} onChange={(v) => update("bookingRef", v)} />
              {airline.style === "flyadeal" && <Field label="E-Ticket #" value={form.eTicket} onChange={(v) => update("eTicket", v)} />}
              {airline.style !== "flyadeal" && <Field label="Fare Type / Class" value={form.fareType} onChange={(v) => update("fareType", v)} />}
            </div>
          </div>

          {!fareId && (
            <div className="rounded-xl bg-card p-4 ring-1 ring-border">
              <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Flight Details {form.hasConnection && <span className="ml-1 rounded bg-gold/20 px-1.5 py-0.5 text-[9px] text-navy">Leg 1</span>}</div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Origin Code" value={form.originCode} onChange={(v) => updateCode("originCode", v)} />
                <Field label="Destination Code" value={form.destCode} onChange={(v) => updateCode("destCode", v)} />
                <Field label="Origin City" value={form.originCity} onChange={(v) => update("originCity", v)} />
                <Field label="Destination City" value={form.destCity} onChange={(v) => update("destCity", v)} />
                <Field label="Origin Airport" value={form.originAirport} onChange={(v) => update("originAirport", v)} full />
                <Field label="Destination Airport" value={form.destAirport} onChange={(v) => update("destAirport", v)} full />
                <Field label="Flight # (optional)" value={form.flightNo} onChange={(v) => update("flightNo", v)} />
                <Field label="Duration (auto)" value={form.duration} onChange={(v) => update("duration", v)} />
                <Field label="Depart Time" value={form.depTime} onChange={(v) => updateTime("depTime", v)} />
                <Field label="Arrive Time" value={form.arrTime} onChange={(v) => updateTime("arrTime", v)} />
                <label className="col-span-2 flex flex-col text-xs">
                  <span className="mb-1 font-semibold text-muted-foreground">Pick date (fills Date + Weekday)</span>
                  <input
                    type="date"
                    onChange={(e) => pickDate(e.target.value)}
                    className="rounded border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <Field label="Date (e.g. 03 July 2026)" value={form.date} onChange={(v) => update("date", v)} full />
                <Field label="Weekday header (auto)" value={form.weekday} onChange={(v) => update("weekday", v)} full />
                <Field label="Stops" value={form.stops} onChange={(v) => update("stops", v)} />
              </div>
            </div>
          )}

          {/* Connection (Leg 2) — manual only; hidden when a group fare is linked */}
          {!fareId && (
            <div className="rounded-xl bg-card p-4 ring-1 ring-border">
              <label className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Connecting Leg (Leg 2)</span>
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-navy">
                  <input
                    type="checkbox"
                    checked={form.hasConnection}
                    onChange={(e) => update("hasConnection", e.target.checked)}
                  />
                  Add connection
                </span>
              </label>
              {form.hasConnection && (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Leg 2 Origin Code" value={form.c2OriginCode} onChange={(v) => updateCode("c2OriginCode", v)} />
                  <Field label="Leg 2 Destination Code" value={form.c2DestCode} onChange={(v) => updateCode("c2DestCode", v)} />
                  <Field label="Origin City" value={form.c2OriginCity} onChange={(v) => update("c2OriginCity", v)} />
                  <Field label="Destination City" value={form.c2DestCity} onChange={(v) => update("c2DestCity", v)} />
                  <Field label="Origin Airport" value={form.c2OriginAirport} onChange={(v) => update("c2OriginAirport", v)} full />
                  <Field label="Destination Airport" value={form.c2DestAirport} onChange={(v) => update("c2DestAirport", v)} full />
                  <Field label="Flight # (optional)" value={form.c2FlightNo} onChange={(v) => update("c2FlightNo", v)} />
                  <Field label="Duration" value={form.c2Duration} onChange={(v) => update("c2Duration", v)} />
                  <Field label="Depart Time" value={form.c2DepTime} onChange={(v) => updateC2Time("c2DepTime", v)} />
                  <Field label="Arrive Time" value={form.c2ArrTime} onChange={(v) => updateC2Time("c2ArrTime", v)} />

                  <Field label="Date (e.g. 04 August 2026)" value={form.c2Date} onChange={(v) => update("c2Date", v)} full />
                  <Field label="Weekday header" value={form.c2Weekday} onChange={(v) => update("c2Weekday", v)} full />
                </div>
              )}
            </div>
          )}



          <div className="rounded-xl bg-card p-4 ring-1 ring-border">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Passengers ({form.passengers.length})</div>
              <button onClick={addPax} className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-white">
                <Plus className="h-3.5 w-3.5" /> Add Passenger
              </button>
            </div>
            <div className="space-y-3">
              {form.passengers.map((p, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-bold text-navy">Passenger {i + 1}</div>
                    {form.passengers.length > 1 && (
                      <button onClick={() => removePax(i)} className="text-destructive hover:opacity-80"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Name" value={p.name} onChange={(v) => updatePax(i, { name: v })} full />
                    <Field label="Ticket No." value={p.ticketNo} onChange={(v) => updatePax(i, { ticketNo: v })} />
                    <Field label="Seat" value={p.seat} onChange={(v) => updatePax(i, { seat: v })} />
                    <TextArea label="Bag" value={p.bag} onChange={(v) => updatePax(i, { bag: v })} />
                    <Field label="Meal" value={p.meal} onChange={(v) => updatePax(i, { meal: v })} />
                    <Field label="Others" value={p.others} onChange={(v) => updatePax(i, { others: v })} full />
                  </div>
                </div>
              ))}
            </div>
          </div>


        {/* Branding profile + download (previous position, inside left column) */}
        <div className="space-y-4">

          <label className="flex items-start gap-2 rounded-lg border border-border bg-white p-3 cursor-pointer hover:bg-secondary/40">
            <input
              type="checkbox"
              checked={noBrand}
              onChange={(e) => setNoBrand(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-navy"
            />
            <span className="text-xs font-semibold text-navy">
              Remove header, footer &amp; agent details
              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                Outputs the ticket only — no branding, agency name, address, phone or footer note.
              </span>
            </span>
          </label>

          {!noBrand && (
            <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-3">
              <div className="space-y-2 rounded-lg border border-dashed border-navy/25 bg-navy/[0.03] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-navy/80">
                    {hasSavedProfile
                      ? "Using your saved profile — edit anytime."
                      : "Using Rohi defaults — fill your own, then save as default."}
                  </p>
                  <button
                    type="button"
                    onClick={resetSavedDefaults}
                    className="inline-flex items-center gap-1 rounded-md border border-navy/30 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-navy hover:border-navy hover:bg-navy hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset to Rohi default
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={saveProfileAsDefault}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gold bg-gold px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-navy hover:bg-gold/90"
                  >
                    {savedFlash ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                    {savedFlash ? "Saved as default" : "Save as my default"}
                  </button>
                </div>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Saved on this device only — your agency name, tagline, address, contact, agent name and logo will
                  auto-fill next time.
                </p>
              </div>

              {[
                { label: "Agency Name", value: agencyName, set: setAgencyName, ph: DEFAULT_NAME, optional: false },
                { label: "Tagline", value: tagline, set: setTagline, ph: DEFAULT_TAGLINE, optional: true },
                { label: "Address", value: address, set: setAddress, ph: DEFAULT_ADDRESS, optional: true },
                { label: "Contact / WhatsApp Number", value: phone, set: setPhone, ph: DEFAULT_PHONE, optional: false },
                { label: "Travel Arranger Name", value: agent, set: setAgent, ph: "e.g. Ahmed Khan", optional: true },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-navy/70">
                    {f.label}
                    {f.optional && (
                      <span className="font-normal normal-case tracking-normal text-muted-foreground"> (optional)</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={f.value}
                      onChange={(e) => f.set(e.target.value)}
                      placeholder={f.ph}
                      className="w-full rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-navy placeholder:text-muted-foreground/60 focus:border-navy focus:outline-none"
                    />
                    {f.value && (
                      <button
                        type="button"
                        onClick={() => f.set("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-navy"
                        aria-label={`Clear ${f.label}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-navy/70">
                  Upload Logo
                </label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onLogoFile(e.target.files?.[0])}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-navy/40 bg-navy/5 px-3 py-2 text-xs font-bold text-navy hover:bg-navy/10"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {logoDataUrl ? "Replace Logo" : "Upload Agency Logo"}
                  </button>
                  {logoDataUrl && (
                    <>
                      <img src={logoDataUrl} alt="Logo preview" className="h-10 w-10 rounded-md object-contain ring-1 ring-border" />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoDataUrl("");
                          if (logoInputRef.current) logoInputRef.current.value = "";
                        }}
                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary"
                        aria-label="Remove logo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <button onClick={download} disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-3 text-sm font-bold uppercase tracking-widest text-gold-foreground shadow-md disabled:opacity-60">
            <Download className="h-4 w-4" /> {busy ? "Generating…" : "Download PDF"}
          </button>
        </div>
        </div>




        {/* RIGHT — preview */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <Settings className="h-3.5 w-3.5" /> Live Preview · {airline.name}
          </div>
          <ScaledPreview>
            <div ref={previewRef} className="flex flex-col bg-white shadow-2xl" style={{ width: 794, minHeight: 1123 }}>
              {!noBrand && <BrandHeader profile={brandProfile} qrDataUrl={qrDataUrl} />}
              <div className="flex-1">
                {airline.style === "flyadeal"
                  ? <FlyadealPreview f={form} t={airline} />
                  : airline.style === "salam"
                    ? <SalamPreview f={form} t={airline} />
                    : airline.style === "flydubai"
                      ? <FlydubaiPreview f={form} t={airline} />
                      : airline.style === "flyjinnah"
                        ? <FlyJinnahPreview f={form} t={airline} />
                        : airline.style === "custom-pdf"
                          ? <CustomPdfPreview f={form} t={airline} />
                          : <GenericPreview f={form} t={airline} />}

              </div>
              {!noBrand && <StampBar />}
              {!noBrand && <BrandFooter profile={brandProfile} />}
            </div>
          </ScaledPreview>
        </div>
      </div>

      {editing && (
        <EditAirlineDialog
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={(t) => (editing === "new" ? addCustom(t) : saveTemplate(t))}
        />
      )}
    </div>
  );
}

/* ---------------- Add-airline dialog ---------------- */

/* ---------------- Edit / add airline dialog ---------------- */

function EditAirlineDialog({
  initial, onClose, onSubmit,
}: {
  initial: AirlineTemplate | null;
  onClose: () => void;
  onSubmit: (t: AirlineTemplate) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [iata, setIata] = useState(initial?.iata ?? "");
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? "");
  const [primary, setPrimary] = useState(initial?.primary ?? "#0ea5e9");
  const [accent, setAccent] = useState(initial?.accent ?? "#f59e0b");
  const [style, setStyle] = useState<TemplateStyle>(initial?.style ?? "salam");
  const [backgroundUrl, setBackgroundUrl] = useState<string>(initial?.backgroundUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");

  const isEdit = Boolean(initial);
  const previewLogo =
    logoFor({ id: "_", name, iata, logoUrl, primary, accent, ink: "#000", style });

  async function handleUpload(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = () => rej(r.error);
          r.readAsDataURL(file);
        });
        setBackgroundUrl(dataUrl);
      } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = (workerMod as { default: string }).default;

        const doc = await pdfjs.getDocument({ data: buf }).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
        setBackgroundUrl(canvas.toDataURL("image/jpeg", 0.85));
      } else {
        throw new Error("Please upload a PDF or image file.");
      }
      setStyle("custom-pdf");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = initial?.id
      ?? ("custom-" + trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36));
    onSubmit({
      id,
      name: trimmed,
      iata: iata.trim().toUpperCase() || undefined,
      logoUrl: logoUrl.trim(),
      primary, accent,
      ink: initial?.ink ?? "#1a1a1a",
      style,
      backgroundUrl: backgroundUrl || undefined,
      builtIn: initial?.builtIn,
    });
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card p-5 ring-1 ring-border" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-widest text-navy">
            {isEdit ? `Edit ${initial?.name}` : "Add Airline Template"}
          </div>
          {previewLogo && (
            <div className="flex h-10 w-16 items-center justify-center rounded border border-border bg-white">
              <img src={previewLogo} alt="preview" className="max-h-8 max-w-14 object-contain" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Airline Name" value={name} onChange={setName} full />
          <Field label="IATA Code (e.g. F3, OV) — auto logo" value={iata} onChange={setIata} />
          <Field label="Logo URL (overrides IATA)" value={logoUrl} onChange={setLogoUrl} />
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-semibold text-muted-foreground">Primary Color</span>
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-9 w-full rounded border border-input bg-background" />
          </label>
          <label className="flex flex-col text-xs">
            <span className="mb-1 font-semibold text-muted-foreground">Accent Color</span>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-full rounded border border-input bg-background" />
          </label>
          <div className="col-span-2 flex flex-col text-xs">
            <span className="mb-1 font-semibold text-muted-foreground">
              Official Ticket Format {initial?.builtIn && <span className="text-[10px] font-normal">(fixed for built-in templates)</span>}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {([
                { id: "salam", title: "Salam-style", desc: "Lime banded header · barcode per pax · connection legs" },
                { id: "flyadeal", title: "Flyadeal-style", desc: "Yellow route strip · AM/PM times · segment cards" },
                { id: "flydubai", title: "Flydubai-style", desc: "Blue banded segments · sidebar amenities · transit row" },
                { id: "flyjinnah", title: "Fly Jinnah-style", desc: "Pink header · left flight-code rail · dashed duration line" },
                { id: "generic", title: "Generic", desc: "Uses your Primary/Accent colors · route cards" },
                { id: "custom-pdf", title: "Uploaded Format", desc: "Use an uploaded PDF/image as the exact ticket layout" },
              ] as const).map((opt) => {
                const active = style === opt.id;
                const disabled = Boolean(initial?.builtIn);
                return (
                  <button
                    type="button"
                    key={opt.id}
                    disabled={disabled}
                    onClick={() => setStyle(opt.id)}
                    className={`rounded-md border p-2 text-left transition ${active ? "border-gold bg-gold/10 ring-2 ring-gold" : "border-border hover:border-gold/60"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider text-navy">{opt.title}</div>
                    <div className="mt-1 text-[10px] leading-snug text-muted-foreground">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
            <span className="mt-2 text-[10px] text-muted-foreground">
              New airlines inherit every feature — passenger table, segment cards, connection legs, branding header/footer, stamps and PDF export.
            </span>
          </div>

          <label className="col-span-2 flex flex-col text-xs">
            <span className="mb-1 font-semibold text-muted-foreground">
              Upload Official Ticket Format (PDF page 1 or PNG/JPG){" "}
              {backgroundUrl && <span className="text-[10px] font-normal text-green-600">· uploaded ✓</span>}
            </span>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }}
              className="rounded border border-input bg-background px-2 py-1.5 text-xs"
            />
            <div className="mt-1 flex items-center gap-3">
              {uploading && <span className="text-[10px] text-muted-foreground">Rendering…</span>}
              {uploadError && <span className="text-[10px] text-red-600">{uploadError}</span>}
              {backgroundUrl && (
                <button type="button" onClick={() => setBackgroundUrl("")} className="text-[10px] font-semibold text-red-600 hover:underline">
                  Remove background
                </button>
              )}
            </div>
            {backgroundUrl && (
              <div className="mt-2 max-h-40 overflow-hidden rounded border border-border bg-white p-1">
                <img src={backgroundUrl} alt="Uploaded ticket preview" className="mx-auto max-h-36 object-contain" />
              </div>
            )}
            <span className="mt-1 text-[10px] text-muted-foreground">
              Choose "Uploaded Format" above to render this file as the ticket layout. Data fields (passenger, PNR, dates, sectors) overlay on top.
            </span>
          </label>



        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-xs font-bold">Cancel</button>
          <button onClick={submit} className="rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
            {isEdit ? "Save Changes" : "Add Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inputs ---------------- */

function Field({ label, value, onChange, full }: { label: string; value: string; onChange: (v: string) => void; full?: boolean }) {
  return (
    <label className={`flex flex-col text-xs ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 font-semibold text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-gold focus:ring-1 focus:ring-gold/40" />
    </label>
  );
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="col-span-2 flex flex-col text-xs">
      <span className="mb-1 font-semibold text-muted-foreground">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
        className="rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-gold focus:ring-1 focus:ring-gold/40" />
    </label>
  );
}

/* ========================================================================
   FLYADEAL preview — matches original: white sheet, purple accents,
   yellow rule under booking-ref, boxed route strip, clean table
   ======================================================================== */
function FlyadealPreview({ f, t }: { f: Form; t: AirlineTemplate }) {
  const purple = t.primary;
  const yellow = t.accent;
  const logo = useLogoDataUrl(logoFor(t));
  return (
    <div className="font-sans" style={{ color: t.ink }}>
      {/* Dark purple header */}
      <div className="flex items-start justify-between px-8 py-5" style={{ background: purple, color: "#fff" }}>
        <div className="flex items-start gap-3">
          {logo && (
            <div className="rounded bg-white px-3 py-2">
              <img src={logo} alt={t.name} className="h-8 object-contain" />
            </div>
          )}
        </div>
        <div className="text-right text-[11px] leading-snug">
          <div className="text-[15px] font-bold">Your Booking is Confirmed</div>
          <div className="mt-0.5 opacity-90">Booking Reference</div>
          <div className="font-semibold">{f.bookingRef || "—"}{f.eTicket ? ` - ${f.eTicket}` : ""}</div>
        </div>
      </div>

      {/* Yellow greeting banner */}
      <div className="mx-8 mt-5 rounded-full px-5 py-2 text-[13px]" style={{ background: yellow, color: "#1a1a1a" }}>
        Hi <span className="font-bold">{f.passengers[0]?.name || "Guest"}</span> thank you for choosing {t.name.toLowerCase()}
      </div>

      {/* Gray route section */}
      <div className="mx-8 mt-4 rounded-md bg-neutral-100 px-8 py-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="rounded-full bg-neutral-200 px-6 py-1 text-[11px] font-semibold text-neutral-700">fly+</div>
          <div className="text-[13px] font-bold" style={{ color: purple }}>{f.weekday || f.date || "—"}</div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          <div>
            <div className="text-[56px] font-extrabold leading-none" style={{ color: purple }}>{f.originCode || "—"}</div>
            <div className="mt-2 text-[15px] font-semibold" style={{ color: purple }}>{f.originCity}</div>
            <div className="text-[11px] font-semibold" style={{ color: purple }}>{f.originAirport}</div>
          </div>
          <div className="flex items-center pt-8">
            <div className="border-t-2 border-dashed" style={{ borderColor: purple, width: 90 }} />
            <Plane className="mx-1 h-5 w-5" style={{ color: purple, transform: "rotate(45deg)" }} />
            <div className="border-t-2 border-dashed" style={{ borderColor: purple, width: 90 }} />
          </div>
          <div className="text-right">
            <div className="text-[56px] font-extrabold leading-none" style={{ color: purple }}>{f.destCode || "—"}</div>
            <div className="mt-2 text-[15px] font-semibold" style={{ color: purple }}>{f.destCity}</div>
            <div className="text-[11px] font-semibold" style={{ color: purple }}>{f.destAirport}</div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center">
          <div>
            <div className="text-[22px] font-extrabold" style={{ color: purple }}>{f.depTime || "—"}</div>
          </div>
          <div className="text-center">
            <div className="text-[14px] font-bold" style={{ color: purple }}>{f.flightNo}</div>
            <div className="text-[11px]" style={{ color: purple }}>{f.duration}</div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-extrabold" style={{ color: purple }}>{f.arrTime || "—"}</div>
          </div>
        </div>
      </div>

      {/* Connection leg (Flyadeal) */}
      {f.hasConnection && (
        <div className="mx-8 mt-3 rounded-md bg-neutral-100 px-8 py-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full bg-neutral-200 px-6 py-1 text-[11px] font-semibold text-neutral-700">
              <span>connecting flight</span>
              {layoverLabel(f.arrTime, f.c2DepTime) && (
                <span className="text-neutral-500">· {layoverLabel(f.arrTime, f.c2DepTime)}</span>
              )}
            </div>
            <div className="text-[13px] font-bold" style={{ color: purple }}>{f.c2Weekday || f.c2Date || f.weekday || f.date || "—"}</div>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
            <div>
              <div className="text-[56px] font-extrabold leading-none" style={{ color: purple }}>{f.c2OriginCode || "—"}</div>
              <div className="mt-2 text-[15px] font-semibold" style={{ color: purple }}>{f.c2OriginCity}</div>
              <div className="text-[11px] font-semibold" style={{ color: purple }}>{f.c2OriginAirport}</div>
            </div>
            <div className="flex items-center pt-8">
              <div className="border-t-2 border-dashed" style={{ borderColor: purple, width: 90 }} />
              <Plane className="mx-1 h-5 w-5" style={{ color: purple, transform: "rotate(45deg)" }} />
              <div className="border-t-2 border-dashed" style={{ borderColor: purple, width: 90 }} />
            </div>
            <div className="text-right">
              <div className="text-[56px] font-extrabold leading-none" style={{ color: purple }}>{f.c2DestCode || "—"}</div>
              <div className="mt-2 text-[15px] font-semibold" style={{ color: purple }}>{f.c2DestCity}</div>
              <div className="text-[11px] font-semibold" style={{ color: purple }}>{f.c2DestAirport}</div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center">
            <div>
              <div className="text-[22px] font-extrabold" style={{ color: purple }}>{f.c2DepTime || "—"}</div>
            </div>
            <div className="text-center">
              <div className="text-[14px] font-bold" style={{ color: purple }}>{f.c2FlightNo}</div>
              <div className="text-[11px]" style={{ color: purple }}>{f.c2Duration}</div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-extrabold" style={{ color: purple }}>{f.c2ArrTime || "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* Purple route bar */}
      <div className="mx-8 mt-4 rounded-t-md px-4 py-2 text-white" style={{ background: purple }}>
        <div className="text-[13px] font-bold">
          {f.originCode} &gt; {f.hasConnection ? `${f.c2OriginCode} > ${f.c2DestCode}` : f.destCode}
        </div>
        <div className="text-[10px] opacity-90">{f.flightNo}{f.hasConnection && f.c2FlightNo ? ` / ${f.c2FlightNo}` : ""}</div>
      </div>


      {/* Passenger table */}
      <table className="mx-8 w-[calc(100%-4rem)] border-collapse text-[11px]">
        <thead>
          <tr className="text-left text-neutral-500">
            <th className="border-b border-neutral-200 px-3 py-2 font-semibold">Name</th>
            <th className="border-b border-neutral-200 px-3 py-2 font-semibold">Ticket No.</th>
            <th className="border-b border-neutral-200 px-3 py-2 font-semibold">Seat No.</th>
            <th className="border-b border-neutral-200 px-3 py-2 font-semibold">Bag</th>
            <th className="border-b border-neutral-200 px-3 py-2 font-semibold">Meal</th>
            <th className="border-b border-neutral-200 px-3 py-2 font-semibold">Others</th>
          </tr>
        </thead>
        <tbody>
          {f.passengers.map((p, i) => (
            <tr key={i}>
              <td className="border-b border-neutral-100 px-3 py-2 font-semibold" style={{ color: purple }}>{p.name || "—"}</td>
              <td className="border-b border-neutral-100 px-3 py-2 text-neutral-500">{p.ticketNo || "—"}</td>
              <td className="border-b border-neutral-100 px-3 py-2 text-neutral-500">{p.seat || "None"}</td>
              <td className="border-b border-neutral-100 px-3 py-2 whitespace-pre-line text-neutral-600">{p.bag || "—"}</td>
              <td className="border-b border-neutral-100 px-3 py-2 text-neutral-500">{p.meal || "None"}</td>
              <td className="border-b border-neutral-100 px-3 py-2 text-neutral-500">{p.others || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Yellow Travel Procedures pill */}
      <div className="mx-8 mt-6 rounded-full py-2 text-center text-[13px] font-semibold" style={{ background: yellow, color: purple }}>
        Travel Procedures
      </div>
      <p className="mx-8 mt-4 text-center text-[11px] text-neutral-700">
        Check-in can be completed through the <span className="font-bold">website</span> and <span className="font-bold">app</span> 48 hours before departure
      </p>

      {/* Three gray info boxes */}
      <div className="mx-8 mt-4 grid grid-cols-3 gap-3">
        {[
          "Make sure carry-on is within the allowed size and weight",
          "Check-in counter closes 60 minutes before departure",
          "Boarding gate closes 30 minutes before departure",
        ].map((text, i) => (
          <div key={i} className="rounded-xl bg-neutral-100 px-4 py-5 text-center">
            <Plane className="mx-auto mb-2 h-8 w-8" style={{ color: purple }} />
            <div className="text-[10px] leading-snug text-neutral-700">{text}</div>
          </div>
        ))}
      </div>

      {/* Pink→purple footer */}
      <div className="mt-8 px-8 py-6 text-white" style={{ background: `linear-gradient(90deg, #E91E63, ${purple})` }}>
        <div className="text-[22px] font-extrabold italic">More value</div>
        <div className="mt-1 text-[10px] opacity-90">7 kg carry-on  ·  Seat selection  ·  Meal on board</div>
      </div>
    </div>
  );
}


/* ========================================================================
   FLYDUBAI preview — clean white sheet, orange/navy logo, green tick
   confirmation, blue segment header bar, times/IATA columns with
   dashed duration, dotted sidebar of amenities, transit-in row between legs
   ======================================================================== */
function FlydubaiPreview({ f, t }: { f: Form; t: AirlineTemplate }) {
  const navy = t.primary || "#1B2A4E";
  const orange = t.accent || "#F58220";
  const bandBg = "#EAF3FB";      // light blue segment band
  const rule = "#D9DEE3";
  const logo = useLogoDataUrl(logoFor(t));
  const pax0 = f.passengers[0];
  const bag = (pax0?.bag || "").trim();
  const meal = (pax0?.meal || "").trim();

  const Sidebar = ({ flightA, flightB }: { flightA: string; flightB?: string }) => (
    <div className="pl-6" style={{ borderLeft: `1px dashed ${rule}` }}>
      <div className="text-[12px] font-bold" style={{ color: "#111" }}>Economy Lite</div>
      <div className="mt-3 space-y-2 text-[11px] text-neutral-800">
        <div className="flex items-start gap-2"><span>🧳</span><span>7 kg hand baggage (included)</span></div>
        <div className="flex items-start gap-2"><span>🧳</span><span>{bag ? `${bag} checked baggage` : "20 kg checked baggage"}</span></div>
        <div className="flex items-start gap-2"><span>💺</span><span>{flightA} Seat {pax0?.seat && pax0.seat !== "None" ? pax0.seat : "unassigned"}</span></div>
        {flightB && <div className="flex items-start gap-2"><span>💺</span><span>{flightB} Seat unassigned</span></div>}
        <div className="flex items-start gap-2"><span>🍽️</span><span>{flightA} {meal && meal !== "None" ? meal : "Standard meal (included)"}</span></div>
        {flightB && <div className="flex items-start gap-2"><span>🍽️</span><span>{flightB} Standard meal (included)</span></div>}
        <div className="flex items-start gap-2"><span>🎧</span><span>{flightA} In-flight entertainment (included)</span></div>
        {flightB && <div className="flex items-start gap-2"><span>🎧</span><span>{flightB} In-flight entertainment (included)</span></div>}
      </div>
    </div>
  );

  const SegmentRow = ({
    dateLbl, arrDateLbl, depTime, depCode, depAirport, depTerm,
    arrTime, arrCode, arrAirport, arrTerm, duration,
  }: {
    dateLbl: string; arrDateLbl?: string;
    depTime: string; depCode: string; depAirport: string; depTerm?: string;
    arrTime: string; arrCode: string; arrAirport: string; arrTerm?: string; duration: string;
  }) => (
    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
      <div>
        <div className="text-[13px] font-semibold" style={{ color: "#111" }}>{dateLbl || "—"}</div>
        <div className="mt-1 text-[34px] font-extrabold leading-none" style={{ color: "#111" }}>{depTime || "—"}</div>
        <div className="mt-2 text-[26px] font-bold leading-none" style={{ color: "#111" }}>{depCode || "—"}</div>
        <div className="mt-1 text-[11px] text-neutral-800">{depAirport}</div>
        {depTerm && <div className="text-[11px] text-neutral-800">{depTerm}</div>}
      </div>
      <div className="flex items-center pt-8">
        <div className="border-t border-dashed" style={{ borderColor: rule, width: 60 }} />
        <span className="mx-2 text-[11px] font-semibold text-neutral-700">{duration || "—"}</span>
        <div className="border-t border-dashed" style={{ borderColor: rule, width: 60 }} />
      </div>
      <div className="text-right">
        <div className="text-[13px] font-semibold" style={{ color: "#111" }}>{arrDateLbl || dateLbl || "—"}</div>
        <div className="mt-1 text-[34px] font-extrabold leading-none" style={{ color: "#111" }}>{arrTime || "—"}</div>
        <div className="mt-2 text-[26px] font-bold leading-none" style={{ color: "#111" }}>{arrCode || "—"}</div>
        <div className="mt-1 text-[11px] text-neutral-800">{arrAirport}</div>
        {arrTerm && <div className="text-[11px] text-neutral-800">{arrTerm}</div>}
      </div>
    </div>
  );

  const flightLabel = f.hasConnection && f.c2FlightNo
    ? `${f.flightNo}/${f.c2FlightNo}`
    : f.flightNo;

  return (
    <div className="bg-white font-sans" style={{ color: t.ink }}>
      {/* Top bar: logo + booking ref block */}
      <div className="flex items-start justify-between px-8 pt-5 pb-1">
        {logo
          ? <img src={logo} alt={t.name} className="h-8 object-contain" />
          : <div className="text-[24px] font-extrabold" style={{ color: navy }}>fly<span style={{ color: orange }}>dubai</span></div>}
      </div>

      {/* Confirmed banner + booking ref */}
      <div className="mx-8 mt-2 flex items-start justify-between rounded border px-4 py-3" style={{ borderColor: rule }}>
        <div>
          <div className="flex items-center gap-2 text-[15px] font-bold" style={{ color: "#1BA34A" }}>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: "#1BA34A", fontSize: 12 }}>✓</span>
            Your booking is confirmed
          </div>
          <div className="mt-1 text-[11px] text-neutral-700">Thank you for booking with us.</div>
          <div className="mt-3 text-[12px] font-bold" style={{ color: "#111" }}>Passenger details</div>
          {f.passengers.map((p, i) => (
            <div key={i} className="mt-1">
              <div className="text-[13px] font-bold" style={{ color: "#111" }}>{p.name || "—"}</div>
              <div className="text-[11px] text-neutral-700">{i === 0 ? "Primary Adult" : "Adult"}</div>
            </div>
          ))}
        </div>
        <div className="text-right">
          <div className="text-[22px] font-extrabold tracking-wider" style={{ color: navy }}>{f.bookingRef || "—"}</div>
          <div className="text-[10px] text-neutral-700">flydubai booking reference</div>
        </div>
      </div>

      <div className="mx-8 mt-2 text-right text-[10px] text-neutral-600">All times are local</div>

      {/* Departure segment */}
      <div className="mx-8 mt-2 border" style={{ borderColor: rule }}>
        <div className="flex items-center gap-2 px-4 py-2 text-[12px]" style={{ background: bandBg, color: "#111" }}>
          <span>✈️</span>
          <span>
            Departure from <span className="font-bold">{f.originCity || f.originCode || "—"}</span>{" "}
            (Flight <span className="font-bold">{flightLabel || "—"}</span>)
          </span>
        </div>
        <div className="grid grid-cols-[1fr_260px] gap-6 px-6 py-5">
          <SegmentRow
            dateLbl={`${f.date}${f.weekday ? `, ${f.weekday}` : ""}`}
            arrDateLbl={f.hasConnection
              ? `${f.c2Date || f.date}${(f.c2Weekday || f.weekday) ? `, ${f.c2Weekday || f.weekday}` : ""}`
              : undefined}
            depTime={f.depTime} depCode={f.originCode} depAirport={f.originAirport}
            arrTime={f.arrTime}
            arrCode={f.hasConnection ? f.c2OriginCode || f.destCode : f.destCode}
            arrAirport={f.hasConnection ? f.c2OriginAirport || f.destAirport : f.destAirport}
            duration={f.duration}
          />
          <Sidebar flightA={f.flightNo} flightB={f.hasConnection ? f.c2FlightNo : undefined} />
        </div>

        {f.hasConnection && (
          <>
            <div className="mx-6 border-t border-dashed" style={{ borderColor: rule }} />
            <div className="px-6 py-2 text-center text-[11px] text-neutral-700" style={{ background: bandBg }}>
              Transit in {f.c2OriginCity || f.c2OriginCode || "—"} ({f.c2OriginCode || "—"})
              {layoverLabel(f.arrTime, f.c2DepTime) && <> {" | "} {layoverLabel(f.arrTime, f.c2DepTime)}</>}
            </div>
            <div className="grid grid-cols-[1fr_260px] gap-6 px-6 py-5">
              <SegmentRow
                dateLbl={`${f.c2Date || f.date}${(f.c2Weekday || f.weekday) ? `, ${f.c2Weekday || f.weekday}` : ""}`}
                depTime={f.c2DepTime} depCode={f.c2OriginCode} depAirport={f.c2OriginAirport}
                arrTime={f.c2ArrTime} arrCode={f.c2DestCode} arrAirport={f.c2DestAirport}
                duration={f.c2Duration}
              />
              <div />
            </div>
          </>
        )}
      </div>

      {/* Passengers list */}
      <div className="mx-8 mt-6">
        <div className="text-[12px] font-bold text-neutral-800">Passengers</div>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
          {f.passengers.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <PaxIcon color="#7A8794" />
              <div className="whitespace-pre-line font-semibold" style={{ color: navy }}>{p.name || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer strip */}
      <div className="mx-8 mt-8 mb-4 flex items-center justify-between border-t px-1 pt-3 text-[10px] text-neutral-600" style={{ borderColor: rule }}>
        <div>© flydubai {new Date().getFullYear()}. All rights reserved.</div>
        <div className="font-bold" style={{ color: navy }}>fly<span style={{ color: orange }}>dubai</span> <span className="font-normal text-neutral-600">holidays</span></div>
      </div>
    </div>
  );
}


/* ========================================================================
   FLY JINNAH preview — pink brand ("CONFIRMED RESERVATION"), left rail
   with flight # + class, KHI/SHJ/RUH columns with dashed duration line
   between, "Operated by Air Arabia" caption, transit row, Extras table,
   pink footer bar. Mirrors the official Fly Jinnah confirmed itinerary.
   ======================================================================== */
function FlyJinnahPreview({ f, t }: { f: Form; t: AirlineTemplate }) {
  const pink = t.primary || "#E4187C";
  const rule = "#E5E7EB";
  const barBg = "#F3F4F6";
  const logo = useLogoDataUrl(logoFor(t));
  const pax0 = f.passengers[0];
  const bag = (pax0?.bag || "").trim() || "No Bag";
  const carrier = `${f.originCity || f.originCode || "—"} to ${f.destCity || f.destCode || "—"}`;

  const SegRow = ({
    flightNo, dateLbl, arrDateLbl, depTime, depCode, depCity,
    arrTime, arrCode, arrCity, duration, operator,
  }: {
    flightNo: string; dateLbl: string; arrDateLbl?: string;
    depTime: string; depCode: string; depCity: string;
    arrTime: string; arrCode: string; arrCity: string;
    duration: string; operator?: string;
  }) => (
    <div className="grid grid-cols-[90px_1fr_1fr_1fr] items-center gap-3 px-4 py-4">
      {/* left rail */}
      <div className="text-[11px] leading-tight text-neutral-800">
        <div className="font-bold" style={{ color: "#111" }}>{flightNo || "—"}</div>
        <div className="mt-1">Economy</div>
      </div>
      {/* dep column */}
      <div>
        <div className="text-[22px] font-extrabold leading-none" style={{ color: "#111" }}>{depCode || "—"}</div>
        <div className="mt-1 text-[11px] text-neutral-700">{depCity || "—"}</div>
        <div className="mt-1 text-[11px] text-neutral-700">
          <span>{dateLbl || "—"}</span>{" "}
          <span className="font-bold" style={{ color: "#111" }}>{depTime || "—"}</span>
        </div>
      </div>
      {/* dashed duration */}
      <div className="flex flex-col items-center">
        <div className="text-[11px] font-semibold text-neutral-700">{duration || "—"}</div>
        <div className="mt-1 w-full border-t border-dashed" style={{ borderColor: "#B0B6BE" }} />
        {operator && (
          <div className="mt-1 text-[10px] italic text-neutral-500">Operated by {operator}</div>
        )}
      </div>
      {/* arr column */}
      <div className="text-right">
        <div className="text-[22px] font-extrabold leading-none" style={{ color: "#111" }}>{arrCode || "—"}</div>
        <div className="mt-1 text-[11px] text-neutral-700">{arrCity || "—"}</div>
        <div className="mt-1 text-[11px] text-neutral-700">
          <span>{arrDateLbl || dateLbl || "—"}</span>{" "}
          <span className="font-bold" style={{ color: "#111" }}>{arrTime || "—"}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white font-sans" style={{ color: t.ink }}>
      {/* Top bar: logo / title / (barcode placeholder) */}
      <div className="grid grid-cols-[1fr_1.2fr_1fr] items-center px-8 pt-6 pb-3">
        <div>
          {logo
            ? <img src={logo} alt={t.name} className="h-9 object-contain" />
            : <div className="text-[22px] font-extrabold" style={{ color: pink }}>Fly<span className="text-neutral-900">Jinnah</span></div>}
        </div>
        <div className="text-center text-[18px] font-extrabold tracking-wide" style={{ color: pink }}>
          CONFIRMED RESERVATION
        </div>
        <div className="justify-self-end text-right">
          <div className="inline-block rounded border border-neutral-800 px-3 py-1 font-mono text-[10px] tracking-[0.2em] text-neutral-900">
            ||||| ||| |||| || ||||
          </div>
          <div className="mt-1 text-[9px] text-neutral-600">Scan this barcode at self check-in</div>
        </div>
      </div>

      {/* Passenger + reservation block */}
      <div className="grid grid-cols-[1.4fr_1fr] gap-6 px-8 pb-4">
        <div>
          {f.passengers.map((p, i) => (
            <div key={i} className={i === 0 ? "" : "mt-2"}>
              <div className="text-[14px] font-extrabold" style={{ color: "#111" }}>{p.name || "—"}</div>
              <div className="mt-1 grid grid-cols-[130px_1fr] gap-x-3 text-[11px] text-neutral-700">
                <span>E-ticket number</span><span className="font-semibold text-neutral-900">{p.ticketNo || "—"}</span>
                {i === 0 && (
                  <>
                    <span>Booking Date</span>
                    <span className="font-semibold text-neutral-900">{f.date || "—"}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-md p-3" style={{ background: barBg }}>
          <div className="text-[10px] uppercase tracking-wider text-neutral-600">Reservation Number</div>
          <div className="mt-1 text-[22px] font-extrabold tracking-wider" style={{ color: pink }}>
            {f.bookingRef || "—"}
          </div>
          {f.eTicket && (
            <div className="mt-2 text-[10px] text-neutral-700">
              PIN <span className="font-semibold text-neutral-900">{f.eTicket}</span>
            </div>
          )}
        </div>
      </div>

      {/* Travel Itinerary */}
      <div className="px-8">
        <div className="text-[13px] font-extrabold" style={{ color: "#111" }}>Travel Itinerary</div>
        <div className="mt-2 border" style={{ borderColor: rule }}>
          <div className="flex items-center justify-between px-4 py-2 text-[12px]" style={{ background: barBg, color: "#111" }}>
            <div className="font-semibold">{carrier}</div>
            <div className="text-[11px] font-semibold text-neutral-700">Basic Fare</div>
          </div>

          <SegRow
            flightNo={f.flightNo}
            dateLbl={f.date}
            arrDateLbl={f.hasConnection
              ? (f.c2Date || f.date)
              : undefined}
            depTime={f.depTime} depCode={f.originCode} depCity={f.originCity}
            arrTime={f.arrTime}
            arrCode={f.hasConnection ? f.c2OriginCode || f.destCode : f.destCode}
            arrCity={f.hasConnection ? f.c2OriginCity || f.destCity : f.destCity}
            duration={f.duration}
            operator="Air Arabia"
          />

          {f.hasConnection && (
            <>
              <div className="px-4 pb-2 text-center text-[11px] text-neutral-700" style={{ background: barBg }}>
                {layoverLabel(f.arrTime, f.c2DepTime) || "—"} • Transit in{" "}
                <span className="font-bold">{f.c2OriginCode || "—"}</span>
              </div>
              <SegRow
                flightNo={f.c2FlightNo}
                dateLbl={f.c2Date || f.date}
                depTime={f.c2DepTime} depCode={f.c2OriginCode} depCity={f.c2OriginCity}
                arrTime={f.c2ArrTime} arrCode={f.c2DestCode} arrCity={f.c2DestCity}
                duration={f.c2Duration}
                operator="Air Arabia"
              />
            </>
          )}
        </div>
      </div>

      {/* Extras */}
      <div className="mt-4 px-8">
        <div className="text-[13px] font-extrabold" style={{ color: "#111" }}>Extras</div>
        <table className="mt-2 w-full border-collapse text-[11px]">
          <thead>
            <tr style={{ background: barBg }}>
              <th className="border px-3 py-2 text-left font-semibold" style={{ borderColor: rule }}>Sector</th>
              <th className="border px-3 py-2 text-center font-semibold" style={{ borderColor: rule }}>
                {(f.originCode || "—") + "/" + (f.hasConnection ? (f.c2OriginCode || f.destCode || "—") : (f.destCode || "—"))}
              </th>
              {f.hasConnection && (
                <th className="border px-3 py-2 text-center font-semibold" style={{ borderColor: rule }}>
                  {(f.c2OriginCode || "—") + "/" + (f.c2DestCode || "—")}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border px-3 py-2 font-semibold" style={{ borderColor: rule }}>Hand Baggage</td>
              <td className="border px-3 py-2 text-center" style={{ borderColor: rule }}>7Kg HandBag</td>
              {f.hasConnection && <td className="border px-3 py-2 text-center" style={{ borderColor: rule }}>7Kg HandBag</td>}
            </tr>
            <tr>
              <td className="border px-3 py-2 font-semibold" style={{ borderColor: rule }}>Checked Baggage</td>
              <td className="border px-3 py-2 text-center" style={{ borderColor: rule }}>{bag}</td>
              {f.hasConnection && <td className="border px-3 py-2 text-center" style={{ borderColor: rule }}>{bag}</td>}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Passengers list */}
      <div className="mx-8 mt-6">
        <div className="text-[12px] font-bold text-neutral-800">Passengers</div>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
          {f.passengers.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px]">
              <PaxIcon color="#7A8794" />
              <div className="whitespace-pre-line font-semibold" style={{ color: pink }}>{p.name || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Important information */}
      <div className="mt-6 px-8">
        <div className="text-[13px] font-extrabold" style={{ color: "#111" }}>Important Information</div>
        <div className="mt-2 grid grid-cols-[180px_1fr] gap-y-1 text-[11px] text-neutral-800">
          <span>Terms and Conditions</span><span>Refer to the other attachment</span>
          <span>24/7 Customer Support</span><span>https://flyjinnah.com/contact-us</span>
          <span>Conditions of Carriage</span><span>https://flyjinnah.com/conditions-carriage</span>
          <span>Privacy Policy</span><span>https://flyjinnah.com/privacy-policy</span>
        </div>
      </div>

      {/* Pink footer bar */}
      <div className="mt-8 h-3 w-full" style={{ background: pink }} />
    </div>
  );
}


/* ========================================================================
   SALAM AIR preview — teal banded header, thick teal top rule,
   two-tone route bar, teal-header passenger table
   ======================================================================== */
function SalamPreview({ f, t }: { f: Form; t: AirlineTemplate }) {
  const green = t.primary;
  const logo = useLogoDataUrl(logoFor(t));
  return (
    <div className="font-sans" style={{ color: t.ink, background: "#F2F2F2" }}>
      {/* Green header band with logo */}
      <div className="flex items-center px-8" style={{ background: green, height: 84 }}>
        {logo && <img src={logo} alt={t.name} className="h-10 object-contain brightness-0 invert" />}
      </div>

      {/* Body */}
      <div className="px-8 pt-6 pb-8" style={{ background: "#F2F2F2" }}>
        {/* Title row + PNR box */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[15px] font-bold tracking-wide" style={{ color: green }}>YOUR BOOKING IS CONFIRMED</div>
            <div className="mt-3 text-[11px] font-bold text-neutral-800">
              Booking status: <span style={{ color: "#00A8B5" }}>CONFIRMED</span>
            </div>
          </div>
          <div className="px-5 py-3 text-white" style={{ background: green }}>
            <div className="text-[9px] font-bold uppercase tracking-widest">Booking Reference</div>
            <div className="text-[22px] font-extrabold leading-tight">{f.bookingRef || "—"}</div>
          </div>
        </div>

        {/* White flight card */}
        <div className="mt-6 bg-white px-6 py-6">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-neutral-800">
            <Plane className="h-4 w-4" style={{ color: green, transform: "rotate(-45deg)" }} />
            {(f.originCity || "—").toUpperCase()} TO {(f.destCity || "—").toUpperCase()}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-8">
            <div>
              <div className="text-[26px] font-bold" style={{ color: green }}>{f.weekday || "—"}</div>
              <div className="mt-4 grid grid-cols-[auto_auto_auto] items-center gap-6">
                <div>
                  <div className="text-[32px] font-extrabold leading-none text-neutral-800">{f.depTime || "—"}</div>
                  <div className="mt-1 text-[10px] font-semibold text-neutral-500">{f.originCode} - Departure</div>
                </div>
                <div className="flex flex-col items-center">
                  <svg width="72" height="30" viewBox="0 0 72 30">
                    <path d="M4 26 Q 36 -6 68 26" fill="none" stroke={green} strokeWidth="1.5" />
                  </svg>
                  <Plane className="-mt-3 h-5 w-5" style={{ color: green, transform: "rotate(-45deg)" }} />
                </div>
                <div>
                  <div className="text-[32px] font-extrabold leading-none text-neutral-800">{f.arrTime || "—"}</div>
                  <div className="mt-1 text-[10px] font-semibold text-neutral-500">{f.destCode} - Arrival</div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[26px] font-light text-neutral-700">{f.fareType || "VALUE FARE"}</div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {f.flightNo} | {f.stops || "0 stop"} | {f.duration}
              </div>
            </div>
          </div>
        </div>

        {/* Connection leg (Salam) */}

        {f.hasConnection && (
          <div className="mt-4 bg-white px-6 py-6">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-neutral-800">
              <Plane className="h-4 w-4" style={{ color: green, transform: "rotate(-45deg)" }} />
              {(f.c2OriginCity || "—").toUpperCase()} TO {(f.c2DestCity || "—").toUpperCase()}
              <span className="ml-2 rounded px-2 py-0.5 text-[9px] font-bold text-white" style={{ background: green }}>CONNECTION</span>
              {layoverLabel(f.arrTime, f.c2DepTime) && (
                <span className="ml-2 text-[10px] font-semibold text-neutral-500">{layoverLabel(f.arrTime, f.c2DepTime)}</span>
              )}
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-8">
              <div>
                <div className="text-[26px] font-bold" style={{ color: green }}>{f.c2Weekday || f.weekday || "—"}</div>
                <div className="mt-4 grid grid-cols-[auto_auto_auto] items-center gap-6">
                  <div>
                    <div className="text-[32px] font-extrabold leading-none text-neutral-800">{f.c2DepTime || "—"}</div>
                    <div className="mt-1 text-[10px] font-semibold text-neutral-500">{f.c2OriginCode} - Departure</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <svg width="72" height="30" viewBox="0 0 72 30">
                      <path d="M4 26 Q 36 -6 68 26" fill="none" stroke={green} strokeWidth="1.5" />
                    </svg>
                    <Plane className="-mt-3 h-5 w-5" style={{ color: green, transform: "rotate(-45deg)" }} />
                  </div>
                  <div>
                    <div className="text-[32px] font-extrabold leading-none text-neutral-800">{f.c2ArrTime || "—"}</div>
                    <div className="mt-1 text-[10px] font-semibold text-neutral-500">{f.c2DestCode} - Arrival</div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[26px] font-light text-neutral-700">{f.fareType || "VALUE FARE"}</div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  {f.c2FlightNo} | {f.c2Duration}
                </div>
              </div>
            </div>
          </div>
        )}



        {/* Passenger table */}
        <div className="mt-6 bg-white">
          <div className="grid grid-cols-5 items-center px-4 py-3 text-[11px] font-bold uppercase text-neutral-700" style={{ background: "#E8E8E8" }}>
            <div className="flex items-center gap-2"><UserIcon color={green} /> PASSENGER</div>
            <div className="flex items-center gap-2"><BagIcon color={green} /> BAGGAGE</div>
            <div className="flex items-center gap-2"><SeatIcon color={green} /> SEAT</div>
            <div className="flex items-center gap-2"><MealIcon color={green} /> MEAL</div>
            <div className="flex items-center gap-2"><OtherIcon color={green} /> OTHER</div>
          </div>
          {f.passengers.map((p, i) => (
            <div key={i} className="grid grid-cols-5 items-start gap-4 border-t border-neutral-100 px-4 py-4 text-[11px]">
              <div>
                <div className="font-bold" style={{ color: green }}>{p.name || "—"}</div>
                <div className="mt-2 h-10 w-32"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 4px, #111 4px 5px, transparent 5px 8px, #111 8px 11px, transparent 11px 13px)",
                  }}
                  aria-label="barcode" />
              </div>
              <div className="whitespace-pre-line text-neutral-700">{p.bag || "—"}</div>
              <div className="text-neutral-700">{p.seat && p.seat !== "None" ? p.seat : ""}</div>
              <div className="text-neutral-700">{p.meal && p.meal !== "None" ? p.meal : ""}</div>
              <div className="text-neutral-700">{p.others || "Counter Check-in"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Icons that mimic the SalamAir header row */
function UserIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function BagIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M6 8h12v12H6z" /><path d="M9 8V5h6v3" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
function SeatIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M6 4v10h9M6 14l-2 6M15 14l2 6M9 4h6" />
    </svg>
  );
}
function MealIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M4 3v8a2 2 0 002 2v8M8 3v8M4 7h4M18 3c-2 2-3 5-3 8h3v10" />
    </svg>
  );
}
function OtherIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="5" cy="6" r="1.5" fill={color} /><line x1="9" y1="6" x2="20" y2="6" />
      <circle cx="5" cy="12" r="1.5" fill={color} /><line x1="9" y1="12" x2="20" y2="12" />
      <circle cx="5" cy="18" r="1.5" fill={color} /><line x1="9" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function PaxIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="22" viewBox="0 0 24 28" fill="none" stroke={color} strokeWidth="1.5">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 26c0-5 4-9 8-9s8 4 8 9" />
    </svg>
  );
}


/* ========================================================================
   GENERIC preview — driven purely by template.primary/accent
   ======================================================================== */
function GenericPreview({ f, t }: { f: Form; t: AirlineTemplate }) {
  const p = t.primary, a = t.accent;
  const logo = useLogoDataUrl(logoFor(t));
  return (
    <div className="font-sans" style={{ color: t.ink }}>
      <div className="flex items-center justify-between px-10 pt-8">
        {logo
          ? <img src={logo} alt={t.name} className="h-12 object-contain" />
          : <div className="rounded px-3 py-1 text-lg font-extrabold text-white" style={{ background: p }}>{t.name}</div>}
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Booking Reference</div>
          <div className="text-2xl font-extrabold" style={{ color: p }}>{f.bookingRef || "—"}</div>
        </div>
      </div>

      <div className="px-10">
        <div className="mt-4 h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${p}, ${a})` }} />
        <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">YOUR BOOKING IS CONFIRMED</h1>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center rounded-lg border p-5" style={{ borderColor: p + "40" }}>
          <div>
            <div className="text-4xl font-extrabold" style={{ color: p }}>{f.originCode || "—"}</div>
            <div className="text-sm font-semibold">{f.originCity}</div>
            <div className="text-[11px] text-neutral-500">{f.originAirport}</div>
            <div className="mt-2 text-lg font-extrabold">{f.depTime}</div>
            <div className="text-[11px] text-neutral-500">{f.date || f.weekday}</div>
          </div>
          <div className="flex flex-col items-center px-4">
            <Plane className="h-6 w-6 -rotate-90" style={{ color: p }} />
            <div className="mt-1 text-[10px] font-bold" style={{ color: p }}>{f.flightNo}</div>
            <div className="text-[10px] text-neutral-500">{f.duration}</div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-extrabold" style={{ color: p }}>{f.destCode || "—"}</div>
            <div className="text-sm font-semibold">{f.destCity}</div>
            <div className="text-[11px] text-neutral-500">{f.destAirport}</div>
            <div className="mt-2 text-lg font-extrabold">{f.arrTime}</div>
            <div className="text-[11px] text-neutral-500">{f.date || f.weekday}</div>
          </div>
        </div>

        {f.hasConnection && (
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center rounded-lg border p-5" style={{ borderColor: p + "40" }}>
            <div>
              <div className="text-4xl font-extrabold" style={{ color: p }}>{f.c2OriginCode || "—"}</div>
              <div className="text-sm font-semibold">{f.c2OriginCity}</div>
              <div className="text-[11px] text-neutral-500">{f.c2OriginAirport}</div>
              <div className="mt-2 text-lg font-extrabold">{f.c2DepTime}</div>
              <div className="text-[11px] text-neutral-500">{f.c2Date || f.c2Weekday}</div>
            </div>
            <div className="flex flex-col items-center px-4">
              <Plane className="h-6 w-6 -rotate-90" style={{ color: p }} />
              <div className="mt-1 text-[10px] font-bold" style={{ color: p }}>{f.c2FlightNo}</div>
              <div className="text-[10px] text-neutral-500">{f.c2Duration}</div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-extrabold" style={{ color: p }}>{f.c2DestCode || "—"}</div>
              <div className="text-sm font-semibold">{f.c2DestCity}</div>
              <div className="text-[11px] text-neutral-500">{f.c2DestAirport}</div>
              <div className="mt-2 text-lg font-extrabold">{f.c2ArrTime}</div>
              <div className="text-[11px] text-neutral-500">{f.c2Date || f.c2Weekday}</div>
            </div>
          </div>
        )}



        <table className="mt-6 w-full border-collapse text-[11px]">
          <thead>
            <tr className="text-left text-white" style={{ background: p }}>
              <th className="px-3 py-2">Passenger</th>
              <th className="px-3 py-2">Ticket</th>
              <th className="px-3 py-2">Seat</th>
              <th className="px-3 py-2">Bag</th>
              <th className="px-3 py-2">Meal</th>
              <th className="px-3 py-2">Others</th>
            </tr>
          </thead>
          <tbody>
            {f.passengers.map((pp, i) => (
              <tr key={i} className={i % 2 ? "bg-neutral-50" : "bg-white"}>
                <td className="border px-3 py-2 font-semibold" style={{ borderColor: p + "22" }}>{pp.name || "—"}</td>
                <td className="border px-3 py-2" style={{ borderColor: p + "22" }}>{pp.ticketNo || "—"}</td>
                <td className="border px-3 py-2" style={{ borderColor: p + "22" }}>{pp.seat || "—"}</td>
                <td className="border px-3 py-2 whitespace-pre-line" style={{ borderColor: p + "22" }}>{pp.bag || "—"}</td>
                <td className="border px-3 py-2" style={{ borderColor: p + "22" }}>{pp.meal || "—"}</td>
                <td className="border px-3 py-2" style={{ borderColor: p + "22" }}>{pp.others || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-10 border-t pt-3 text-center text-[10px] text-neutral-400" style={{ borderColor: p + "22" }}>
          {t.name}
        </div>
      </div>
      <div className="mt-6 h-2 w-full" style={{ background: `linear-gradient(90deg, ${p}, ${a})` }} />
    </div>
  );
}

/* ========================================================================
   CUSTOM-PDF preview — renders the uploaded ticket at full A4 page width
   and layers an editor on top so users can (a) cover original content with
   white "eraser" rectangles (drag) and (b) drop editable text boxes
   (click). Elements are draggable and deletable. State is persisted per
   template id in localStorage so overlays survive reloads.
   ======================================================================== */
type OverlayEl =
  | { id: string; kind: "text"; x: number; y: number; w: number; h: number; text: string; fontSize: number; bold: boolean; color: string }
  | { id: string; kind: "eraser"; x: number; y: number; w: number; h: number };

const CUSTOM_A4_WIDTH = 794;

function loadOverlays(templateId: string): OverlayEl[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`rohi.customPdf.overlays.${templateId}`);
    return raw ? (JSON.parse(raw) as OverlayEl[]) : [];
  } catch { return []; }
}
function saveOverlays(templateId: string, els: OverlayEl[]) {
  try { window.localStorage.setItem(`rohi.customPdf.overlays.${templateId}`, JSON.stringify(els)); } catch { /* empty */ }
}

function CustomPdfPreview({ f, t }: { f: Form; t: AirlineTemplate }) {
  const bg = t.backgroundUrl || "";
  const [tool, setTool] = useState<"select" | "text" | "eraser">("select");
  const [els, setEls] = useState<OverlayEl[]>(() => loadOverlays(t.id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<null | { id: string; dx: number; dy: number }>(null);
  const [drawing, setDrawing] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setEls(loadOverlays(t.id)); setSelectedId(null); }, [t.id]);
  useEffect(() => { saveOverlays(t.id, els); }, [t.id, els]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
        e.preventDefault();
        setEls(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function surfacePoint(e: React.MouseEvent): { x: number; y: number } {
    const r = surfaceRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function handleSurfaceDown(e: React.MouseEvent) {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.surface) return;
    const p = surfacePoint(e);
    setSelectedId(null);
    if (tool === "text") {
      const id = "t_" + Date.now().toString(36);
      const el: OverlayEl = { id, kind: "text", x: p.x, y: p.y, w: 180, h: 22, text: "Type here…", fontSize: 12, bold: false, color: "#111827" };
      setEls(prev => [...prev, el]);
      setSelectedId(id);
      setTool("select");
    } else if (tool === "eraser") {
      setDrawing({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  }
  function handleSurfaceMove(e: React.MouseEvent) {
    if (drawing) {
      const p = surfacePoint(e);
      setDrawing({ x: drawing.x, y: drawing.y, w: p.x - drawing.x, h: p.y - drawing.y });
    } else if (dragging) {
      const p = surfacePoint(e);
      setEls(prev => prev.map(el => el.id === dragging.id ? { ...el, x: p.x - dragging.dx, y: p.y - dragging.dy } : el));
    }
  }
  function handleSurfaceUp() {
    if (drawing) {
      const x = Math.min(drawing.x, drawing.x + drawing.w);
      const y = Math.min(drawing.y, drawing.y + drawing.h);
      const w = Math.abs(drawing.w), h = Math.abs(drawing.h);
      if (w > 4 && h > 4) {
        const id = "e_" + Date.now().toString(36);
        setEls(prev => [...prev, { id, kind: "eraser", x, y, w, h }]);
        setSelectedId(id);
      }
      setDrawing(null);
      setTool("select");
    }
    setDragging(null);
  }

  function updateEl(id: string, patch: Partial<OverlayEl>) {
    setEls(prev => prev.map(el => el.id === id ? { ...el, ...patch } as OverlayEl : el));
  }

  const selected = els.find(el => el.id === selectedId) || null;

  if (!bg) {
    return (
      <div className="m-6 flex h-48 items-center justify-center rounded border-2 border-dashed border-neutral-300 text-xs text-neutral-500">
        No background uploaded. Edit this template and upload the official ticket PDF/image.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Toolbar (hidden in exported PDF via data-no-export) */}
      <div data-no-export="1" className="mb-2 flex flex-wrap items-center gap-2 border-b bg-neutral-50 px-3 py-2 text-[11px]">
        <button type="button" onClick={() => setTool("select")} className={`rounded px-2 py-1 font-semibold ${tool === "select" ? "bg-neutral-900 text-white" : "border"}`}>Select / Drag</button>
        <button type="button" onClick={() => setTool("text")} className={`rounded px-2 py-1 font-semibold ${tool === "text" ? "bg-blue-600 text-white" : "border"}`}>+ Add Text</button>
        <button type="button" onClick={() => setTool("eraser")} className={`rounded px-2 py-1 font-semibold ${tool === "eraser" ? "bg-red-600 text-white" : "border"}`}>Delete / Cover Area</button>
        <button
          type="button"
          onClick={() => {
            const imgH = surfaceRef.current?.querySelector("img")?.getBoundingClientRect().height ?? 1123;
            const id = "e_" + Date.now().toString(36);
            setEls(prev => [...prev, { id, kind: "eraser", x: 0, y: 0, w: CUSTOM_A4_WIDTH, h: imgH }]);
            setSelectedId(id);
          }}
          className="rounded border px-2 py-1 font-semibold"
          title="Cover the entire uploaded ticket with white so only your added text/branding shows"
        >Wipe Passenger Data</button>
        <button
          type="button"
          onClick={() => {
            // Build a set of text overlays from current form data. Users can
            // drag each into position on top of the uploaded template.
            const mk = (text: string, x: number, y: number, opts?: Partial<Extract<OverlayEl, { kind: "text" }>>): OverlayEl => ({
              id: "t_" + Math.random().toString(36).slice(2, 8),
              kind: "text",
              x, y, w: opts?.w ?? 240, h: opts?.h ?? 22,
              text, fontSize: opts?.fontSize ?? 12, bold: opts?.bold ?? false, color: opts?.color ?? "#111827",
            });
            const rows: OverlayEl[] = [];
            let y = 40;
            const line = (label: string, value: string, bold = false) => {
              if (!value) return;
              rows.push(mk(`${label}: ${value}`, 40, y, { bold, w: 380 }));
              y += 26;
            };
            line("Booking Ref", f.bookingRef, true);
            if (f.eTicket) line("E-Ticket #", f.eTicket);
            line("Flight", `${f.flightNo}  ${f.date} ${f.weekday}`.trim());
            line("Route", `${f.originCode} ${f.originCity} → ${f.destCode} ${f.destCity}`);
            line("Depart / Arrive", `${f.depTime}  →  ${f.arrTime}   (${f.duration})`);
            if (f.hasConnection) {
              line("Leg 2 Flight", `${f.c2FlightNo}  ${f.c2Date} ${f.c2Weekday}`.trim());
              line("Leg 2 Route", `${f.c2OriginCode} ${f.c2OriginCity} → ${f.c2DestCode} ${f.c2DestCity}`);
              line("Leg 2 Depart / Arrive", `${f.c2DepTime}  →  ${f.c2ArrTime}   (${f.c2Duration})`);
            }
            y += 8;
            rows.push(mk("PASSENGERS", 40, y, { bold: true, fontSize: 13 })); y += 24;
            f.passengers.forEach((p, i) => {
              if (!p.name && !p.ticketNo) return;
              rows.push(mk(`${i + 1}. ${p.name || "—"}   Ticket: ${p.ticketNo || "—"}   Seat: ${p.seat || "—"}   Bag: ${p.bag || "—"}`, 40, y, { w: 700 }));
              y += 22;
            });
            setEls(prev => [...prev, ...rows]);
          }}
          className="rounded border border-emerald-600 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700"
          title="Insert current passenger + flight form data as draggable text overlays"
        >Auto-fill from Form</button>
        <button
          type="button"
          onClick={() => { if (confirm("Remove all overlays (text + eraser rectangles)?")) { setEls([]); setSelectedId(null); } }}
          className="rounded border px-2 py-1 font-semibold text-red-600"
        >Clear All</button>
        <span className="text-neutral-500">Delete key removes selected. Drag to move.</span>
        {selected?.kind === "text" && (
          <span className="ml-auto flex items-center gap-1">
            <input type="number" min={8} max={48} value={selected.fontSize} onChange={e => updateEl(selected.id, { fontSize: Number(e.target.value) || 12 })} className="w-14 rounded border px-1 py-0.5" />
            <button type="button" onClick={() => updateEl(selected.id, { bold: !selected.bold })} className={`rounded border px-2 py-0.5 font-bold ${selected.bold ? "bg-neutral-900 text-white" : ""}`}>B</button>
            <input type="color" value={selected.color} onChange={e => updateEl(selected.id, { color: e.target.value })} className="h-6 w-8 rounded border" />
          </span>
        )}
      </div>

      <div
        ref={surfaceRef}
        data-surface="1"
        onMouseDown={handleSurfaceDown}
        onMouseMove={handleSurfaceMove}
        onMouseUp={handleSurfaceUp}
        onMouseLeave={handleSurfaceUp}
        className="relative select-none"
        style={{ width: CUSTOM_A4_WIDTH, cursor: tool === "text" ? "text" : tool === "eraser" ? "crosshair" : "default" }}
      >
        <img
          src={bg}
          alt={`${t.name} official ticket format`}
          crossOrigin="anonymous"
          draggable={false}
          data-surface="1"
          className="block pointer-events-none"
          style={{ width: CUSTOM_A4_WIDTH, height: "auto" }}
        />

        {els.map(el => {
          const isSel = selectedId === el.id;
          const common: React.CSSProperties = {
            position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h,
            outline: isSel ? "2px solid #2563eb" : "none",
          };
          if (el.kind === "eraser") {
            return (
              <div
                key={el.id}
                style={{ ...common, background: "#ffffff" }}
                onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); const p = surfacePoint(e); setDragging({ id: el.id, dx: p.x - el.x, dy: p.y - el.y }); }}
              />
            );
          }
          return (
            <div
              key={el.id}
              style={{
                ...common,
                fontSize: el.fontSize,
                fontWeight: el.bold ? 700 : 400,
                color: el.color,
                lineHeight: 1.15,
                padding: "1px 2px",
                background: "rgba(255,255,255,0.85)",
                cursor: "move",
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).isContentEditable) return;
                e.stopPropagation();
                setSelectedId(el.id);
                const p = surfacePoint(e);
                setDragging({ id: el.id, dx: p.x - el.x, dy: p.y - el.y });
              }}
              onDoubleClick={(e) => { (e.currentTarget.querySelector("[data-edit]") as HTMLElement | null)?.focus(); }}
            >
              <span
                data-edit
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => updateEl(el.id, { text: e.currentTarget.textContent || "" })}
                style={{ outline: "none", whiteSpace: "pre-wrap" }}
              >
                {el.text}
              </span>
            </div>
          );
        })}

        {drawing && (
          <div style={{
            position: "absolute",
            left: Math.min(drawing.x, drawing.x + drawing.w),
            top: Math.min(drawing.y, drawing.y + drawing.h),
            width: Math.abs(drawing.w),
            height: Math.abs(drawing.h),
            background: "rgba(255,255,255,0.9)",
            outline: "1px dashed #dc2626",
          }} />
        )}
      </div>
    </div>
  );
}

