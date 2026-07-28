import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, LogOut, Trash2, Plus, Edit3, Search, X, Check, Settings, ChevronDown, Copy, Ticket, Stamp, KeyRound } from "lucide-react";
import { ChangePasswordDialog, ForgotPasswordDialog } from "@/components/AdminPasswordDialogs";
import { formatFare } from "@/routes/index";
import { buildFareShareText } from "@/lib/fare-format";
import { FormatMakerDialog } from "@/components/FormatMakerDialog";
import { AdminTabs } from "@/components/AdminTabs";
import {
  adminLogout,
  adminUnlock,
  checkAdminUnlocked,
  createFare,
  deleteFare,
  listFaresAdmin,
  updateFare,
  listAirlines,
  createAirline,
  deleteAirline,
  listLocations,
  createLocation,
  deleteLocation,
  listLuggage,
  createLuggage,
  deleteLuggage,
  listServices,
  createService,
  deleteService,
  getPsf,
  setPsf,
  listAgentsAdmin,

  createAgentAdmin,
  updateAgentAdmin,
  deleteAgentAdmin,
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  type Fare,
  type Airline,
  type Location,
  type LuggageOption,
  type InquiryService,
  type AgentRow,
  type Vendor,
} from "@/lib/fares.functions";
import { listTickets, type GroupTicket } from "@/lib/tickets.functions";

function parseSeatsTotal(seats: string | null | undefined): number {
  if (!seats) return 0;
  const m = String(seats).match(/(\d+)\s*(?:out of|of|\/)\s*(\d+)/i);
  if (m) return parseInt(m[2], 10) || 0;
  const n = parseInt(String(seats).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}
function soldForFare(f: Fare, tickets: GroupTicket[]): number {
  const o = (f.origin_code || "").toUpperCase();
  const d = (f.destination_code || "").toUpperCase();
  if (!o || !d) return 0;
  return tickets.filter((t) => {
    const sector = (t.sector || "").toUpperCase();
    const tokens = sector.split(/[^A-Z0-9]+/).filter(Boolean);
    return tokens.includes(o) && tokens.includes(d);
  }).length;
}
function seatsDisplay(f: Fare, tickets: GroupTicket[]): string {
  const total = parseSeatsTotal(f.seats);
  if (!total) return f.seats || "—";
  const sold = soldForFare(f, tickets);
  const available = Math.max(total - sold, 0);
  return `${available} out of ${total}`;
}

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
});

function AdminPage() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  return status?.unlocked ? <AdminPanel /> : <UnlockScreen />;
}

function UnlockScreen() {
  const unlock = useServerFn(adminUnlock);
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await unlock({ data: { password } });
      if (!res.ok) setErr("Incorrect password");
      else await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-[var(--shadow-hero)] ring-1 ring-border"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy">
          <Plane className="h-6 w-6 -rotate-45 text-gold" />
        </div>
        <h1 className="mt-4 text-center font-serif text-2xl font-black text-navy">Admin Access</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Enter the admin password to manage fares
        </p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-6 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
        />
        {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
        <button
          disabled={busy || !password}
          className="mt-4 w-full rounded-lg bg-navy py-3 text-sm font-bold text-navy-foreground hover:opacity-95 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Unlock"}
        </button>
        <button
          type="button"
          onClick={() => setShowForgot(true)}
          className="mt-3 w-full text-center text-xs font-semibold text-navy underline underline-offset-2 hover:text-gold"
        >
          Forgot password?
        </button>
      </form>
      {showForgot && <ForgotPasswordDialog onClose={() => setShowForgot(false)} />}
    </div>
  );
}

type Draft = {
  group_type: "self" | "party";
  origin: string;
  origin_code: string;
  destination: string;
  destination_code: string;
  airline: string;
  flight_date: string;
  flight_number: string;
  depart_time: string;
  arrive_time: string;
  baggage: string;
  meal: string;
  seats: string;
  price_text: string;
  vendor_fare: string;
  vendor_name: string;
  flight_details_raw: string;
};

const EMPTY: Draft = {
  group_type: "party",
  origin: "",
  origin_code: "",
  destination: "",
  destination_code: "",
  airline: "",
  flight_date: "",
  flight_number: "",
  depart_time: "",
  arrive_time: "",
  baggage: "25+7KG",
  meal: "",
  seats: "",
  price_text: "FARE ON WHATSAPP",
  vendor_fare: "",
  vendor_name: "",
  flight_details_raw: "",
};

const WA_GROUP_URL = "https://chat.whatsapp.com/K295wuWsea1I5TP026UGqA";
const SITE_URL = "https://rohitravels.lovable.app/";
const BRAND_FOOTER = `*ROHI INTERNATIONAL TRAVELS RYK*\nAbdul Razzaq\n*0305 6622988*`;

const SEATS_OPTIONS: string[] = Array.from({ length: 50 }, (_, i) => `${i + 1} out of ${i + 1}`);

function formatFlightDate(d: string) {
  if (!d) return "";
  return d.replace(/^(\d{1,2})([A-Za-z]{3})$/, "$1 $2").toUpperCase();
}
function buildFlightLine(f: { flight_date: string; origin_code: string; destination_code: string; depart_time?: string | null; arrive_time?: string | null }) {
  return [formatFlightDate(f.flight_date), f.origin_code?.toUpperCase(), f.destination_code?.toUpperCase(), f.depart_time, f.arrive_time].filter(Boolean).join(" ");
}

function buildCommunityText(f: Fare): string {
  return buildFareShareText(f);
}


function buildBroadcastText(f: Fare): string {
  return `${buildCommunityText(f)}\n\n📲 *Join WhatsApp Group:*\n${WA_GROUP_URL}\n\n🌐 *Live Group Fares:*\n${SITE_URL}\n\n${BRAND_FOOTER}`;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}


// Parse "24JUL KHIJED 0800 1100 XY123" — order-flexible.
// - 3-letter month date (e.g. 24JUL) → flight_date
// - 4-digit tokens → depart then arrive
// - Alphanumeric with letters+digits and not a date → flight_number
function parseFlightDetails(raw: string) {
  const firstLine = (raw || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] ?? "";
  const tokens = firstLine.toUpperCase().split(/\s+/).filter(Boolean);
  const out = { flight_date: "", depart_time: "", arrive_time: "", flight_number: "" };
  const times: string[] = [];
  for (const t of tokens) {
    if (/^\d{1,2}[A-Z]{3}$/.test(t)) out.flight_date ||= t;
    else if (/^\d{4}$/.test(t)) times.push(t);
    else if (/^[A-Z]{2,3}\d{1,4}$/.test(t)) out.flight_number ||= t;
    // Anything else (like a route code KHIJED) is ignored – origin/destination come from dropdowns.
  }
  out.depart_time = times[0] ?? "";
  out.arrive_time = times[1] ?? "";
  return out;
}

