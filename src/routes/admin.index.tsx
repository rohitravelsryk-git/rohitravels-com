import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, LogOut, Trash2, Plus, Edit3, Search, X, Check, Settings, ChevronDown, Copy, Ticket, Stamp, KeyRound, Pencil, Zap, MessageSquare, Sparkles } from "lucide-react";
import { ChangePasswordDialog, ForgotPasswordDialog } from "@/components/AdminPasswordDialogs";
import { formatFare } from "@/routes/index";
import { buildFareShareText } from "@/lib/fare-format";
import { FormatMakerDialog } from "@/components/FormatMakerDialog";
import { AdminTabs } from "@/components/AdminTabs";
import { setRegistrationVisibility } from "@/lib/agent-admin.functions";
import { IdleSessionGuard } from "@/components/IdleSessionGuard";
import {
  adminLogout,
  adminUnlock,
  staffUnlock,
  verifyLoginCode,
  resendLoginCode,

  checkAdminUnlocked,
  createFare,
  deleteFare,
  verifyAdminPassword,
  listFaresAdmin,
  updateFare,
  listAirlines,
  createAirline,
  updateAirline,
  bulkCreateAirlines,
  deleteAirline,
  listLocations,
  createLocation,
  updateLocation,
  bulkCreateLocations,
  deleteLocation,
  listLuggage,
  createLuggage,
  updateLuggage,
  bulkCreateLuggage,
  deleteLuggage,
  listServices,
  createService,
  updateService,
  bulkCreateServices,
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
  // Use fare_id to accurately count sold seats for this specific group
  return tickets
    .filter((t) => t.booking_id && t.fare_id === f.id)
    .reduce((sum, t) => sum + (Number(t.seats) || 1), 0);
}

function seatsDisplay(f: Fare, tickets: GroupTicket[]) {
  const isSelf = f.group_type === "self";
  const currentSeats = String(f.seats || "");
  const match = currentSeats.match(/(\d+)\s+out\s+of\s+(\d+)/i);
  
  if (match) {
    const available = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    
    if (available === 0 && isSelf) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-navy px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm ring-1 ring-navy/30">
          Sold
        </span>
      );
    }
    return `${available} out of ${total}`;
  }
  
  return f.seats || "—";
}

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
});

function AdminPage() {
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: "self" | "party" } | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [busyDelete, setBusyDelete] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const checkPw = useServerFn(verifyAdminPassword);
  const deleteFareFn = useServerFn(deleteFare);

  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });

  const qc = useQueryClient();


  async function doDelete() {
    if (!confirmDelete) return;
    
    // Party groups don't require password, but we still need to confirm
    if (confirmDelete.type === "party") {
      setBusyDelete(true);
      setDeleteErr(null);
      try {
        await deleteFareFn({ data: { id: confirmDelete.id } });
        await qc.invalidateQueries({ queryKey: ["fares", "admin"] });
        setConfirmDelete(null);
      } catch (e: any) {
        setDeleteErr(e.message || "Deletion failed.");
      } finally {
        setBusyDelete(false);
      }
      return;
    }

    // Self groups require password
    if (!deletePassword) return;
    setBusyDelete(true);
    setDeleteErr(null);
    try {
      const { ok } = await checkPw({ data: { password: deletePassword } });
      if (!ok) {
        setDeleteErr("Incorrect admin password.");
        return;
      }
      await deleteFareFn({ data: { id: confirmDelete.id } });
      await qc.invalidateQueries({ queryKey: ["fares", "admin"] });
      setConfirmDelete(null);
      setDeletePassword("");
    } catch (e: any) {
      setDeleteErr(e.message || "Deletion failed.");
    } finally {
      setBusyDelete(false);
    }
  }




  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  return status?.unlocked ? (
    <AdminPanel 
      staffTabs={status.staffTabs} 
      staffUsername={status.staffUsername} 
      confirmDelete={confirmDelete}
      setConfirmDelete={setConfirmDelete}
      deletePassword={deletePassword}
      setDeletePassword={setDeletePassword}
      busyDelete={busyDelete}
      deleteErr={deleteErr}
      setDeleteErr={setDeleteErr}
      doDelete={doDelete}
    />
  ) : (
    <UnlockScreen />
  );
}

