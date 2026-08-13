import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, LogOut, Trash2, Plus, Edit3, Search, X, Check, Settings, ChevronDown, Copy, Ticket, Stamp, KeyRound, Pencil, Zap, MessageSquare } from "lucide-react";
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
  const o = (f.origin_code || "").toUpperCase();
  const d = (f.destination_code || "").toUpperCase();
  if (!o || !d) return 0;
  return tickets
    .filter((t) => {
      const tokens = (t.sector || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
      return tokens.includes(o) && tokens.includes(d);
    })
    // a confirmed ticket may hold 1, several, or the full group's seats
    .reduce((sum, t) => sum + (Number(t.seats) || 1), 0);
}
function seatsDisplay(f: Fare, tickets: GroupTicket[]): string {
  const total = parseSeatsTotal(f.seats);
  if (!total) return f.seats || "—";
  const sold = soldForFare(f, tickets);
  const available = Math.max(total - sold, 0);
  return `${available} out of ${total}`;
}

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: (search.mode as string) || "list",
    editId: (search.editId as string) || undefined,
  }) as { mode?: string; editId?: string },
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


  async function doDelete(bypassPw = false, overrideId?: string) {
    const targetId = overrideId || confirmDelete?.id;
    if (!targetId) return;
    if (!bypassPw && !deletePassword) return;
    setBusyDelete(true);
    setDeleteErr(null);
    try {
      if (!bypassPw) {
        const { ok } = await checkPw({ data: { password: deletePassword } });
        if (!ok) {
          setDeleteErr("Incorrect admin password.");
          return;
        }
      }
      await deleteFareFn({ data: { id: targetId } });
      await qc.invalidateQueries({ queryKey: ["admin", "fares"] });
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
        <p className="mt-1 text-center text-xs text-muted-foreground">
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
                  mode === "admin" ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { setMode("staff"); setErr(null); }}
                className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition ${
                  mode === "staff" ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:text-foreground"
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
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
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
                className="font-semibold text-muted-foreground underline underline-offset-2">Back</button>
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
  doDelete: (bypassPw?: boolean, overrideId?: string) => Promise<void>;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();

  const [showSettings, setShowSettings] = useState(false);
  const [showFormatMaker, setShowFormatMaker] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [search, setSearch] = useState("");
  const [filterOrigin, setFilterOrigin] = useState("ALL");
  const [filterAirline, setFilterAirline] = useState("ALL");

  const { data: fares = [], isLoading: loadingFares } = useQuery({
    queryKey: ["admin", "fares"],
    queryFn: () => listFaresAdmin(),
  });

  const { data: airlines = [] } = useQuery({
    queryKey: ["airlines"],
    queryFn: () => listAirlines(),
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: () => listLocations(),
  });

  const { data: luggages = [] } = useQuery({
    queryKey: ["luggage"],
    queryFn: () => listLuggage(),
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => listTickets(),
  });

  const logout = useServerFn(adminLogout);

  const byCity = useMemo(() => new Map(locations.map((l) => [l.city, l])), [locations]);
  const airlineByIata = useMemo(() => {
    const m = new Map<string, Airline>();
    for (const a of airlines) {
      const code = (a.iata_code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (code) m.set(code, a);
    }
    return m;
  }, [airlines]);

  const filtered = useMemo(() => {
    let list = fares;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) =>
        [f.origin, f.destination, f.airline, f.flight_number].some((v) =>
          (v || "").toLowerCase().includes(q)
        )
      );
    }
    if (filterOrigin !== "ALL") {
      list = list.filter((f) => f.origin === filterOrigin);
    }
    if (filterAirline !== "ALL") {
      list = list.filter((f) => f.airline === filterAirline);
    }
    return list;
  }, [fares, search, filterOrigin, filterAirline]);

  const originOptions = useMemo(() => Array.from(new Set(fares.map((f) => f.origin))).sort(), [fares]);
  const airlineOptions = useMemo(() => Array.from(new Set(fares.map((f) => f.airline))).sort(), [fares]);

  return (
    <div className="min-h-screen bg-hero pb-20">
      <div className="sticky top-0 z-40 bg-navy shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/admin" className="flex items-center gap-2 transition-transform hover:scale-105">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
                <Plane className="h-6 w-6 -rotate-45 text-gold" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-serif text-lg font-black tracking-tight text-white">ROHI TRAVELS</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/80">Admin Panel</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {!staffUsername && (
              <button
                onClick={() => setShowSettings(true)}
                className="flex h-9 items-center gap-2 rounded-lg bg-white/10 px-4 text-[11px] font-bold uppercase tracking-wider text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <Settings className="h-4 w-4 text-gold" />
                Themes
              </button>
            )}
            <button
              onClick={() => setShowFormatMaker(true)}
              className="flex h-9 items-center gap-2 rounded-lg bg-gold px-4 text-[11px] font-bold uppercase tracking-wider text-navy shadow-lg transition hover:brightness-110"
            >
              <Zap className="h-4 w-4" />
              Format Maker
            </button>
            <div className="h-6 w-px bg-white/10" />
            <button
              onClick={() => setShowChangePw(true)}
              className="flex h-9 items-center gap-2 rounded-lg bg-white/5 px-4 text-[11px] font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <KeyRound className="h-4 w-4" />
              Security
            </button>
            <button
              onClick={async () => {
                try { await logout(); } catch {}
                await qc.invalidateQueries({ queryKey: ["admin", "status"] });
                router.invalidate();
              }}
              className="flex h-9 items-center gap-2 rounded-lg bg-destructive/10 px-4 text-[11px] font-bold uppercase tracking-wider text-destructive ring-1 ring-destructive/30 transition hover:bg-destructive hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Exit
            </button>
          </div>
        </div>
        <AdminTabs staffTabs={staffTabs} panelRole={staffUsername ? "staff" : "admin"} />
      </div>

      <div className="mx-auto mt-6 max-w-[1600px] px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-6 rounded-2xl bg-card p-6 shadow-[var(--shadow-hero)] ring-1 ring-border">
          <div className="flex flex-1 flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[280px]">
              <div className="group relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-gold" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search fares by origin, destination, airline..."
                  className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm font-semibold text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/25"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <FilterSelect
                label="Origin"
                value={filterOrigin}
                onChange={setFilterOrigin}
                options={originOptions}
                allLabel="All Origins"
              />
              <FilterSelect
                label="Airline"
                value={filterAirline}
                onChange={setFilterAirline}
                options={airlineOptions}
                allLabel="All Airlines"
              />
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/admin", search: { mode: "add" } })}
            className="flex h-12 items-center gap-2 rounded-xl bg-navy px-8 font-serif text-sm font-black uppercase tracking-wider text-white shadow-xl transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-5 w-5 text-gold" />
            Add New Fare
          </button>
        </div>

        {(() => {
          if (loadingFares) return <div className="py-20 text-center text-muted-foreground">Loading fares...</div>;
          if (!fares.length) return <div className="py-20 text-center text-muted-foreground">No fares found.</div>;
          
          const groups = Array.from(new Set(filtered.map(f => `${f.origin_code} to ${f.destination_code}`))).sort();
          
          return (
            <div className="space-y-8">
              <table className="w-full border-collapse overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-border">
                <thead className="bg-navy">
                  <tr className="text-[10px] font-black uppercase tracking-widest text-gold/90">
                    <th className="px-4 py-4 text-left">Group</th>
                    <th className="px-4 py-4 text-left">Airline</th>
                    <th className="px-4 py-4 text-left">Origin</th>
                    <th className="px-4 py-4 text-left">Dest</th>
                    <th className="px-4 py-4 text-left">Details</th>
                    <th className="px-4 py-4 text-left">Luggage</th>
                    <th className="px-4 py-4 text-left">Meal</th>
                    <th className="px-4 py-4 text-left">Seats</th>
                    <th className="px-4 py-4 text-left">Sector</th>
                    <th className="px-4 py-4 text-right">Fare</th>
                    <th className="px-4 py-4 text-right">V.Fare</th>
                    <th className="px-4 py-4 text-left">Vendor</th>
                    <th className="px-4 py-4 text-center">Updated</th>
                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {groups.map(sector => {
                    const sectorFares = filtered.filter(f => `${f.origin_code} to ${f.destination_code}` === sector);
                    const out: React.ReactNode[] = [];
                    out.push(
                      <tr key={`header-${sector}`} className="bg-navy/5">
                        <td colSpan={14} className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-navy">
                          {sector}
                        </td>
                      </tr>
                    );
                    sectorFares.forEach(f => {
                      const airline = airlineByIata.get(f.airline?.toUpperCase()?.replace(/[^A-Z0-9]/g, "") || "");
                      out.push(
                        <tr key={f.id} className="group transition hover:bg-gold/5">
                          <td className="px-4 py-3 text-xs font-bold text-navy">{f.group_type?.toUpperCase()}</td>
                          <td className="px-4 py-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white p-1">
                              <AirlineImg airline={airline} className="max-h-8 max-w-8 object-contain" />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-navy">{f.origin_code}</td>
                          <td className="px-4 py-3 text-xs font-bold text-navy">{f.destination_code}</td>
                          <td className="px-4 py-3">
                            <div className="max-w-[150px] truncate text-[11px] font-medium text-muted-foreground" title={f.flight_details || ""}>
                              {f.flight_details || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-navy">{f.baggage || "—"}</td>
                          <td className="px-4 py-3 text-xs font-bold text-navy">{f.meal || "—"}</td>
                          <td className="px-4 py-3 text-xs font-bold text-navy">{seatsDisplay(f, tickets)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col text-center">
                              <span className="font-urdu text-sm font-black leading-none text-navy">
                                {urduPair(f.origin, f.destination, byCity)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-black text-gold-dark">{f.price_text}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-bold text-muted-foreground">{f.vendor_fare || "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-navy">{f.vendor_name || "—"}</td>
                          <td className="px-4 py-3 text-center text-[10px] font-bold uppercase text-muted-foreground">
                            {timeAgo(f.updated_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Link
                                to="/admin"
                                search={{ mode: "edit", editId: f.id }}
                                className="rounded-full border border-gold/30 bg-gold/10 p-1.5 text-gold-dark transition hover:bg-gold hover:text-navy"
                                aria-label="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                onClick={() => {
                                  if (f.group_type === 'party') {
                                    if (confirm("Are you sure you want to delete this PARTY fare?")) {
                                      doDelete(true, f.id);
                                    }
                                  } else {
                                    setConfirmDelete({ id: f.id, type: "self" });
                                  }
                                }}
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

      {confirmDelete && confirmDelete.type === 'self' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-2xl ring-1 ring-gold/30">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="h-8 w-8" />
              </div>
              <h3 className="font-serif text-2xl font-black text-navy">Confirm Deletion</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                You are about to delete a <span className="font-bold uppercase text-navy">{confirmDelete.type}</span> fare.
                Please enter the <span className="font-bold text-navy">Admin Password</span> to proceed.
              </p>
            </div>

            <div className="space-y-4">
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
                  onKeyDown={(e) => e.key === "Enter" && doDelete(false)}
                />
              </div>

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
                  onClick={() => doDelete(false)}
                  disabled={busyDelete || !deletePassword}
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
      <FormatMakerDialog open={showFormatMaker} onClose={() => setShowFormatMaker(false)} />
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