function fareToRaw(f: Fare): string {
  if (f.flight_details && f.flight_details.trim()) return f.flight_details;
  return [formatFlightDate(f.flight_date), f.origin_code?.toUpperCase(), f.destination_code?.toUpperCase(), f.depart_time, f.arrive_time, f.flight_number]
    .filter(Boolean)
    .join(" ");
}


function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

const AIRLINE_LOGO_OVERRIDES: Record<string, string> = {
  XY: "https://upload.wikimedia.org/wikipedia/commons/6/62/Flynas_Logo.svg",
  F3: "https://upload.wikimedia.org/wikipedia/commons/7/73/Flyadeal_Logo.svg",
  OV: "https://upload.wikimedia.org/wikipedia/commons/2/2f/SalamAir.png",
  FZ: "https://upload.wikimedia.org/wikipedia/commons/7/79/Fly_Dubai_logo_2010_03.svg",
  G9: "https://upload.wikimedia.org/wikipedia/commons/8/84/Air_Arabia_logo_2018.svg",
  PA: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Airblue_Logo.svg",
  PF: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Fly_Jinnah_logo2.png",
  J9: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Jazeera_Airways_logo.svg",
  KU: "https://upload.wikimedia.org/wikipedia/commons/f/f5/Kuwait_Airways_wordmark.svg",
  PK: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Pakistan_International_Airlines_Logo.svg",
  QR: "https://upload.wikimedia.org/wikipedia/commons/7/75/Qatar_Airways_logo.svg",
  ER: "https://upload.wikimedia.org/wikipedia/commons/5/53/SereneAir.svg",
};

function logoFor(a: Airline | undefined) {
  if (!a) return null;
  const code = a.iata_code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return AIRLINE_LOGO_OVERRIDES[code] || `https://daisycon.io/images/airline/?width=900&height=450&color=ffffff00&iata=${code}`;
}



const URDU_CITIES: Record<string, string> = {
  KARACHI: "کراچی", LAHORE: "لاہور", ISLAMABAD: "اسلام آباد", MULTAN: "ملتان",
  PESHAWAR: "پشاور", QUETTA: "کوئٹہ", FAISALABAD: "فیصل آباد", SIALKOT: "سیالکوٹ",
  JEDDAH: "جدہ", MADINAH: "مدینہ", RIYADH: "ریاض", DAMMAM: "دمام",
  DUBAI: "دبئی", ABUDHABI: "ابوظہبی", SHARJAH: "شارجہ", DOHA: "دوحہ",
  MUSCAT: "مسقط", KUWAIT: "کویت", BAHRAIN: "بحرین", ISTANBUL: "استنبول",
  MAKKAH: "مکہ", MECCA: "مکہ",
};
function urduLookup(city: string, byCity: Map<string, Location>): string {
  const fromDb = byCity.get(city)?.urdu_name;
  if (fromDb) return fromDb;
  const key = (city || "").toUpperCase().replace(/[^A-Z]/g, "");
  return URDU_CITIES[key] || city;
}
function urduPair(origin: string, destination: string, byCity: Map<string, Location>): string {
  if (!origin && !destination) return "";
  return `${urduLookup(origin, byCity)} ${urduLookup(destination, byCity)}`;
}