function UnlockScreen() {
  const unlock = useServerFn(adminUnlock);
  const staffLogin = useServerFn(staffUnlock);
  const verifyCode = useServerFn(verifyLoginCode);
  const resend = useServerFn(resendLoginCode);
  const qc = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<"admin" | "staff">("admin");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [step, setStep] = useState<"password" | "code">("password");
  const [challenge, setChallenge] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = mode === "admin"
        ? await unlock({ data: { password } })
        : await staffLogin({ data: { username, password } });
      if (!res.ok) {
        setErr(mode === "admin" ? "Incorrect password" : "Invalid staff credentials or account inactive");
        return;
      }
      setChallenge(res.challenge);
      setMaskedEmail(res.maskedEmail);
      setStep("code");
      setNote(res.sent
        ? `Verification code sent to ${res.maskedEmail}.`
        : "Code created, but the email could not be delivered.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyCode({ data: { challenge, code: code.trim(), mode } });
      if (!res.ok) {
        setErr(res.error ?? "Incorrect code");
        if (/again/i.test(res.error ?? "")) { setStep("password"); setCode(""); }
        return;
      }
      await qc.invalidateQueries({ queryKey: ["admin", "status"] });
      await router.invalidate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const fieldCls = "mt-4 w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4 py-10">
      <form
        onSubmit={step === "password" ? submit : submitCode}
        className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-[var(--shadow-hero)] ring-1 ring-border sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy">
          <Plane className="h-6 w-6 -rotate-45 text-gold" />
        </div>
        <h1 className="mt-4 text-center font-serif text-2xl font-black text-navy">
          {step === "code" ? "Two-step verification" : mode === "admin" ? "Admin Access" : "Staff Access"}
        </h1>
        <p className="mt-1 text-center text-xs text-navy/60">
          {step === "code"
            ? `Enter the 6-digit code emailed to ${maskedEmail}`
            : mode === "admin"
              ? "Enter the admin password to manage fares"
              : "Enter your staff username and password"}
        </p>

        {step === "password" ? (
          <>
            {/* Mode toggle */}
            <div className="mt-5 flex rounded-lg border border-border bg-background p-1">
              <button
                type="button"
                onClick={() => { setMode("admin"); setErr(null); }}
                className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${
                  mode === "admin" ? "bg-navy text-navy-foreground" : "text-navy/60 hover:text-navy"
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { setMode("staff"); setErr(null); }}
                className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${
                  mode === "staff" ? "bg-navy text-navy-foreground" : "text-navy/60 hover:text-navy"
                }`}
              >
                Staff
              </button>
            </div>

            {mode === "staff" && (
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Staff Username"
                className={fieldCls}
              />
            )}
            <input
              type="password"
              autoFocus={mode === "admin"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={fieldCls}
            />
            {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
            <button
              disabled={busy || !password || (mode === "staff" && !username)}
              className="mt-4 w-full rounded-lg bg-navy py-3 text-sm font-bold text-navy-foreground hover:opacity-95 disabled:opacity-60"
            >
              {busy ? "Checking…" : "Continue"}
            </button>
            <p className="mt-3 text-center text-[11px] text-navy/60">
              A one-time code is emailed before access is granted.
            </p>
            {mode === "admin" && (
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="mt-3 w-full text-center text-xs font-semibold text-navy underline underline-offset-2 hover:text-gold"
              >
                Forgot password?
              </button>
            )}
          </>
        ) : (
          <>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="mt-5 w-full rounded-lg border border-input bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            {note && !err && <p className="mt-2 text-xs font-semibold text-emerald-700">{note}</p>}
            {err && <p className="mt-2 text-xs font-semibold text-destructive">{err}</p>}
            <button
              disabled={busy || code.length < 6}
              className="mt-4 w-full rounded-lg bg-navy py-3 text-sm font-bold text-navy-foreground hover:opacity-95 disabled:opacity-60"
            >
              {busy ? "Verifying…" : "Verify & Unlock"}
            </button>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <button type="button" onClick={() => { setStep("password"); setCode(""); setErr(null); }}
                className="font-semibold text-navy/60 underline underline-offset-2">Back</button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true); setErr(null);
                  try {
                    const r = await resend({ data: { challenge, mode } });
                    if (r.ok) { setChallenge(r.challenge); setNote(`New code sent to ${r.maskedEmail}.`); }
                    else setErr(r.error ?? "Please sign in again.");
                  } finally { setBusy(false); }
                }}
                className="font-semibold text-navy underline underline-offset-2 hover:text-gold"
              >
                Resend code
              </button>
            </div>
          </>
        )}
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
  return_details_raw: string;
  is_return: boolean;
  pnr: string;
  hide_fare_after_2h: boolean;
  auto_hide_hours: number;
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
  price_text: "",
  vendor_fare: "",
  vendor_name: "",
  flight_details_raw: "",
  return_details_raw: "",
  is_return: false,
  pnr: "",
  hide_fare_after_2h: true,
  auto_hide_hours: 2,
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

function iataOf(a: Airline | undefined) {
  return (a?.iata_code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function logoFor(a: Airline | undefined) {
  if (!a) return null;
  if (a.logo_url && a.logo_url.trim()) return a.logo_url.trim();
  const code = iataOf(a);
  return AIRLINE_LOGO_OVERRIDES[code] || `https://daisycon.io/images/airline/?width=900&height=450&color=ffffff00&iata=${code}`;
}

/** High-quality fallback chain used when the primary logo source fails. */
function logoFallbacks(a: Airline | undefined) {
  const code = iataOf(a);
  if (!code) return [];
  return [
    AIRLINE_LOGO_OVERRIDES[code],
    `https://daisycon.io/images/airline/?width=900&height=450&color=ffffff00&iata=${code}`,
    `https://images.kiwi.com/airlines/128/${code}.png`,
    `https://pics.avs.io/200/80/${code}@2x.png`,
  ].filter(Boolean) as string[];
}

function AirlineImg({ airline, className }: { airline: Airline | undefined; className?: string }) {
  const chain = useMemo(() => {
    const first = logoFor(airline);
    return [first, ...logoFallbacks(airline)].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i) as string[];
  }, [airline]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [chain[0]]);
  const src = chain[idx];
  if (!src) return <span className="text-[10px] text-muted-foreground">—</span>;
  
  return (
    <img
      src={src}
      alt={airline?.name ?? ""}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : i))}
    />
  );
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

