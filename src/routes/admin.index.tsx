import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, LogOut, Trash2, Plus, Edit3, Search, X, Check, Settings, ChevronDown, Copy, Ticket, Stamp, KeyRound } from "lucide-react";
import { ChangePasswordDialog, ForgotPasswordDialog } from "@/components/AdminPasswordDialogs";
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
  type Fare,
  type Airline,
  type Location,
  type LuggageOption,
  type InquiryService,
} from "@/lib/fares.functions";

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

function formatFlightDate(d: string) {
  if (!d) return "";
  return d.replace(/^(\d{1,2})([A-Za-z]{3})$/, "$1 $2").toUpperCase();
}
function buildFlightLine(f: { flight_date: string; origin_code: string; destination_code: string; depart_time?: string | null; arrive_time?: string | null }) {
  return [formatFlightDate(f.flight_date), f.origin_code?.toUpperCase(), f.destination_code?.toUpperCase(), f.depart_time, f.arrive_time].filter(Boolean).join(" ");
}

function buildCommunityText(f: Fare): string {
  const line1 = `*🇸🇦 ${f.origin} ${f.destination} ${f.airline.toUpperCase()}*`;
  const details = (f.flight_details && f.flight_details.trim()) ? f.flight_details.trim() : buildFlightLine(f);
  const line3 = `*${(f.baggage ?? "").replace(/KG$/i, " KG").trim()}*`;
  return [line1, details, line3].filter(Boolean).join("\n");
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



function urduPair(origin: string, destination: string, byCity: Map<string, Location>): string {
  const o = byCity.get(origin)?.urdu_name;
  const d = byCity.get(destination)?.urdu_name;
  if (!o && !d) return "";
  return `${o ?? origin} ← ${d ?? destination}`;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  async function onClick() {
    await copyText(text);
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <button
      onClick={onClick}
      title={text}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold ${
        done ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-navy/30 bg-navy/5 text-navy hover:bg-navy hover:text-navy-foreground"
      }`}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}


function AdminPanel() {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const create = useServerFn(createFare);
  const update = useServerFn(updateFare);
  const remove = useServerFn(deleteFare);

  const { data: fares = [] } = useQuery<Fare[]>({ queryKey: ["fares", "admin"], queryFn: () => listFaresAdmin() });
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
  const [showChangePw, setShowChangePw] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [destFilter, setDestFilter] = useState<string>("ALL");

  const destinations = useMemo(() => {
    const set = new Set<string>();
    fares.forEach((f) => f.destination && set.add(f.destination.toUpperCase()));
    return Array.from(set).sort();
  }, [fares]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fares.filter((f) => {
      if (destFilter !== "ALL" && (f.destination || "").toUpperCase() !== destFilter) return false;
      if (!q) return true;
      return [f.origin, f.origin_code, f.destination, f.destination_code, f.airline, f.flight_date, f.flight_number, f.price_text]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [fares, search, destFilter]);

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
    <div className="min-h-screen bg-background">
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
        <div className="mx-auto flex max-w-[1600px] gap-1 px-4">
          <Link to="/admin" className="rounded-t-md border-b-2 border-gold bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold">
            <Plane className="mr-1.5 inline h-3.5 w-3.5" /> Group Fares
          </Link>
          <Link to="/admin/tickets" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <Ticket className="mr-1.5 inline h-3.5 w-3.5" /> Group Tickets
          </Link>
          <Link to="/admin/group-ticket-format" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            Group Ticket Format
          </Link>
          <Link to="/admin/vouchers" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <Ticket className="mr-1.5 inline h-3.5 w-3.5" /> Vouchers
          </Link>
          <Link to="/admin/ok-to-board" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            <Stamp className="mr-1.5 inline h-3.5 w-3.5" /> OK to Board
          </Link>
          <Link to="/admin/visa-links" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            Visa Links
          </Link>
          <Link to="/admin/queries" className="rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
            Queries
          </Link>
        </div>
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

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDestFilter("ALL")}
            className={`rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition ${
              destFilter === "ALL"
                ? "bg-navy text-navy-foreground ring-2 ring-gold"
                : "bg-secondary text-foreground hover:bg-secondary/70"
            }`}
          >
            All Destinations
          </button>
          {destinations.map((d) => (
            <button
              key={d}
              onClick={() => setDestFilter(d)}
              className={`rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition ${
                destFilter === d
                  ? "bg-navy text-navy-foreground ring-2 ring-gold"
                  : "bg-secondary text-foreground hover:bg-secondary/70"
              }`}
            >
              {d}
            </button>
          ))}
        </div>



        <div className="rounded-xl bg-card ring-1 ring-border">
          <table className="w-full table-fixed border-collapse text-xs">
            <thead className="bg-navy text-navy-foreground">
              <tr className="[&>th]:px-1.5 [&>th]:py-2 [&>th]:text-left [&>th]:text-[10px] [&>th]:font-bold [&>th]:tracking-wider [&>th]:border-r [&>th]:border-white/10">
                <th className="w-[9%]">AIRLINE</th>
                <th className="w-[44px]">LOGO</th>
                <th className="w-[9%]">FROM</th>
                <th className="w-[9%]">TO</th>
                <th className="w-[15%]">FLIGHT DETAILS</th>
                <th className="w-[7%]">LUGGAGE</th>
                <th className="w-[6%]">MEAL</th>
                <th className="w-[5%]">SEATS</th>
                <th className="w-[8%]">AGENT FARE</th>
                <th className="w-[9%] font-urdu" dir="rtl">اردو</th>
                <th className="w-[6%]">V.FARE</th>
                <th className="w-[7%]">VENDOR</th>
                <th className="w-[62px] text-center">COMM</th>
                <th className="w-[62px] text-center">BCAST</th>
                <th className="w-[64px]">UPD</th>
                <th className="w-[68px] text-center">ACT</th>
              </tr>
            </thead>
            <tbody>
              {/* Add row */}
              {showAddRow && (
              <tr className="bg-gold/10 [&>td]:border-r [&>td]:border-border [&>td]:p-1 [&>td]:align-middle">
                <td>
                  <SelectCell value={draft.airline} onChange={(v) => setDraft({ ...draft, airline: v })} options={airlines.map((a) => a.name)} keywords={airlineKeywords} placeholder="Select airline…" />
                </td>
                <td className="text-center">
                  <LogoPreview airline={airlineByName.get(draft.airline)} />
                </td>
                <td>
                  <SelectCell value={draft.origin} onChange={(v) => setDraft(pickOrigin(draft, v))} options={locations.map((l) => l.city)} keywords={locationKeywords} placeholder="Select from…" />
                </td>
                <td>
                  <SelectCell value={draft.destination} onChange={(v) => setDraft(pickDestination(draft, v))} options={locations.map((l) => l.city)} keywords={locationKeywords} placeholder="Select to…" />
                </td>
                <td>
                  <MultiLineCell value={draft.flight_details_raw} onChange={(v) => setDraft({ ...draft, flight_details_raw: v })} />
                </td>
                <td>
                  <SelectCell value={draft.baggage} onChange={(v) => setDraft({ ...draft, baggage: v })} options={luggages.map((l) => l.label)} placeholder="" />
                </td>
                <td><Cell value={draft.meal} onChange={(v) => setDraft({ ...draft, meal: v })} placeholder="Meal" /></td>
                <td><Cell value={draft.seats} onChange={(v) => setDraft({ ...draft, seats: v })} placeholder="Seats" /></td>
                <td><Cell value={draft.price_text} onChange={(v) => setDraft({ ...draft, price_text: v })} placeholder="FARE ON WHATSAPP" /></td>
                <td className="px-2 text-right text-xs font-urdu text-muted-foreground" dir="rtl">
                  {urduPair(draft.origin, draft.destination, locationByCity) || "—"}
                </td>
                <td><Cell value={draft.vendor_fare} onChange={(v) => setDraft({ ...draft, vendor_fare: v })} /></td>
                <td><Cell value={draft.vendor_name} onChange={(v) => setDraft({ ...draft, vendor_name: v })} /></td>
                <td className="text-center text-xs text-muted-foreground">—</td>
                <td className="text-center text-xs text-muted-foreground">—</td>
                <td className="px-2 text-xs text-muted-foreground">—</td>
                <td className="p-1 text-center">
                  <button
                    onClick={addRow}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-md bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground hover:opacity-95 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Save
                  </button>
                </td>
              </tr>
              )}

              {filtered.map((f) => {
                const isEdit = editingId === f.id;
                const air = airlineByName.get(isEdit ? editDraft.airline : f.airline);
                const urdu = urduPair(f.origin, f.destination, locationByCity);
                return (
                  <tr key={f.id} className={`[&>td]:border-r [&>td]:border-b [&>td]:border-border [&>td]:p-1 [&>td]:align-middle ${isEdit ? "bg-gold/5" : "hover:bg-secondary/40"}`}>
                    <td>
                      {isEdit ? (
                        <SelectCell value={editDraft.airline} onChange={(v) => setEditDraft({ ...editDraft, airline: v })} options={airlines.map((a) => a.name)} keywords={airlineKeywords} />
                      ) : (
                        <span className="px-1 font-semibold">{f.airline}</span>
                      )}
                    </td>
                    <td className="text-center">
                      <LogoPreview airline={air} />
                    </td>
                    <td>
                      {isEdit ? (
                        <SelectCell value={editDraft.origin} onChange={(v) => setEditDraft(pickOrigin(editDraft, v))} options={locations.map((l) => l.city)} keywords={locationKeywords} />
                      ) : (
                        <div className="px-1">
                          <p className="font-semibold">{f.origin}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{f.origin_code}</p>
                        </div>
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <SelectCell value={editDraft.destination} onChange={(v) => setEditDraft(pickDestination(editDraft, v))} options={locations.map((l) => l.city)} keywords={locationKeywords} />
                      ) : (
                        <div className="px-1">
                          <p className="font-semibold">{f.destination}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{f.destination_code}</p>
                        </div>
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <MultiLineCell value={editDraft.flight_details_raw} onChange={(v) => setEditDraft({ ...editDraft, flight_details_raw: v })} />
                      ) : (
                        <div className="px-1 font-mono text-[11px] leading-tight whitespace-pre-line">{fareToRaw(f) || "—"}</div>
                      )}
                    </td>

                    <td>
                      {isEdit ? (
                        <SelectCell value={editDraft.baggage} onChange={(v) => setEditDraft({ ...editDraft, baggage: v })} options={luggages.map((l) => l.label)} />
                      ) : (
                        <span className="px-1 text-xs">{f.baggage}</span>
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <Cell value={editDraft.meal} onChange={(v) => setEditDraft({ ...editDraft, meal: v })} />
                      ) : (
                        <span className="px-1 text-xs">{f.meal || "—"}</span>
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <Cell value={editDraft.seats} onChange={(v) => setEditDraft({ ...editDraft, seats: v })} />
                      ) : (
                        <span className="px-1 text-xs">{f.seats || "—"}</span>
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <Cell value={editDraft.price_text} onChange={(v) => setEditDraft({ ...editDraft, price_text: v })} />
                      ) : (
                        <span className="whitespace-nowrap px-1 text-base font-black text-destructive">{formatFare(f.price_text)}</span>
                      )}
                    </td>
                    <td className="px-2 text-right text-sm font-urdu text-foreground" dir="rtl" title="Auto-translated from From/To">
                      {urdu || "—"}
                    </td>
                    <td>
                      {isEdit ? (
                        <Cell value={editDraft.vendor_fare} onChange={(v) => setEditDraft({ ...editDraft, vendor_fare: v })} />
                      ) : (
                        <span className="px-1 text-xs">{f.vendor_fare || "—"}</span>
                      )}
                    </td>
                    <td>
                      {isEdit ? (
                        <Cell value={editDraft.vendor_name} onChange={(v) => setEditDraft({ ...editDraft, vendor_name: v })} />
                      ) : (
                        <span className="px-1 text-xs">{f.vendor_name || "—"}</span>
                      )}
                    </td>
                    <td className="text-center">
                      <CopyButton text={buildCommunityText(f)} />
                    </td>
                    <td className="text-center">
                      <CopyButton text={buildBroadcastText(f)} />
                    </td>
                    <td className="px-2 text-xs text-muted-foreground" title={new Date(f.updated_at).toLocaleString()}>
                      {timeAgo(f.updated_at)}
                    </td>
                    <td className="p-1">
                      <div className="flex items-center justify-center gap-1">
                        {isEdit ? (
                          <>
                            <button onClick={saveEdit} disabled={busy} className="rounded-md bg-navy p-1.5 text-navy-foreground disabled:opacity-50" aria-label="Save">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="rounded-md border border-border p-1.5 text-foreground hover:bg-secondary" aria-label="Cancel">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(f)} className="rounded-md border border-border p-1.5 text-navy hover:bg-secondary" aria-label="Edit">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => onDelete(f.id)} className="rounded-md border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10" aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="py-10 text-center text-sm text-muted-foreground">
                    No fares match your search.
                  </td>

                </tr>
              )}
            </tbody>
          </table>
        </div>

        
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
    </div>
  );
}

function LogoPreview({ airline }: { airline: Airline | undefined }) {
  const src = logoFor(airline);
  if (!src) return <span className="text-[10px] text-muted-foreground">—</span>;
  return (
    <div className="flex h-11 items-center justify-center rounded bg-transparent">
      <img src={src} alt={airline?.name ?? ""} className="max-h-10 max-w-[86px] object-contain" loading="lazy" decoding="async" />
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
  const [tab, setTab] = useState<"airlines" | "locations" | "luggage" | "services">("airlines");
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
        <div className="flex gap-1 border-b border-border bg-card px-4 pt-3">
          {(["airlines", "locations", "luggage", "services"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-md px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                tab === t ? "bg-background text-navy ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "locations" ? "airports" : t}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "airlines" && <AirlinesManager items={airlines} />}
          {tab === "locations" && <LocationsManager items={locations} />}
          {tab === "luggage" && <LuggageManager items={luggages} />}
          {tab === "services" && <ServicesManager items={services} />}
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