function FilterSelect({ label, value, onChange, options, allLabel, renderOption }: { label: string; value: string; onChange: (v: string) => void; options: string[]; allLabel: string; renderOption?: (v: string) => string }) {
  return (
    <label className="group relative flex flex-col rounded-lg border border-border bg-card px-3 py-1.5 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30">
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full appearance-none bg-transparent pr-4 text-sm font-semibold text-foreground outline-none"
      >
        <option value="ALL">{allLabel}</option>
        {options.map((o) => <option key={o} value={o}>{renderOption ? renderOption(o) : o}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
    </label>
  );
}
function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-navy-foreground">
      {label}
      <button onClick={onClear} className="rounded-full bg-white/15 p-0.5 hover:bg-white/30" aria-label="Clear filter">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {

  const [done, setDone] = useState(false);
  async function onClick() {
    await copyText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#075E54]">{label}</span>
      )}
      <button
        onClick={onClick}
        title={text}
        style={done ? undefined : { backgroundColor: "#25D366", borderColor: "#128C7E", color: "#ffffff" }}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
          done ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "hover:brightness-95 shadow-sm"
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function AdminPanel() {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const create = useServerFn(createFare);
  const update = useServerFn(updateFare);
  const remove = useServerFn(deleteFare);

  const { data: fares = [] } = useQuery<Fare[]>({ queryKey: ["fares", "admin"], queryFn: () => listFaresAdmin(), refetchInterval: 30000 });
  const { data: tickets = [] } = useQuery<GroupTicket[]>({ queryKey: ["tickets"], queryFn: () => listTickets() });
  const { data: psfData } = useQuery({ queryKey: ["site-settings", "psf"], queryFn: () => getPsf() });
  const savePsf = useServerFn(setPsf);
  const [psfDraft, setPsfDraft] = useState<string>("");
  const [psfSaving, setPsfSaving] = useState(false);
  const [psfMsg, setPsfMsg] = useState<string | null>(null);
  useEffect(() => {
    if (psfData) setPsfDraft(String(psfData.psf));
  }, [psfData]);
  async function onSavePsf() {
    const n = Number(psfDraft);
    if (!Number.isFinite(n) || n < 0) { setPsfMsg("Enter a valid amount"); return; }
    setPsfSaving(true); setPsfMsg(null);
    try {
      await savePsf({ data: { psf: Math.floor(n) } });
      await qc.invalidateQueries({ queryKey: ["site-settings", "psf"] });
      setPsfMsg("Saved ✓");
      setTimeout(() => setPsfMsg(null), 1500);
    } catch (e: any) {
      setPsfMsg(e?.message ?? "Failed to save");
    } finally {
      setPsfSaving(false);
    }
  }



  const { data: airlines = [] } = useQuery({ queryKey: ["airlines"], queryFn: () => listAirlines() });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const { data: luggages = [] } = useQuery({ queryKey: ["luggage"], queryFn: () => listLuggage() });

  const airlineByName = useMemo(() => {
    const m = new Map<string, Airline>();
    airlines.forEach((a) => m.set(a.name, a));
    return m;
  }, [airlines]);
  const locationByCity = useMemo(() => {
    const m = new Map<string, Location>();
    locations.forEach((l) => m.set(l.city, l));
    return m;
  }, [locations]);

  const airlineKeywords = useMemo(() => {
    const m: Record<string, string> = {};
    airlines.forEach((a) => (m[a.name] = a.iata_code));
    return m;
  }, [airlines]);
  const locationKeywords = useMemo(() => {
    const m: Record<string, string> = {};
    locations.forEach((l) => (m[l.city] = l.code));
    return m;
  }, [locations]);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showFormatMaker, setShowFormatMaker] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("manage") === "1") setShowSettings(true);
    if (p.get("pw") === "1") setShowChangePw(true);
    if (p.has("manage") || p.has("pw")) {
      const url = window.location.pathname;
      window.history.replaceState({}, "", url);
    }
  }, []);
  const [showAddRow, setShowAddRow] = useState(false);
  const [destFilter, setDestFilter] = useState<string>("ALL");
  const [originFilter, setOriginFilter] = useState<string>("ALL");
  const [airlineFilter, setAirlineFilter] = useState<string>("ALL");
  const [groupTypeFilter, setGroupTypeFilter] = useState<string>("ALL");

  const destinations = useMemo(() => {
    const set = new Set<string>();
    fares.forEach((f) => f.destination && set.add(f.destination.toUpperCase()));
    return Array.from(set).sort();
  }, [fares]);
  const originsList = useMemo(() => {
    const set = new Set<string>();
    fares.forEach((f) => f.origin && set.add(f.origin.toUpperCase()));
    return Array.from(set).sort();
  }, [fares]);
  const airlinesList = useMemo(() => {
    const set = new Set<string>();
    fares.forEach((f) => f.airline && set.add(f.airline));
    return Array.from(set).sort();
  }, [fares]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fares.filter((f) => {
      if (destFilter !== "ALL" && (f.destination || "").toUpperCase() !== destFilter) return false;
      if (originFilter !== "ALL" && (f.origin || "").toUpperCase() !== originFilter) return false;
      if (airlineFilter !== "ALL" && f.airline !== airlineFilter) return false;
      if (groupTypeFilter !== "ALL" && f.group_type !== groupTypeFilter) return false;
      if (!q) return true;
      return [f.origin, f.origin_code, f.destination, f.destination_code, f.airline, f.flight_date, f.flight_number, f.price_text]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [fares, search, destFilter, originFilter, airlineFilter, groupTypeFilter]);


  function toPayload(d: Draft) {
    const parsed = parseFlightDetails(d.flight_details_raw);
    return {
      origin: d.origin,
      origin_code: d.origin_code,
      destination: d.destination,
      destination_code: d.destination_code,
      airline: d.airline,
      flight_date: parsed.flight_date || d.flight_date || "",
      flight_number: parsed.flight_number || d.flight_number || null,
      depart_time: parsed.depart_time || d.depart_time || null,
      arrive_time: parsed.arrive_time || d.arrive_time || null,
      flight_details: d.flight_details_raw?.trim() || null,
      baggage: d.baggage || null,
      meal: d.meal || null,
      seats: d.seats || null,
      category: "JEDDAH",
      price_text: d.price_text,
      vendor_fare: d.vendor_fare || null,
      vendor_name: d.vendor_name || null,
      is_featured: false,
      sort_order: 0,
      group_type: d.group_type,
    };
  }



  function pickOrigin(d: Draft, city: string): Draft {
    const loc = locationByCity.get(city);
    return { ...d, origin: city, origin_code: loc?.code ?? "" };
  }
  function pickDestination(d: Draft, city: string): Draft {
    const loc = locationByCity.get(city);
    return { ...d, destination: city, destination_code: loc?.code ?? "" };
  }

  async function addRow() {
    if (!draft.origin || !draft.destination || !draft.airline) {
      alert("Please select Airline, From (Origin) and To (Destination) before adding a fare.");
      return;
    }
    setBusy(true);
    try {
      await create({ data: toPayload(draft) });
      await qc.invalidateQueries({ queryKey: ["fares"] });
      router.invalidate();
      setDraft(EMPTY);
      setShowAddRow(false);
    } catch (e) {
      alert("Could not add fare: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(f: Fare) {
    setEditingId(f.id);
    setEditDraft({
      group_type: (f.group_type === "self" ? "self" : "party"),
      origin: f.origin,
      origin_code: f.origin_code,
      destination: f.destination,
      destination_code: f.destination_code,
      airline: f.airline,
      flight_date: f.flight_date,
      flight_number: f.flight_number ?? "",
      depart_time: f.depart_time ?? "",
      arrive_time: f.arrive_time ?? "",
      baggage: f.baggage ?? "",
      meal: f.meal ?? "",
      seats: f.seats ?? "",
      price_text: f.price_text,
      vendor_fare: f.vendor_fare ?? "",
      vendor_name: f.vendor_name ?? "",
      flight_details_raw: fareToRaw(f),
    });
  }


  async function saveEdit() {
    if (!editingId) return;
    if (!editDraft.origin || !editDraft.destination || !editDraft.airline) {
      alert("Airline, Origin and Destination are required.");
      return;
    }
    setBusy(true);
    try {
      await update({ data: { id: editingId, ...toPayload(editDraft) } });
      await qc.invalidateQueries({ queryKey: ["fares"] });
      router.invalidate();
      setEditingId(null);
    } catch (e) {
      alert("Could not save fare: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this fare?")) return;
    try {
      await remove({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["fares"] });
      router.invalidate();
      if (editingId === id) setEditingId(null);
    } catch (e) {
      alert("Could not delete fare: " + (e as Error).message);
    }
  }

  async function onLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Manage live group fares</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Settings className="h-3.5 w-3.5" /> Manage lists
            </button>
            <button
              onClick={() => setShowChangePw(true)}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <KeyRound className="h-3.5 w-3.5" /> Change password
            </button>
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              View site
            </a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-gold bg-gold/10 p-3">
          <span className="text-xs font-bold uppercase tracking-widest text-navy">Homepage PSF Markup</span>
          <label className="flex items-center gap-2 text-sm text-navy">
            <span>Amount (PKR):</span>
            <input
              type="number"
              min={0}
              value={psfDraft}
              onChange={(e) => setPsfDraft(e.target.value)}
              className="w-28 rounded border border-navy/30 bg-white px-2 py-1 text-sm font-bold"
            />
          </label>
          <button
            onClick={onSavePsf}
            disabled={psfSaving}
            className="rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground hover:opacity-90 disabled:opacity-50"
          >
            {psfSaving ? "Saving…" : "Save PSF"}
          </button>
          {psfMsg && <span className="text-xs font-semibold text-navy">{psfMsg}</span>}
          <span className="text-xs text-muted-foreground">Added to every fare on the public homepage only. Agent B2B portal keeps the raw fare.</span>
          <a
            href="/print-format"
            target="_blank"
            rel="noopener"
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground hover:opacity-90"
          >
            🖨 Ticket Print Format
          </a>
          <button
            onClick={() => setShowFormatMaker(true)}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground hover:opacity-90"
          >
            ✨ Format Maker
          </button>

        </div>




        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by city, code, airline, flight #, date, fare…"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-9 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {filtered.length} / {fares.length}
          </span>
          <button
            onClick={() => setShowAddRow((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground hover:opacity-95"
          >
            {showAddRow ? (<><X className="h-3.5 w-3.5" /> Cancel</>) : (<><Plus className="h-3.5 w-3.5" /> Add Fare</>)}
          </button>
        </div>

        {/* Filter row — dropdowns (screenshot 1 style) */}
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-4">
          <FilterSelect label="From" value={originFilter} onChange={setOriginFilter} options={originsList} allLabel="All Origins" />
          <FilterSelect label="To" value={destFilter} onChange={setDestFilter} options={destinations} allLabel="All Destinations" />
          <FilterSelect label="Airline" value={airlineFilter} onChange={setAirlineFilter} options={airlinesList} allLabel="All Airlines" />
          <FilterSelect
            label="Group Type"
            value={groupTypeFilter}
            onChange={setGroupTypeFilter}
            options={["self", "party"]}
            allLabel="All"
            renderOption={(v) => (v === "self" ? "Self Group" : "Party Group")}
          />
        </div>

        {(originFilter !== "ALL" || destFilter !== "ALL" || airlineFilter !== "ALL" || groupTypeFilter !== "ALL") && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active:</span>
            {originFilter !== "ALL" && <ActiveChip label={`From: ${originFilter}`} onClear={() => setOriginFilter("ALL")} />}
            {destFilter !== "ALL" && <ActiveChip label={`To: ${destFilter}`} onClear={() => setDestFilter("ALL")} />}
            {airlineFilter !== "ALL" && <ActiveChip label={`Airline: ${airlineFilter}`} onClear={() => setAirlineFilter("ALL")} />}
            {groupTypeFilter !== "ALL" && <ActiveChip label={`Type: ${groupTypeFilter === "self" ? "Self" : "Party"}`} onClear={() => setGroupTypeFilter("ALL")} />}
            <button
              onClick={() => { setOriginFilter("ALL"); setDestFilter("ALL"); setAirlineFilter("ALL"); setGroupTypeFilter("ALL"); }}
              className="rounded-full border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive hover:border-destructive/40"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Fare strips — group rail | strip card | vendor | actions */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-navy">Live Group Fares</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Columns auto-fill from manage lists · auto-refreshes every 30s
            </p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="text-base font-black tabular-nums text-navy">{filtered.length}</span> {filtered.length === 1 ? "entry" : "entries"}
          </p>
        </div>

        {/* Add row */}
        {showAddRow && (
          <div className="mb-4 overflow-x-auto rounded-lg border border-gold/60 bg-gold/10 shadow-sm">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-navy">New Fare — fill each column</div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddRow(false)} className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-bold uppercase">Cancel</button>
                <button onClick={addRow} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-navy px-5 py-1.5 text-xs font-bold text-navy-foreground hover:opacity-95 disabled:opacity-40">
                  <Plus className="h-3.5 w-3.5" /> Save Fare
                </button>
              </div>
            </div>
            <table className="min-w-[1600px] w-full border-collapse text-sm">
              <thead className="bg-[#0b1220] text-white">
                <tr>
                  {["GROUP","AIRLINE","FROM","TO","FLIGHT DETAILS","LUGGAGE","MEAL","SEATS","AGENT FARE","SECTOR","V.FARE","VENDOR","",""].map((h,i)=>(
                    <th key={i} className="whitespace-nowrap border-r border-white/10 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="align-top bg-white">
                  <td className="px-2 py-2">
                    <select value={draft.group_type} onChange={(e)=>setDraft({...draft, group_type: e.target.value as "self"|"party"})} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-bold uppercase">
                      <option value="party">Party</option><option value="self">Self</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col items-center gap-1">
                      <LogoPreview airline={airlineByName.get(draft.airline)} />
                      <div className="w-full"><SelectCell value={draft.airline} onChange={(v)=>setDraft({...draft, airline: v})} options={airlines.map((a)=>a.name)} keywords={airlineKeywords} placeholder="Airline…" /></div>
                    </div>
                  </td>
                  <td className="px-2 py-2"><SelectCell value={draft.origin} onChange={(v)=>setDraft(pickOrigin(draft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="From…" /></td>
                  <td className="px-2 py-2"><SelectCell value={draft.destination} onChange={(v)=>setDraft(pickDestination(draft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="To…" /></td>
                  <td className="px-2 py-2 min-w-[280px]"><MultiLineCell value={draft.flight_details_raw} onChange={(v)=>setDraft({...draft, flight_details_raw: v})} /></td>
                  <td className="px-2 py-2"><SelectCell value={draft.baggage} onChange={(v)=>setDraft({...draft, baggage: v})} options={luggages.map((l)=>l.label)} placeholder="Baggage" /></td>
                  <td className="px-2 py-2">
                    <select value={draft.meal} onChange={(e)=>setDraft({...draft, meal: e.target.value})} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-bold uppercase">
                      <option value="">Meal…</option><option value="Included">Included</option><option value="Not Included">Not Included</option>
                    </select>
                  </td>
                  <td className="px-2 py-2"><ComboCell listId="seats-add" value={draft.seats} onChange={(v)=>setDraft({...draft, seats: v})} options={SEATS_OPTIONS} placeholder="Seats" /></td>
                  <td className="px-2 py-2"><Cell value={draft.price_text} onChange={(v)=>setDraft({...draft, price_text: v})} placeholder="Agent fare" /></td>
                  <td className="px-2 py-2 text-center text-[10px] text-muted-foreground italic">(auto)</td>
                  <td className="px-2 py-2"><Cell value={draft.vendor_fare} onChange={(v)=>setDraft({...draft, vendor_fare: v})} placeholder="V.Fare" /></td>
                  <td className="px-2 py-2"><Cell value={draft.vendor_name} onChange={(v)=>setDraft({...draft, vendor_name: v})} placeholder="Vendor" /></td>
                  <td className="px-2 py-2 text-center text-[10px] text-muted-foreground">—</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={addRow} disabled={busy} className="inline-flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-[11px] font-bold text-navy-foreground disabled:opacity-40">
                      <Check className="h-3.5 w-3.5" /> Save
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {(() => {
          // group filtered fares by sector
          const groups = new Map<string, Fare[]>();
          for (const f of filtered) {
            const key = `${(f.origin_code || "—").toUpperCase()}-${(f.destination_code || "—").toUpperCase()}`;
            const arr = groups.get(key) ?? [];
            arr.push(f);
            groups.set(key, arr);
          }
          const sectors = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

          if (filtered.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                No fares match your search.
              </div>
            );
          }

          return (
            <div className="space-y-10">
              {sectors.map(([sector, rows]) => (
                <section key={sector} className="rounded-xl bg-gradient-to-b from-amber-50/60 to-white p-4 shadow-sm ring-1 ring-amber-100">
                  {/* Ornate sector heading */}
                  <div className="mb-4 flex items-center justify-center gap-3">
                    <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/70" />
                    <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-[0.28em] text-navy">{sector}</h2>
                    <span className="text-2xl text-gold">✈</span>
                    <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/70" />
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
                    <table className="min-w-[1600px] w-full border-collapse text-sm">
                      <thead className="bg-[#0b1220] text-white">
                        <tr>
                          {[
                            { label: "GROUP" },
                            { label: "AIRLINE" },
                            { label: "FROM" },
                            { label: "TO" },
                            { label: "FLIGHT DETAILS" },
                            { label: "LUGGAGE" },
                            { label: "MEAL" },
                            { label: "SEATS" },
                            { label: "AGENT FARE" },
                            { label: "SECTOR" },
                            { label: "V.FARE" },
                            { label: "VENDOR" },
                            { label: "UPDATED" },
                            { label: "ACTIONS" },
                          ].map((h, i) => (
                            <th
                              key={i}
                              className="whitespace-nowrap border-r border-white/10 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] last:border-r-0"
                            >
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((f, idx) => {
                          const isEdit = editingId === f.id;
                          const air = airlineByName.get(isEdit ? editDraft.airline : f.airline);
                          const priceIsNumeric = /\d/.test(f.price_text || "");
                          const isSelf = f.group_type === "self";
                          const urdu = urduPair(f.origin, f.destination, locationByCity);
                          const total = parseSeatsTotal(f.seats);
                          const available = total ? Math.max(total - soldForFare(f, tickets), 0) : null;
                          const details = (fareToRaw(f) || "").trim();
                          const mealVal = (f.meal ?? "").trim().toUpperCase();
                          const mealColor = mealVal === "NO" ? "text-red-600" : mealVal === "YES" ? "text-emerald-600" : "text-gray-700";

                          if (isEdit) {
                            return (
                              <tr key={f.id} className="border-t border-gold/60 bg-gold/10 align-top">
                                <td className="px-2 py-2">
                                  <select value={editDraft.group_type} onChange={(e)=>setEditDraft({...editDraft, group_type: e.target.value as "self"|"party"})} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-bold uppercase">
                                    <option value="party">Party</option><option value="self">Self</option>
                                  </select>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex flex-col items-center gap-1">
                                    <LogoPreview airline={airlineByName.get(editDraft.airline)} />
                                    <div className="w-full"><SelectCell value={editDraft.airline} onChange={(v)=>setEditDraft({...editDraft, airline: v})} options={airlines.map((a)=>a.name)} keywords={airlineKeywords} placeholder="Airline…" /></div>
                                  </div>
                                </td>
                                <td className="px-2 py-2"><SelectCell value={editDraft.origin} onChange={(v)=>setEditDraft(pickOrigin(editDraft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="From…" /></td>
                                <td className="px-2 py-2"><SelectCell value={editDraft.destination} onChange={(v)=>setEditDraft(pickDestination(editDraft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="To…" /></td>
                                <td className="px-2 py-2 min-w-[280px]"><MultiLineCell value={editDraft.flight_details_raw} onChange={(v)=>setEditDraft({...editDraft, flight_details_raw: v})} /></td>
                                <td className="px-2 py-2"><SelectCell value={editDraft.baggage} onChange={(v)=>setEditDraft({...editDraft, baggage: v})} options={luggages.map((l)=>l.label)} placeholder="Baggage" /></td>
                                <td className="px-2 py-2">
                                  <select value={editDraft.meal} onChange={(e)=>setEditDraft({...editDraft, meal: e.target.value})} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-bold uppercase">
                                    <option value="">Meal…</option><option value="Included">Included</option><option value="Not Included">Not Included</option>
                                  </select>
                                </td>
                                <td className="px-2 py-2"><ComboCell listId={`seats-${f.id}`} value={editDraft.seats} onChange={(v)=>setEditDraft({...editDraft, seats: v})} options={SEATS_OPTIONS} placeholder="Seats" /></td>
                                <td className="px-2 py-2"><Cell value={editDraft.price_text} onChange={(v)=>setEditDraft({...editDraft, price_text: v})} placeholder="Agent fare" /></td>
                                <td className="px-2 py-2 text-center text-[10px] text-muted-foreground italic">(auto)</td>
                                <td className="px-2 py-2"><Cell value={editDraft.vendor_fare} onChange={(v)=>setEditDraft({...editDraft, vendor_fare: v})} placeholder="V.Fare" /></td>
                                <td className="px-2 py-2"><Cell value={editDraft.vendor_name} onChange={(v)=>setEditDraft({...editDraft, vendor_name: v})} placeholder="Vendor" /></td>
                                <td className="px-2 py-2 text-center text-[10px] text-muted-foreground">—</td>
                                <td className="px-2 py-2 text-center">
                                  <div className="flex flex-col gap-1">
                                    <button onClick={saveEdit} disabled={busy} className="inline-flex items-center justify-center gap-1 rounded-full bg-navy px-3 py-1.5 text-[11px] font-bold text-navy-foreground disabled:opacity-40">
                                      <Check className="h-3.5 w-3.5" /> Save
                                    </button>
                                    <button onClick={()=>setEditingId(null)} className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold uppercase">
                                      <X className="h-3.5 w-3.5" /> Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }


                          return (
                            <tr
                              key={f.id}
                              className={`border-t border-gray-100 align-middle transition-colors hover:bg-amber-50/50 ${idx % 2 === 1 ? "bg-gray-50/60" : ""}`}
                            >
                              {/* GROUP */}
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isSelf ? "bg-navy text-navy-foreground" : "bg-gold/20 text-navy ring-1 ring-gold/50"}`}>
                                  {isSelf ? "SELF" : "PARTY"}
                                </span>
                              </td>
                              {/* LOGO (bigger, square) */}
                              <td className="px-3 py-3 text-center"><LogoPreview airline={air} /></td>
                              {/* FROM */}
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-800">{(f.origin || "—").toUpperCase()}</div>
                                <div className="text-[11px] text-gray-500">{f.origin_code}</div>
                              </td>
                              {/* TO */}
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-800">{(f.destination || "—").toUpperCase()}</div>
                                <div className="text-[11px] text-gray-500">{f.destination_code}</div>
                              </td>
                              {/* FLIGHT DETAILS */}
                              <td className="px-3 py-3 font-mono text-[11px] leading-relaxed text-gray-700 whitespace-pre-line max-w-[260px]">
                                {details || "—"}
                              </td>
                              {/* LUGGAGE */}
                              <td className="px-3 py-3 text-center text-sm font-medium text-gray-700 whitespace-nowrap">{f.baggage || "—"}</td>
                              {/* MEAL */}
                              <td className={`px-3 py-3 text-center text-sm font-bold ${mealColor}`}>{f.meal || "—"}</td>
                              {/* SEATS */}
                              <td className="px-3 py-3 text-center text-sm font-bold whitespace-nowrap">
                                {total && available !== null ? (
                                  <span className={available === 0 ? "text-destructive" : "text-gray-800"}>
                                    {available} out of {total}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">{f.seats || "—"}</span>
                                )}
                              </td>
                              {/* AGENT FARE */}
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                {priceIsNumeric ? (
                                  <span className="text-base font-black tabular-nums text-navy">{formatFare(f.price_text)}</span>
                                ) : (
                                  <span className="text-xs font-black uppercase leading-tight tracking-wide text-red-600">
                                    {f.price_text}
                                  </span>
                                )}
                              </td>
                              {/* SECTOR (Urdu) */}
                              <td dir="rtl" className="font-urdu px-3 py-3 text-right text-2xl leading-tight text-gray-900 whitespace-nowrap">
                                {urdu || "—"}
                              </td>
                              {/* V.FARE */}
                              <td className="px-3 py-3 text-center text-sm font-black tabular-nums text-gray-800 whitespace-nowrap">
                                {f.vendor_fare || "—"}
                              </td>
                              {/* VENDOR */}
                              <td className="px-3 py-3 text-center text-[11px] font-bold uppercase text-gray-600 whitespace-nowrap" title={f.vendor_name ?? ""}>
                                {f.vendor_name || "—"}
                              </td>
                              {/* UPDATED */}
                              <td className="px-3 py-3 text-center text-[11px] font-semibold text-muted-foreground whitespace-nowrap" title={new Date(f.updated_at).toLocaleString()}>
                                {timeAgo(f.updated_at)}
                              </td>
                              {/* ACTIONS */}
                              <td className="px-3 py-3">
                                <div className="flex items-end justify-center gap-1.5 whitespace-nowrap">
                                  <CopyButton text={buildCommunityText(f)} label="Community" />
                                  <CopyButton text={buildBroadcastText(f)} label="Broadcast" />
                                  <button
                                    onClick={() => startEdit(f)}
                                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-[10px] font-bold uppercase text-navy transition hover:border-navy/40 hover:bg-navy hover:text-navy-foreground"
                                    aria-label="Edit"
                                  >
                                    <Edit3 className="h-3 w-3" /> Edit
                                  </button>
                                  <button
                                    onClick={() => onDelete(f.id)}
                                    className="rounded-full border border-destructive/30 bg-destructive/10 p-1.5 text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          );
        })()}


        
      </div>

      {showSettings && (
        <SettingsDrawer
          onClose={() => setShowSettings(false)}
          airlines={airlines}
          locations={locations}
          luggages={luggages}
        />
      )}
      {showChangePw && <ChangePasswordDialog onClose={() => setShowChangePw(false)} />}
      <FormatMakerDialog open={showFormatMaker} onClose={() => setShowFormatMaker(false)} />
    </div>
  );
}

function LogoPreview({ airline }: { airline: Airline | undefined }) {
  const src = logoFor(airline);
  if (!src) return <span className="text-[10px] text-muted-foreground">—</span>;
  return (
    <div className="mx-auto flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <img src={src} alt={airline?.name ?? ""} className="max-h-16 max-w-16 object-contain" loading="lazy" decoding="async" />
    </div>
  );
}

function Cell({
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none focus:border-gold focus:bg-background focus:ring-1 focus:ring-gold/30"
    />
  );
}

function MultiLineCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={Math.max(1, (value?.match(/\n/g)?.length ?? 0) + 1)}
      className="w-full resize-y rounded border border-transparent bg-transparent px-2 py-1.5 font-mono text-[11px] leading-tight outline-none focus:border-gold focus:bg-background focus:ring-1 focus:ring-gold/30"
    />
  );
}

function ComboCell({
  value,
  onChange,
  options,
  listId,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  listId: string;
  placeholder?: string;
}) {
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-xs outline-none focus:border-gold focus:bg-background focus:ring-1 focus:ring-gold/30"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}




function SelectCell({
  value,
  onChange,
  options,
  placeholder,
  keywords,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  keywords?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allOptions = useMemo(() => {
    const set = new Set(options);
    if (value && !set.has(value)) return [value, ...options];
    return options;
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter((o) => {
      const kw = keywords?.[o] ?? "";
      return `${o} ${kw}`.toLowerCase().includes(q);
    });
  }, [allOptions, query, keywords]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const v = filtered[highlight];
      if (v) pick(v);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1 rounded border border-transparent bg-transparent px-2 py-1.5 text-left text-xs outline-none hover:bg-background focus:border-gold focus:bg-background focus:ring-1 focus:ring-gold/30"
      >
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>
          {value || placeholder || "Select…"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[240px] max-w-[90vw] rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-1 border-b border-border px-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKey}
              placeholder="Type to search…"
              className="w-full bg-transparent py-2 text-xs outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={() => pick("")}
                title="Clear"
                className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>
            )}
            {filtered.map((o, i) => (
              <li key={o}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(o)}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs ${
                    i === highlight ? "bg-secondary" : ""
                  } ${o === value ? "font-semibold text-navy" : ""}`}
                >
                  <span className="truncate">
                    {o}
                    {keywords?.[o] && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-muted-foreground">
                        {keywords[o]}
                      </span>
                    )}
                  </span>
                  {o === value && <Check className="h-3 w-3" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Settings drawer for managing lookup lists ----------
function SettingsDrawer({
  onClose,
  airlines,
  locations,
  luggages,
}: {
  onClose: () => void;
  airlines: Airline[];
  locations: Location[];
  luggages: LuggageOption[];
}) {
  const [tab, setTab] = useState<"airlines" | "locations" | "luggage" | "services" | "agents" | "vendors">("airlines");
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => listServices() });
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl overflow-y-auto bg-background shadow-xl ring-1 ring-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-navy px-5 py-4 text-navy-foreground">
          <p className="font-serif text-lg font-black">Manage dropdown lists</p>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-border bg-card px-4 pt-3">
          {(["airlines", "locations", "luggage", "services", "agents", "vendors"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-md px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                tab === t ? "bg-background text-navy ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "locations" ? "airports" : t === "luggage" ? "baggage" : t === "agents" ? "registered agents" : t}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "airlines" && <AirlinesManager items={airlines} />}
          {tab === "locations" && <LocationsManager items={locations} />}
          {tab === "luggage" && <LuggageManager items={luggages} />}
          {tab === "services" && <ServicesManager items={services} />}
          {tab === "agents" && <AgentsManager />}
          {tab === "vendors" && <VendorsManager />}
        </div>
      </div>
    </div>
  );
}

function ServicesManager({ items }: { items: InquiryService[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createService);
  const remove = useServerFn(deleteService);
  const [label, setLabel] = useState("");

  async function add() {
    if (!label.trim()) return;
    await create({ data: { label: label.trim(), sort_order: 100 } });
    await qc.invalidateQueries({ queryKey: ["services"] });
    setLabel("");
  }
  async function del(id: string) {
    if (!confirm("Delete this service?")) return;
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["services"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Service name (e.g. Ticket Booking)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <button onClick={add} disabled={!label.trim()} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <p className="text-[11px] text-muted-foreground">These appear in the "Service / Product" dropdown on the customer inquiry form.</p>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2">
            <p className="flex-1 text-sm font-semibold">{s.label}</p>
            <button onClick={() => del(s.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


function AirlinesManager({ items }: { items: Airline[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createAirline);
  const remove = useServerFn(deleteAirline);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logo, setLogo] = useState("");

  async function add() {
    if (!name || !code) return;
    await create({ data: { name, iata_code: code, logo_url: logo || null } });
    await qc.invalidateQueries({ queryKey: ["airlines"] });
    setName(""); setCode(""); setLogo("");
  }
  async function del(id: string) {
    if (!confirm("Delete this airline?")) return;
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["airlines"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Airline name (Flynas)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="IATA (XY)" maxLength={3} className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="Logo URL (optional)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <button onClick={add} disabled={!name || !code} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-16 items-center justify-center rounded bg-white ring-1 ring-border">
              <img src={logoFor(a) ?? ""} alt={a.name} className="max-h-6 max-w-[56px] object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{a.name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{a.iata_code}</p>
            </div>
            <button onClick={() => del(a.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocationsManager({ items }: { items: Location[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createLocation);
  const remove = useServerFn(deleteLocation);
  const [city, setCity] = useState("");
  const [code, setCode] = useState("");
  const [urdu, setUrdu] = useState("");

  async function add() {
    if (!city || !code) return;
    await create({ data: { city, code, urdu_name: urdu || null } });
    await qc.invalidateQueries({ queryKey: ["locations"] });
    setCity(""); setCode(""); setUrdu("");
  }
  async function del(id: string) {
    if (!confirm("Delete this location?")) return;
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["locations"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={city} onChange={(e) => setCity(e.target.value.toUpperCase())} placeholder="City (KARACHI)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code (KHI)" maxLength={4} className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <input value={urdu} onChange={(e) => setUrdu(e.target.value)} placeholder="Urdu name (کراچی)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <button onClick={add} disabled={!city || !code} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <p className="text-[11px] text-muted-foreground">These are used for both "From" and "To" dropdowns.</p>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex-1">
              <p className="text-sm font-semibold">{l.city} <span className="font-mono text-[10px] text-muted-foreground">({l.code})</span></p>
              {l.urdu_name && <p className="text-xs text-muted-foreground">{l.urdu_name}</p>}
            </div>
            <button onClick={() => del(l.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LuggageManager({ items }: { items: LuggageOption[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createLuggage);
  const remove = useServerFn(deleteLuggage);
  const [label, setLabel] = useState("");

  async function add() {
    if (!label) return;
    await create({ data: { label } });
    await qc.invalidateQueries({ queryKey: ["luggage"] });
    setLabel("");
  }
  async function del(id: string) {
    if (!confirm("Delete?")) return;
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["luggage"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={label} onChange={(e) => setLabel(e.target.value.toUpperCase())} placeholder="Luggage label (25+7KG)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
        <button onClick={add} disabled={!label} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-3 py-2">
            <p className="flex-1 text-sm font-semibold">{l.label}</p>
            <button onClick={() => del(l.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgentsManager() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents", "admin"], queryFn: () => listAgentsAdmin() });
  const create = useServerFn(createAgentAdmin);
  const update = useServerFn(updateAgentAdmin);
  const remove = useServerFn(deleteAgentAdmin);

  const empty = {
    agency_name: "", email: "", password: "", contact_person: "",
    city: "", country_code: "+92", cell_number: "", office_address: "",
    status: "approved" as const,
  };
  const [draft, setDraft] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<AgentRow> & { new_password?: string }>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    if (!draft.agency_name || !draft.email || !draft.password) { setErr("Agency, email and password are required"); return; }
    setBusy(true);
    try {
      await create({ data: draft });
      await qc.invalidateQueries({ queryKey: ["agents", "admin"] });
      setDraft(empty);
    } catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }
  function startEdit(a: AgentRow) {
    setEditingId(a.user_id);
    setEditRow({ ...a, new_password: "" });
  }
  async function save() {
    if (!editingId) return;
    setBusy(true); setErr(null);
    try {
      await update({ data: {
        user_id: editingId,
        agency_name: editRow.agency_name ?? "",
        contact_person: editRow.contact_person ?? "",
        city: editRow.city ?? "",
        country_code: editRow.country_code ?? "",
        cell_number: editRow.cell_number ?? "",
        office_address: editRow.office_address ?? "",
        status: (editRow.status as AgentRow["status"]) ?? "pending",
        new_password: editRow.new_password?.trim() ? editRow.new_password : null,
      }});
      await qc.invalidateQueries({ queryKey: ["agents", "admin"] });
      setEditingId(null);
    } catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }
  async function del(user_id: string) {
    if (!confirm("Delete this agent and their account?")) return;
    await remove({ data: { user_id } });
    await qc.invalidateQueries({ queryKey: ["agents", "admin"] });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-card p-3 ring-1 ring-border">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy">Add new agent</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={draft.agency_name} onChange={(e) => setDraft({ ...draft, agency_name: e.target.value })} placeholder="Agency name" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.contact_person} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} placeholder="Contact person" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="Password (min 6)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="City" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <div className="grid grid-cols-[80px_1fr] gap-2">
            <input value={draft.country_code} onChange={(e) => setDraft({ ...draft, country_code: e.target.value })} placeholder="+92" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
            <input value={draft.cell_number} onChange={(e) => setDraft({ ...draft, cell_number: e.target.value })} placeholder="Cell number" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          </div>
          <input value={draft.office_address} onChange={(e) => setDraft({ ...draft, office_address: e.target.value })} placeholder="Office address" className="col-span-2 rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as any })} className="rounded border border-input bg-background px-2 py-1.5 text-sm">
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
          <button onClick={add} disabled={busy} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add agent</button>
        </div>
        {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
          {agents.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No agents yet.</li>}
          {agents.map((a) => {
            const isEdit = editingId === a.user_id;
            return (
              <li key={a.user_id} className="px-3 py-3">
                {isEdit ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editRow.agency_name ?? ""} onChange={(e) => setEditRow({ ...editRow, agency_name: e.target.value })} placeholder="Agency" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <input value={editRow.contact_person ?? ""} onChange={(e) => setEditRow({ ...editRow, contact_person: e.target.value })} placeholder="Contact person" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <input value={editRow.city ?? ""} onChange={(e) => setEditRow({ ...editRow, city: e.target.value })} placeholder="City" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <input value={editRow.country_code ?? ""} onChange={(e) => setEditRow({ ...editRow, country_code: e.target.value })} className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                        <input value={editRow.cell_number ?? ""} onChange={(e) => setEditRow({ ...editRow, cell_number: e.target.value })} className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      </div>
                      <input value={editRow.office_address ?? ""} onChange={(e) => setEditRow({ ...editRow, office_address: e.target.value })} placeholder="Office address" className="col-span-2 rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <select value={editRow.status ?? "pending"} onChange={(e) => setEditRow({ ...editRow, status: e.target.value as AgentRow["status"] })} className="rounded border border-input bg-background px-2 py-1.5 text-sm">
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                      </select>
                      <input value={editRow.new_password ?? ""} onChange={(e) => setEditRow({ ...editRow, new_password: e.target.value })} placeholder="New password (optional)" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={save} disabled={busy} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Save</button>
                      <button onClick={() => setEditingId(null)} className="rounded border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                    </div>
                    {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{a.agency_name} <span className="ml-2 rounded px-2 py-0.5 text-[10px] font-bold uppercase" style={{ background: a.status === "approved" ? "#d1fae5" : a.status === "rejected" ? "#fee2e2" : "#fef3c7", color: a.status === "approved" ? "#065f46" : a.status === "rejected" ? "#991b1b" : "#92400e" }}>{a.status}</span></p>
                      <p className="text-xs text-muted-foreground">{a.contact_person} • {a.email} • {a.country_code} {a.cell_number} • {a.city}</p>
                    </div>
                    <button onClick={() => startEdit(a)} className="rounded border border-border p-1.5 text-navy hover:bg-secondary"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(a.user_id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}



function VendorsManager() {
  const qc = useQueryClient();
  const { data: vendors = [], isLoading } = useQuery({ queryKey: ["vendors", "admin"], queryFn: () => listVendors() });
  const create = useServerFn(createVendor);
  const update = useServerFn(updateVendor);
  const remove = useServerFn(deleteVendor);

  const empty = { name: "", contact_person: "", phone: "", email: "", notes: "" };
  const [draft, setDraft] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<Partial<Vendor>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    if (!draft.name.trim()) { setErr("Vendor name is required"); return; }
    setBusy(true);
    try {
      await create({ data: draft });
      await qc.invalidateQueries({ queryKey: ["vendors", "admin"] });
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      setDraft(empty);
    } catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!editingId) return;
    setBusy(true); setErr(null);
    try {
      await update({ data: {
        id: editingId,
        name: editRow.name ?? "",
        contact_person: editRow.contact_person ?? "",
        phone: editRow.phone ?? "",
        email: editRow.email ?? "",
        notes: editRow.notes ?? "",
      }});
      await qc.invalidateQueries({ queryKey: ["vendors", "admin"] });
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      setEditingId(null);
    } catch (e: any) { setErr(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }
  async function del(id: string) {
    if (!confirm("Delete this vendor?")) return;
    await remove({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["vendors", "admin"] });
    await qc.invalidateQueries({ queryKey: ["vendors"] });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-card p-3 ring-1 ring-border">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-navy">Add new vendor</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Vendor / Supplier name" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.contact_person} onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })} placeholder="Contact person" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Phone" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes (optional)" className="col-span-2 rounded border border-input bg-background px-2 py-1.5 text-sm" />
          <button onClick={add} disabled={busy} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add vendor</button>
        </div>
        {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
          {vendors.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">No vendors yet.</li>}
          {vendors.map((v) => {
            const isEdit = editingId === v.id;
            return (
              <li key={v.id} className="px-3 py-3">
                {isEdit ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editRow.name ?? ""} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} placeholder="Name" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <input value={editRow.contact_person ?? ""} onChange={(e) => setEditRow({ ...editRow, contact_person: e.target.value })} placeholder="Contact person" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <input value={editRow.phone ?? ""} onChange={(e) => setEditRow({ ...editRow, phone: e.target.value })} placeholder="Phone" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <input value={editRow.email ?? ""} onChange={(e) => setEditRow({ ...editRow, email: e.target.value })} placeholder="Email" className="rounded border border-input bg-background px-2 py-1.5 text-sm" />
                      <input value={editRow.notes ?? ""} onChange={(e) => setEditRow({ ...editRow, notes: e.target.value })} placeholder="Notes" className="col-span-2 rounded border border-input bg-background px-2 py-1.5 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={save} disabled={busy} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Save</button>
                      <button onClick={() => setEditingId(null)} className="rounded border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                    </div>
                    {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{[v.contact_person, v.phone, v.email].filter(Boolean).join(" • ") || "—"}</p>
                      {v.notes && <p className="mt-0.5 text-xs text-muted-foreground italic">{v.notes}</p>}
                    </div>
                    <button onClick={() => { setEditingId(v.id); setEditRow(v); }} className="rounded border border-border p-1.5 text-navy hover:bg-secondary"><Edit3 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(v.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