function AdminPanel({ 
  staffTabs, 
  staffUsername,
  confirmDelete,
  setConfirmDelete,
  deletePassword,
  setDeletePassword,
  busyDelete,
  deleteErr,
  setDeleteErr,
  doDelete
}: { 
  staffTabs?: string[] | null; 
  staffUsername?: string | null;
  confirmDelete: { id: string; type: "self" | "party" } | null;
  setConfirmDelete: (v: { id: string; type: "self" | "party" } | null) => void;
  deletePassword: string;
  setDeletePassword: (v: string) => void;
  busyDelete: boolean;
  deleteErr: string | null;
  setDeleteErr: (v: string | null) => void;
  doDelete: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const create = useServerFn(createFare);
  const update = useServerFn(updateFare);
  const remove = useServerFn(deleteFare);
  const verifyPw = useServerFn(verifyAdminPassword);

  const { data: fares = [] } = useQuery<Fare[]>({ queryKey: ["fares", "admin"], queryFn: () => listFaresAdmin({ data: { includeDeleted: false } }), refetchInterval: 30000 });
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
      pnr: d.pnr || null,
      hide_fare_after_2h: d.hide_fare_after_2h,
      auto_hide_hours: d.auto_hide_hours,
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
    const [dep, ret] = (f.flight_details || "").split("--- RETURN ---").map(s => s.trim());
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
      flight_details_raw: dep || (f.flight_details || ""),
      return_details_raw: ret || "",
      is_return: Boolean(ret),
      pnr: f.pnr || "",
      hide_fare_after_2h: f.hide_fare_after_2h,
      auto_hide_hours: f.auto_hide_hours ?? 2,
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

  async function onDelete(id: string, type: string) {
    setConfirmDelete({ id, type: type as "self" | "party" });
  }


  async function onLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    await router.invalidate();
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Manage Group Fares</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowChangePw(true)}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <KeyRound className="h-3.5 w-3.5" /> Change password
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Settings className="h-3.5 w-3.5" /> Themes
            </button>
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              View site
            </a>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFormatMaker(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gold-foreground shadow-sm hover:opacity-95"
              >
                <Sparkles className="h-3 w-3" /> Format Maker
              </button>
              <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            </div>
          </div>


        <AdminTabs staffTabs={staffTabs} panelRole={staffUsername ? "staff" : "admin"} />
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <Ticket className="h-4 w-4" /> Group Fares
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{fares.length}</span>
          </div>
          <div className="flex gap-2">
            <FormatMakerDialog
              open={showFormatMaker}
              onClose={() => setShowFormatMaker(false)}
              airlines={airlines}
              luggage={luggages}
            />
          </div>
        </div>

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
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="text-base font-black tabular-nums text-navy">{filtered.length}</span> {filtered.length === 1 ? "entry" : "entries"}
            </p>
            <button
              onClick={() => setShowFormatMaker(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-black uppercase tracking-widest text-gold-foreground shadow-sm hover:opacity-95"
            >
              ✨ Format Maker
            </button>
            <button
              onClick={() => setShowAddRow(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-xs font-black uppercase tracking-widest text-gold-foreground shadow-sm hover:opacity-95"
            >
              <Plus className="h-4 w-4" /> Add Fare
            </button>
          </div>
        </div>


        {/* Add fare — separate modal with clear labelled fields */}
        {showAddRow && (
          <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-navy/60 p-4 backdrop-blur-sm">
            <div className="my-6 w-full max-w-4xl overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border">

              <div className="flex items-center justify-between gap-4 bg-[#0b1220] px-6 py-4 text-white">
                <div>
                  <p className="font-serif text-xl font-black">Add New Group Fare</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">Fill each field below — sector is generated automatically</p>
                </div>
                <button onClick={() => setShowAddRow(false)} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[72vh] overflow-y-auto bg-secondary/20 px-7 py-6">
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                  <Field label="Group Type">
                    <select value={draft.group_type} onChange={(e)=>setDraft({...draft, group_type: e.target.value as "self"|"party"})} className={inputBase}>
                      <option value="party">Party Group</option><option value="self">Self Group</option>
                    </select>
                  </Field>

                  <Field label="Airline" hint="Logo preview">
                    <div className={`${shellBase} gap-3`}>
                      <LogoPreview airline={airlineByName.get(draft.airline)} />
                      <div className="min-w-0 flex-1"><SelectCell value={draft.airline} onChange={(v)=>setDraft({...draft, airline: v})} options={airlines.map((a)=>a.name)} keywords={airlineKeywords} placeholder="Choose airline…" /></div>
                    </div>
                  </Field>

                  <Field label="From (Origin)">
                    <div className={shellBase}>
                      {draft.origin_code && <span className={chipBase}>{draft.origin_code}</span>}
                      <div className="min-w-0 flex-1"><SelectCell value={draft.origin} onChange={(v)=>setDraft(pickOrigin(draft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="Departure city…" /></div>
                    </div>
                  </Field>

                  <Field label="To (Destination)">
                    <div className={shellBase}>
                      {draft.destination_code && <span className={chipBase}>{draft.destination_code}</span>}
                      <div className="min-w-0 flex-1"><SelectCell value={draft.destination} onChange={(v)=>setDraft(pickDestination(draft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="Arrival city…" /></div>
                    </div>
                  </Field>

                  <div className="md:col-span-2">
                    <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={draft.is_return} 
                        onChange={(e) => setDraft({...draft, is_return: e.target.checked})}
                        className="h-4 w-4 rounded border-navy/30 text-gold focus:ring-gold"
                      />
                      <span>Return Group Fare (Umrah)</span>
                    </label>
                  </div>

                  <div className={draft.is_return ? "md:col-span-1" : "md:col-span-2"}>
                    <Field label={draft.is_return ? "Departure Flight Details" : "Flight Details"} hint="One flight per line">
                      <div className="rounded-xl border border-border bg-background px-3 py-2">
                        <MultiLineCell value={draft.flight_details_raw} onChange={(v)=>setDraft({...draft, flight_details_raw: v})} />
                      </div>
                    </Field>
                  </div>

                  {draft.is_return && (
                    <div className="md:col-span-1">
                      <Field label="Return Flight Details" hint="One flight per line">
                        <div className="rounded-xl border border-border bg-background px-3 py-2">
                          <MultiLineCell value={draft.return_details_raw} onChange={(v)=>setDraft({...draft, return_details_raw: v})} />
                        </div>
                      </Field>
                    </div>
                  )}

                  <Field label="Baggage">
                    <div className={shellBase}>
                      <div className="min-w-0 flex-1"><SelectCell value={draft.baggage} onChange={(v)=>setDraft({...draft, baggage: v})} options={luggages.map((l)=>l.label)} placeholder="Choose luggage…" /></div>
                    </div>
                  </Field>

                  <Field label="Fare" hint="Number or FARE ON WHATSAPP">
                    <div className={shellBase}><div className="min-w-0 flex-1"><Cell value={draft.price_text} onChange={(v)=>setDraft({...draft, price_text: v})} placeholder="e.g. 92,500" /></div></div>
                  </Field>

                  <Field label="Meal">
                    <select value={draft.meal} onChange={(e)=>setDraft({...draft, meal: e.target.value})} className={inputBase}>
                      <option value="">Select meal…</option><option value="Included">Included</option><option value="Not Included">Not Included</option>
                    </select>
                  </Field>

                  <Field label="Seats Available" hint="Block size">
                    <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-background">
                      <button type="button" onClick={()=>setDraft({...draft, seats: String(Math.max(0, (parseInt(draft.seats || "0", 10) || 0) - 1))})} className="w-12 shrink-0 border-r border-border text-lg font-bold text-muted-foreground hover:bg-secondary">−</button>
                      <input value={draft.seats} onChange={(e)=>setDraft({...draft, seats: e.target.value})} placeholder="0" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-center text-base font-black text-navy outline-none" />
                      <button type="button" onClick={()=>setDraft({...draft, seats: String((parseInt(draft.seats || "0", 10) || 0) + 1)})} className="w-12 shrink-0 border-l border-border text-lg font-bold text-muted-foreground hover:bg-secondary">+</button>
                    </div>
                  </Field>

                  <Field label="Sector" hint="Auto-translated from From / To">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-600/30 bg-emerald-50/70 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black tracking-wide text-navy">
                          {draft.origin_code || "—"} <span className="text-emerald-700">→</span> {draft.destination_code || "—"}
                        </p>
                        <p dir="rtl" className="truncate text-xs font-semibold text-navy/70">
                          {urduPair(draft.origin, draft.destination, locationByCity) || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-emerald-600/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-800">Auto</span>
                    </div>
                  </Field>

                  <div className="md:col-span-2 space-y-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hide_fare_after_2h"
                        checked={draft.hide_fare_after_2h}
                        onChange={(e) => setDraft({ ...draft, hide_fare_after_2h: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-gold focus:ring-gold"
                      />
                      <label htmlFor="hide_fare_after_2h" className="text-xs font-bold uppercase tracking-widest text-navy cursor-pointer">
                        Auto-hide Fare (Reset to "Fare On WhatsApp")
                      </label>
                    </div>
                    {draft.hide_fare_after_2h && (
                      <div className="flex items-center gap-3 pl-6">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">After how many hours?</span>
                        <select
                          value={draft.auto_hide_hours}
                          onChange={(e) => setDraft({ ...draft, auto_hide_hours: parseInt(e.target.value, 10) })}
                          className="rounded border border-border bg-background px-2 py-1 text-xs font-bold text-navy outline-none focus:ring-1 focus:ring-gold"
                        >
                          {[1, 2, 4, 6, 12, 24, 48, 72].map(h => (
                            <option key={h} value={h}>{h} {h === 1 ? 'Hour' : 'Hours'}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {draft.group_type === "self" && (
                    <Field label="PNR" hint="Passenger Name Record">
                      <div className={shellBase}>
                        <div className="min-w-0 flex-1">
                          <Cell 
                            value={draft.pnr} 
                            onChange={(v) => setDraft({ ...draft, pnr: v.toUpperCase() })} 
                            placeholder="Enter PNR code" 
                          />
                        </div>
                      </div>
                    </Field>
                  )}

                  <Field label="Vendor Fare" hint="Internal only">
                    <div className={shellBase}><div className="min-w-0 flex-1"><Cell value={draft.vendor_fare} onChange={(v)=>setDraft({...draft, vendor_fare: v})} placeholder="e.g. 88,000" /></div></div>
                  </Field>

                  <Field label="Vendor" hint="Supplier name or code">
                    <div className={shellBase}><div className="min-w-0 flex-1"><Cell value={draft.vendor_name} onChange={(v)=>setDraft({...draft, vendor_name: v})} placeholder="Vendor name" /></div></div>
                  </Field>

                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
                <button
                  onClick={() => setShowSettings(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-5 py-2 text-xs font-bold uppercase tracking-widest text-navy hover:bg-secondary"
                >
                  <Settings className="h-3.5 w-3.5" /> Manage lists
                </button>
                <div className="flex items-center gap-3">
                <button onClick={() => setShowAddRow(false)} className="rounded-full border border-border bg-card px-5 py-2 text-xs font-bold uppercase tracking-widest">Cancel</button>
                <button onClick={addRow} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-2 text-xs font-black uppercase tracking-widest text-gold-foreground hover:opacity-95 disabled:opacity-40">

                  <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save Fare"}
                </button>
                </div>
              </div>

            </div>
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

          // Show sector headings only when a search/filter is active; otherwise show one flat table.
          const hasFilter =
            search.trim().length > 0 ||
            destFilter !== "ALL" ||
            originFilter !== "ALL" ||
            airlineFilter !== "ALL" ||
            groupTypeFilter !== "ALL";

          return (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[74px]" />{/* GROUP */}
                  <col className="w-[78px]" />{/* AIRLINE */}
                  <col className="w-[84px]" />{/* FROM */}
                  <col className="w-[84px]" />{/* TO */}
                  <col className="w-[200px]" />{/* FLIGHT DETAILS */}
                  <col className="w-[72px]" />{/* LUGGAGE */}
                  <col className="w-[100px]" />{/* FARE */}
                  <col className="w-[72px]" />{/* MEAL */}
                  <col className="w-[88px]" />{/* SEATS */}
                  <col className="w-[118px]" />{/* SECTOR */}
                  <col className="w-[88px]" />{/* FARE ID */}
                  <col className="w-[76px]" />{/* V.FARE */}
                  <col className="w-[76px]" />{/* VENDOR */}
                  <col className="w-[90px]" />{/* PNR */}
                  <col className="w-[76px]" />{/* UPDATED */}
                  <col className="w-[140px]" />{/* ACTIONS */}
                </colgroup>
                <thead className="bg-[#0b1220] text-white">
                  <tr>
                    {[
                      "GROUP","AIRLINE","FROM","TO","FLIGHT DETAILS","LUGGAGE","FARE","MEAL","SEATS","SECTOR","FARE ID","V.FARE","VENDOR","PNR","UPDATED","ACTIONS",
                    ].map((label, i) => (
                      <th
                        key={i}
                        className="whitespace-nowrap border-r border-white/10 px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] last:border-r-0"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sectors.flatMap(([sector, rows]) => {
                    const out: React.ReactNode[] = [];
                    if (hasFilter) {
                      out.push(
                        <tr key={`hdr-${sector}`} className="bg-gradient-to-r from-amber-50 via-white to-amber-50">
                          <td colSpan={16} className="px-3 py-3">
                            <div className="flex items-center justify-center gap-3">
                              <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/70" />
                              <h2 className="font-serif text-2xl md:text-3xl font-bold tracking-[0.28em] text-navy">{sector}</h2>
                              <span className="text-2xl text-gold">✈</span>
                              <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/70" />
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    rows.forEach((f, idx) => {
                      const isEdit = editingId === f.id;
                      const air = airlineByName.get(isEdit ? editDraft.airline : f.airline);
                      const priceIsNumeric = /\d/.test(f.price_text || "");
                      const isSelf = f.group_type === "self";
                      const urdu = urduPair(f.origin, f.destination, locationByCity);
                      const total = parseSeatsTotal(f.seats);
                      const seats = seatsDisplay(f, tickets);
                      const details = (fareToRaw(f) || "").trim();
                      const mealVal = (f.meal ?? "").trim().toUpperCase();
                      const mealColor = mealVal === "NO" ? "text-red-600" : mealVal === "YES" ? "text-emerald-600" : "text-gray-700";

                      if (isEdit) {
                        out.push(
                          <tr key={f.id} className="border-t border-gold/60 bg-gold/10 align-top">
                            <td className="px-2 py-2">
                              <div className="w-full rounded border border-input bg-gray-100 px-2 py-1.5 text-xs font-black uppercase text-gray-600 cursor-not-allowed">
                                {editDraft.group_type === "self" ? "Self" : "Party"}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex flex-col items-center gap-1">
                                <LogoPreview airline={airlineByName.get(editDraft.airline)} />
                                <div className="w-full"><SelectCell value={editDraft.airline} onChange={(v)=>setEditDraft({...editDraft, airline: v})} options={airlines.map((a)=>a.name)} keywords={airlineKeywords} placeholder="Airline…" /></div>
                              </div>
                            </td>
                            <td className="px-2 py-2"><SelectCell value={editDraft.origin} onChange={(v)=>setEditDraft(pickOrigin(editDraft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="From…" /></td>
                            <td className="px-2 py-2"><SelectCell value={editDraft.destination} onChange={(v)=>setEditDraft(pickDestination(editDraft, v))} options={locations.map((l)=>l.city)} keywords={locationKeywords} placeholder="To…" /></td>
                            <td className="px-2 py-2">
                              <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-navy cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={editDraft.is_return} 
                                    onChange={(e) => setEditDraft({...editDraft, is_return: e.target.checked})}
                                    className="h-3 w-3 rounded border-navy/30 text-gold focus:ring-gold"
                                  />
                                  <span>Return</span>
                                </label>
                                <MultiLineCell value={editDraft.flight_details_raw} onChange={(v)=>setEditDraft({...editDraft, flight_details_raw: v})} />
                                {editDraft.is_return && (
                                  <div className="pt-2 border-t border-dashed border-gold/30">
                                    <p className="text-[9px] font-bold uppercase text-navy/60 mb-1">Return:</p>
                                    <MultiLineCell value={editDraft.return_details_raw} onChange={(v)=>setEditDraft({...editDraft, return_details_raw: v})} />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2"><SelectCell value={editDraft.baggage} onChange={(v)=>setEditDraft({...editDraft, baggage: v})} options={luggages.map((l)=>l.label)} placeholder="Baggage" /></td>
                            <td className="px-2 py-2"><Cell value={editDraft.price_text} onChange={(v)=>setEditDraft({...editDraft, price_text: v})} placeholder="Fare" /></td>
                            <td className="px-2 py-2">
                              <select value={editDraft.meal} onChange={(e)=>setEditDraft({...editDraft, meal: e.target.value})} className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-bold uppercase">
                                <option value="">Meal…</option><option value="Included">Included</option><option value="Not Included">Not Included</option>
                              </select>
                            </td>
                            <td className="px-2 py-2"><ComboCell listId={`seats-${f.id}`} value={editDraft.seats} onChange={(v)=>setEditDraft({...editDraft, seats: v})} options={SEATS_OPTIONS} placeholder="Seats" /></td>
                            <td className="px-2 py-2 text-center text-[10px] text-muted-foreground italic">(auto)</td>
                            <td className="px-2 py-2 text-center font-mono text-[9px] text-muted-foreground truncate" title={f.id}>{f.id.slice(0, 8)}...</td>
                            <td className="px-2 py-2"><Cell value={editDraft.vendor_fare} onChange={(v)=>setEditDraft({...editDraft, vendor_fare: v})} placeholder="V.Fare" /></td>
                            <td className="px-2 py-2"><Cell value={editDraft.vendor_name} onChange={(v)=>setEditDraft({...editDraft, vendor_name: v})} placeholder="Vendor" /></td>
                            <td className="px-2 py-2">
                              {isSelf && (
                                <input
                                  value={editDraft.pnr}
                                  onChange={(e) => setEditDraft({ ...editDraft, pnr: e.target.value.toUpperCase() })}
                                  placeholder="PNR"
                                  className={listInput}
                                />
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editDraft.hide_fare_after_2h}
                                  onChange={(e) => setEditDraft({ ...editDraft, hide_fare_after_2h: e.target.checked })}
                                  className="h-4 w-4 rounded border-gray-300 text-gold focus:ring-gold"
                                  title="Auto-hide"
                                />
                                {editDraft.hide_fare_after_2h && (
                                  <select
                                    value={editDraft.auto_hide_hours}
                                    onChange={(e) => setEditDraft({ ...editDraft, auto_hide_hours: parseInt(e.target.value, 10) })}
                                    className="rounded border border-border bg-background px-1 py-0.5 text-[9px] font-bold text-navy outline-none"
                                  >
                                    {[1, 2, 4, 6, 12, 24, 48, 72].map(h => (
                                      <option key={h} value={h}>{h}h</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
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
                        return;
                      }

                      out.push(
                        <tr
                          key={f.id}
                          className={`border-t border-gray-100 align-middle transition-colors hover:bg-amber-50/50 ${idx % 2 === 1 ? "bg-gray-50/60" : ""}`}
                        >
                          <td className="px-2 py-2.5 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${isSelf ? "bg-navy text-navy-foreground" : "bg-gold/20 text-navy ring-1 ring-gold/50"}`}>
                              {isSelf ? "SELF" : "PARTY"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center"><LogoPreview airline={air} /></td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-800">{(f.origin || "—").toUpperCase()}</div>
                            <div className="text-[11px] text-gray-500 font-bold">{f.origin_code?.toUpperCase()}</div>
                          </td>
                          <td className="px-2 py-2.5 text-center whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-800">{(f.destination || "—").toUpperCase()}</div>
                            <div className="text-[11px] text-gray-500 font-bold">{f.destination_code?.toUpperCase()}</div>
                          </td>
                          <td className="px-2 py-2.5 text-center font-mono text-[11px] leading-relaxed text-gray-700 whitespace-pre-line break-words">
                            {(() => {
                              const isReturn = f.flight_details?.includes("--- RETURN ---");
                              if (isReturn) {
                                const [dep, ret] = (f.flight_details || "").split("--- RETURN ---").map(s => s.trim());
                                return (
                                  <div className="flex flex-col gap-1 text-left px-2">
                                    <div className="text-[9px] font-black uppercase text-navy/40 border-b border-navy/10 pb-0.5 mb-0.5">Departure</div>
                                    <div className="mb-2">{dep}</div>
                                    <div className="text-[9px] font-black uppercase text-navy/40 border-b border-navy/10 pb-0.5 mb-0.5">Return</div>
                                    <div>{ret}</div>
                                  </div>
                                );
                              }
                              return details || "—";
                            })()}
                          </td>
                          <td className="px-2 py-2.5 text-center text-sm font-medium text-gray-700 whitespace-nowrap">{f.baggage || "—"}</td>
                          <td className="px-2 py-2.5 text-center">
                            {priceIsNumeric ? (
                              <span className="text-[17px] font-black tabular-nums text-orange-600 whitespace-nowrap">{formatFare(f.price_text)}</span>
                            ) : (
                              <span className="block text-[10px] font-black uppercase leading-[1.1] tracking-tight text-red-600 break-words">
                                {f.price_text}
                              </span>
                            )}
                          </td>
                          <td className={`px-2 py-2.5 text-center text-sm font-bold ${mealColor}`}>{f.meal || "—"}</td>
                          <td className="px-2 py-2.5 text-center text-sm font-bold whitespace-nowrap">
                            {seats}
                          </td>
                          <td dir="rtl" className="font-urdu px-2 py-2.5 text-center text-[28px] leading-[0.8] text-gray-900 whitespace-nowrap align-middle">
                            {urdu || "—"}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span className="text-[10px] font-mono font-bold text-gold-600">{f.id.slice(0, 8)}</span>
                          </td>
                          <td className="px-2 py-2.5 text-center text-sm font-black tabular-nums text-gray-800 whitespace-nowrap">
                            {f.vendor_fare || "—"}
                          </td>
                          <td className="px-2 py-2.5 text-center text-[11px] font-bold uppercase text-gray-600 whitespace-nowrap" title={f.vendor_name ?? ""}>
                            {f.vendor_name || "—"}
                          </td>
                          <td className="px-2 py-2.5 text-center text-[11px] font-bold text-navy truncate" title={f.pnr ?? ""}>
                            {f.pnr || "—"}
                          </td>
                          <td className="px-2 py-2.5 text-center text-[11px] font-semibold text-muted-foreground whitespace-nowrap" title={new Date(f.updated_at).toLocaleString()}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span>{timeAgo(f.updated_at)}</span>
                              {f.hide_fare_after_2h && (
                                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Auto-Hide ON</span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-wrap items-end justify-center gap-1">
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
                                onClick={() => setConfirmDelete({ id: f.id, type: f.group_type as "self" | "party" })}
                                className="rounded-full border border-destructive/30 bg-destructive/10 p-1.5 text-destructive transition hover:bg-destructive hover:text-destructive-foreground"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                    return out;
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}


        
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl ring-1 ring-gold/30">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="font-serif text-2xl font-black text-navy">Confirm Deletion</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You are about to delete a <span className="font-bold uppercase text-navy">{confirmDelete.type}</span> fare.
                {confirmDelete.type === "self" ? (
                  <>
                    <br />
                    Please enter the <span className="font-bold text-navy">Admin Password</span> to proceed.
                  </>
                ) : (
                  " Are you sure?"
                )}
              </p>
            </div>

            <div className="space-y-4">
              {confirmDelete.type === "self" && (
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Admin Password"
                    className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm font-semibold focus:border-gold focus:ring-1 focus:ring-gold/30"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && doDelete()}
                  />
                </div>
              )}

              {deleteErr && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-bold text-destructive ring-1 ring-destructive/20">
                  {deleteErr}
                </div>
              )}


              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setConfirmDelete(null);
                    setDeletePassword("");
                    setDeleteErr(null);
                  }}
                  className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-black uppercase tracking-wider text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => doDelete()}
                  disabled={busyDelete || (confirmDelete.type === "self" && !deletePassword)}
                  className="flex-1 rounded-xl bg-destructive py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg hover:opacity-90 disabled:opacity-50"
                >
                  {busyDelete ? "Deleting…" : "Delete Fare"}
                </button>

              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsDrawer
          onClose={() => setShowSettings(false)}
          airlines={airlines}
          locations={locations}
          luggages={luggages}
        />
      )}
      {showChangePw && <ChangePasswordDialog onClose={() => setShowChangePw(false)} />}
      <FormatMakerDialog 
        open={showFormatMaker} 
        onClose={() => setShowFormatMaker(false)} 
        airlines={airlines}
        luggage={luggages}
      />
      <IdleSessionGuard
        portalName="Admin Panel"
        onLogout={async () => {
          try { await logout(); } catch {}
          await qc.invalidateQueries({ queryKey: ["admin", "status"] });
          router.invalidate();
        }}
      />
    </div>
  );
}


function LogoPreview({ airline }: { airline: Airline | undefined }) {
  if (!airline) return <span className="text-[10px] text-muted-foreground">—</span>;
  return (
    <div className="mx-auto flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <AirlineImg airline={airline} className="max-h-16 max-w-16 object-contain" />
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
  const [tab, setTab] = useState<"airlines" | "locations" | "luggage" | "services" | "vendors">("airlines");
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
          {(["airlines", "locations", "luggage", "services", "vendors"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-md px-3 py-2 text-xs font-bold uppercase tracking-wider ${
                tab === t ? "bg-background text-navy ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "locations" ? "airports" : t === "luggage" ? "baggage" : t}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "airlines" && <AirlinesManager items={airlines} />}
          {tab === "locations" && <LocationsManager items={locations} />}
          {tab === "luggage" && <LuggageManager items={luggages} />}
          {tab === "services" && <ServicesManager items={services} />}
          
          {tab === "vendors" && <VendorsManager />}
        </div>
      </div>
    </div>
  );
}

function BulkBox({
  hint,
  placeholder,
  onSubmit,
}: {
  hint: string;
  placeholder: string;
  onSubmit: (lines: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    setMsg(null);
    try {
      await onSubmit(lines);
      setText("");
      setMsg(`Imported ${lines.length} row(s).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bulk upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-border">
      <button onClick={() => setOpen(!open)} className="text-[11px] font-bold uppercase tracking-wide text-navy">
        {open ? "− Hide bulk upload" : "+ Bulk upload"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">{hint}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={placeholder}
            className="w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={busy || !text.trim()}
              className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload all"}
            </button>
            {msg && <span className="text-[11px] text-muted-foreground">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const listInput = "rounded border border-input bg-background px-2 py-1.5 text-sm";
const iconBtn = "rounded border border-border bg-card p-1.5 text-navy hover:bg-muted";

function ServicesManager({ items }: { items: InquiryService[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createService);
  const update = useServerFn(updateService);
  const bulk = useServerFn(bulkCreateServices);
  const remove = useServerFn(deleteService);
  const [label, setLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["services"] });

  async function add() {
    if (!label.trim()) return;
    await create({ data: { label: label.trim(), sort_order: 100 } });
    await refresh();
    setLabel("");
  }
  async function save(id: string) {
    if (!editLabel.trim()) return;
    await update({ data: { id, label: editLabel.trim() } });
    await refresh();
    setEditId(null);
  }
  async function del(id: string) {
    if (!confirm("Delete this service?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Service name (e.g. Ticket Booking)" className={listInput} />
        <button onClick={add} disabled={!label.trim()} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <BulkBox
        hint="One service per line."
        placeholder={"Ticket Booking\nVisa Services\nUmrah Packages"}
        onSubmit={async (lines) => {
          await bulk({ data: { labels: lines } });
          await refresh();
        }}
      />
      <p className="text-[11px] text-muted-foreground">These appear in the "Service / Product" dropdown on the customer inquiry form.</p>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-3 py-2">
            {editId === s.id ? (
              <>
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className={`flex-1 ${listInput}`} />
                <button onClick={() => save(s.id)} className="rounded bg-navy px-2.5 py-1.5 text-[11px] font-bold text-navy-foreground">Save</button>
                <button onClick={() => setEditId(null)} className="rounded border border-border px-2.5 py-1.5 text-[11px] font-bold">Cancel</button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm font-semibold">{s.label}</p>
                <button onClick={() => { setEditId(s.id); setEditLabel(s.label); }} className={iconBtn}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => del(s.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}


function AirlinesManager({ items }: { items: Airline[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createAirline);
  const update = useServerFn(updateAirline);
  const bulk = useServerFn(bulkCreateAirlines);
  const remove = useServerFn(deleteAirline);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logo, setLogo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", iata_code: "", logo_url: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["airlines"] });

  async function add() {
    if (!name || !code) return;
    await create({ data: { name, iata_code: code, logo_url: logo || null } });
    await refresh();
    setName(""); setCode(""); setLogo("");
  }
  async function save(id: string) {
    if (!draft.name || !draft.iata_code) return;
    await update({ data: { id, name: draft.name, iata_code: draft.iata_code, logo_url: draft.logo_url || null } });
    await refresh();
    setEditId(null);
  }
  async function del(id: string) {
    if (!confirm("Delete this airline?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Airline name (Flynas)" className={listInput} />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="IATA (XY)" maxLength={3} className={listInput} />
        <input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="Logo URL (optional — auto by IATA)" className={listInput} />
        <button onClick={add} disabled={!name || !code} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <BulkBox
        hint="One airline per line: Name, IATA, Logo URL (logo optional — high-quality logos are fetched automatically from the IATA code)."
        placeholder={"Flynas, XY\nQatar Airways, QR\nEmirates, EK, https://example.com/ek.png"}
        onSubmit={async (lines) => {
          const rows = lines.map((l) => {
            const [n, c, u] = l.split(",").map((p) => (p ?? "").trim());
            if (!n || !c) throw new Error(`Invalid line: ${l}`);
            return { name: n, iata_code: c.toUpperCase(), logo_url: u || null };
          });
          await bulk({ data: { rows } });
          await refresh();
        }}
      />
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-white ring-1 ring-border">
              <AirlineImg airline={a} className="max-h-10 max-w-[72px] object-contain" />
            </div>
            {editId === a.id ? (
              <>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`flex-1 ${listInput}`} />
                <input value={draft.iata_code} onChange={(e) => setDraft({ ...draft, iata_code: e.target.value.toUpperCase() })} maxLength={3} className={`w-20 ${listInput}`} />
                <input value={draft.logo_url} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} placeholder="Logo URL" className={`flex-1 ${listInput}`} />
                <button onClick={() => save(a.id)} className="rounded bg-navy px-2.5 py-1.5 text-[11px] font-bold text-navy-foreground">Save</button>
                <button onClick={() => setEditId(null)} className="rounded border border-border px-2.5 py-1.5 text-[11px] font-bold">Cancel</button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{a.iata_code}</p>
                </div>
                <button onClick={() => { setEditId(a.id); setDraft({ name: a.name, iata_code: a.iata_code, logo_url: a.logo_url ?? "" }); }} className={iconBtn}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => del(a.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LocationsManager({ items }: { items: Location[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createLocation);
  const update = useServerFn(updateLocation);
  const bulk = useServerFn(bulkCreateLocations);
  const remove = useServerFn(deleteLocation);
  const [city, setCity] = useState("");
  const [code, setCode] = useState("");
  const [urdu, setUrdu] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ city: "", code: "", urdu_name: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["locations"] });

  async function add() {
    if (!city || !code) return;
    await create({ data: { city, code, urdu_name: urdu || null } });
    await refresh();
    setCity(""); setCode(""); setUrdu("");
  }
  async function save(id: string) {
    if (!draft.city || !draft.code) return;
    await update({ data: { id, city: draft.city, code: draft.code, urdu_name: draft.urdu_name || null } });
    await refresh();
    setEditId(null);
  }
  async function del(id: string) {
    if (!confirm("Delete this location?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={city} onChange={(e) => setCity(e.target.value.toUpperCase())} placeholder="City (KARACHI)" className={listInput} />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code (KHI)" maxLength={4} className={listInput} />
        <input value={urdu} onChange={(e) => setUrdu(e.target.value)} placeholder="Urdu name (کراچی)" className={listInput} />
        <button onClick={add} disabled={!city || !code} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <BulkBox
        hint="One location per line: City, Code, Urdu name (Urdu optional)."
        placeholder={"KARACHI, KHI, کراچی\nLAHORE, LHE, لاہور\nJEDDAH, JED"}
        onSubmit={async (lines) => {
          const rows = lines.map((l) => {
            const [c, cd, u] = l.split(",").map((p) => (p ?? "").trim());
            if (!c || !cd) throw new Error(`Invalid line: ${l}`);
            return { city: c.toUpperCase(), code: cd.toUpperCase(), urdu_name: u || null };
          });
          await bulk({ data: { rows } });
          await refresh();
        }}
      />
      <p className="text-[11px] text-muted-foreground">These are used for both "From" and "To" dropdowns.</p>
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-3 py-2">
            {editId === l.id ? (
              <>
                <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value.toUpperCase() })} className={`flex-1 ${listInput}`} />
                <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} maxLength={4} className={`w-24 ${listInput}`} />
                <input value={draft.urdu_name} onChange={(e) => setDraft({ ...draft, urdu_name: e.target.value })} dir="rtl" className={`flex-1 ${listInput}`} />
                <button onClick={() => save(l.id)} className="rounded bg-navy px-2.5 py-1.5 text-[11px] font-bold text-navy-foreground">Save</button>
                <button onClick={() => setEditId(null)} className="rounded border border-border px-2.5 py-1.5 text-[11px] font-bold">Cancel</button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{l.city} <span className="font-mono text-[10px] text-muted-foreground">({l.code})</span></p>
                  {l.urdu_name && <p className="text-xs text-muted-foreground">{l.urdu_name}</p>}
                </div>
                <button onClick={() => { setEditId(l.id); setDraft({ city: l.city, code: l.code, urdu_name: l.urdu_name ?? "" }); }} className={iconBtn}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => del(l.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LuggageManager({ items }: { items: LuggageOption[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createLuggage);
  const update = useServerFn(updateLuggage);
  const bulk = useServerFn(bulkCreateLuggage);
  const remove = useServerFn(deleteLuggage);
  const [label, setLabel] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["luggage"] });

  async function add() {
    if (!label) return;
    await create({ data: { label } });
    await refresh();
    setLabel("");
  }
  async function save(id: string) {
    if (!editLabel.trim()) return;
    await update({ data: { id, label: editLabel.trim().toUpperCase() } });
    await refresh();
    setEditId(null);
  }
  async function del(id: string) {
    if (!confirm("Delete?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-card p-3 ring-1 ring-border">
        <input value={label} onChange={(e) => setLabel(e.target.value.toUpperCase())} placeholder="Luggage label (25+7KG)" className={listInput} />
        <button onClick={add} disabled={!label} className="rounded bg-navy px-3 py-1.5 text-xs font-bold text-navy-foreground disabled:opacity-50">Add</button>
      </div>
      <BulkBox
        hint="One baggage label per line."
        placeholder={"25+7KG\n30+7KG\n20+05 KG"}
        onSubmit={async (lines) => {
          await bulk({ data: { labels: lines.map((l) => l.toUpperCase()) } });
          await refresh();
        }}
      />
      <ul className="divide-y divide-border rounded-lg ring-1 ring-border">
        {items.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-3 py-2">
            {editId === l.id ? (
              <>
                <input value={editLabel} onChange={(e) => setEditLabel(e.target.value.toUpperCase())} className={`flex-1 ${listInput}`} />
                <button onClick={() => save(l.id)} className="rounded bg-navy px-2.5 py-1.5 text-[11px] font-bold text-navy-foreground">Save</button>
                <button onClick={() => setEditId(null)} className="rounded border border-border px-2.5 py-1.5 text-[11px] font-bold">Cancel</button>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm font-semibold">{l.label}</p>
                <button onClick={() => { setEditId(l.id); setEditLabel(l.label); }} className={iconBtn}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => del(l.id)} className="rounded border border-destructive/30 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}



function AgentsManager() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({ queryKey: ["agents", "admin"], queryFn: () => listAgentsAdmin() });
  const { data: psfData } = useQuery({ queryKey: ["site-settings", "psf"], queryFn: () => getPsf() });
  const setVis = useServerFn(setRegistrationVisibility);
  
  const isVisible = !(psfData?.registrationHidden ?? false);
  const [visBusy, setVisBusy] = useState(false);

  async function toggleVisibility() {
    setVisBusy(true);
    try {
      await setVis({ data: { visible: !isVisible } });
      await qc.invalidateQueries({ queryKey: ["site-settings", "psf"] });
    } catch (e: any) {
      alert(e?.message ?? "Failed to update visibility");
    } finally {
      setVisBusy(false);
    }
  }

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
      <div className="flex items-center justify-between rounded-lg bg-navy/5 p-4 ring-1 ring-navy/10">
        <div>
          <p className="text-sm font-bold text-navy">Registration Page Visibility</p>
          <p className="text-[11px] text-muted-foreground">Hide or show the agent registration button and links on the website.</p>
        </div>
        <button
          onClick={toggleVisibility}
          disabled={visBusy}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 ${
            !isVisible ? "bg-slate-300" : "bg-emerald-500"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              !isVisible ? "translate-x-1" : "translate-x-6"
            }`}
          />
        </button>
      </div>

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

const inputBase =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/25";

const shellBase =
  "flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25";

const chipBase =
  "shrink-0 rounded-md bg-secondary px-2 py-1 text-[10px] font-black uppercase tracking-widest text-navy";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</label>
        {hint && <span className="shrink-0 text-[10px] font-semibold text-navy/50">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

