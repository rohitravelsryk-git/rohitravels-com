import { serviceImageFor } from "@/routes/index";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import {
  Plane,
  MapPin,
  Luggage,
  Layers,
  Building2,
  Users,
  Mail,
  Plus,
  Pencil,
  Trash2,
  LogOut,
  Home,
  Check,
  X,
  Edit3,
  Globe2,
  Briefcase,
  Landmark,
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  Image as ImageIcon,
} from "lucide-react";
import {
  adminLogout,
  checkAdminUnlocked,
  listAirlines,
  createAirline,
  updateAirline,
  deleteAirline,
  bulkCreateAirlines,
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  bulkCreateLocations,
  listLuggage,
  createLuggage,
  updateLuggage,
  deleteLuggage,
  bulkCreateLuggage,
  listServices,
  createService,
  updateService,
  deleteService,
  bulkCreateServices,
  syncServicesToGoogleSheet,
  listVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  listAgentsAdmin,
  createAgentAdmin,
  updateAgentAdmin,
  deleteAgentAdmin,
  getPsf,
  listCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  type Country,
  type Airline,
  type Location,
  type LuggageOption,
  type InquiryService,
  type Vendor,
  type AgentRow,
} from "@/lib/fares.functions";
import {
  listBanksWallets,
  createBankWallet,
  updateBankWallet,
  deleteBankWallet,
  type BankWallet,
} from "@/lib/banks-wallets.functions";
import { setRegistrationVisibility } from "@/lib/agent-admin.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminPageHeading } from "@/components/AdminPageHeading";
import { AdminTabs } from "@/components/AdminTabs";
import { BookingEmailPreview } from "@/components/admin/email-preview/BookingEmailPreview";

export const Route = createFileRoute("/admin/addons")({
  head: () => ({
    meta: [
      { title: "Addons — Rohi Admin" },
      {
        name: "description",
        content: "Addons: airlines, airport locations, baggage allowances, and email previews.",
      },
    ],
  }),
  component: AddonsPage,
});

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
      width={128}
      height={64}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : i))}
    />
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
    <div className="rounded-2xl border border-dashed border-border bg-[var(--rohi-surface-muted)]/70 p-4">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--rohi-brand)] hover:underline"
      >
        {open ? "− Hide Bulk Import" : "+ Bulk Import Rows"}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={placeholder}
            className="w-full rounded-lg border border-input bg-background p-2.5 font-mono text-xs outline-none focus:border-[var(--rohi-brand)] focus:ring-1 focus:ring-[var(--rohi-brand)]"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-[var(--rohi-surface-strong)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--rohi-brand)] disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload All Rows"}
            </button>
            {msg && <span className="text-xs font-semibold text-[var(--rohi-brand)]">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const listInput = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--rohi-brand)] focus:ring-1 focus:ring-[var(--rohi-brand)]";
const actionBtn = "rounded-lg border border-border bg-background p-2 text-foreground transition hover:bg-muted";

function AirlinesManager({ items }: { items: Airline[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createAirline);
  const update = useServerFn(updateAirline);
  const bulk = useServerFn(bulkCreateAirlines);
  const remove = useServerFn(deleteAirline);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", iata_code: "", logo_url: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["airlines"] });

  async function add() {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName || !trimmedCode || busy) return;

    // Check for existing duplicate before making network request
    const existing = items.find(
      (a) => a.name.toLowerCase() === trimmedName.toLowerCase() || a.iata_code.toUpperCase() === trimmedCode
    );
    if (existing) {
      if (existing.name.toLowerCase() === trimmedName.toLowerCase()) {
        setErrorMsg(`"${existing.name}" is already in your airline list. Click the edit pencil icon below to update it.`);
      } else {
        setErrorMsg(`IATA code "${trimmedCode}" is already in use by "${existing.name}".`);
      }
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await create({ data: { name: trimmedName, iata_code: trimmedCode, logo_url: logo.trim() || null } });
      await refresh();
      setName(""); setCode(""); setLogo("");
      setSuccessMsg("Airline saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Add airline error:", err);
      setErrorMsg(err?.message || "Failed to add airline. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function save(id: string) {
    if (!draft.name.trim() || !draft.iata_code.trim()) return;
    await update({ data: { id, name: draft.name.trim(), iata_code: draft.iata_code.trim().toUpperCase(), logo_url: draft.logo_url?.trim() || null } });
    await refresh();
    setEditId(null);
  }
  async function del(id: string) {
    if (!confirm("Delete this airline?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--rohi-brand)]">Add New Airline</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Airline name (e.g. Flynas)"
            className={listInput}
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="IATA Code (e.g. XY)"
            maxLength={3}
            className={listInput}
          />
          <input
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="Logo URL (optional)"
            className={listInput}
          />
          <button
            type="button"
            onClick={add}
            disabled={!name.trim() || !code.trim() || busy}
            className="rounded-lg bg-[var(--rohi-surface-strong)] px-5 py-2 text-xs font-bold text-white transition hover:bg-[var(--rohi-brand)] disabled:opacity-50"
          >
            {busy ? "Adding Airline…" : "Add Airline"}
          </button>
        </div>
        {errorMsg && <p className="mt-2 text-xs font-semibold text-red-600">{errorMsg}</p>}
        {successMsg && <p className="mt-2 text-xs font-semibold text-emerald-600">{successMsg}</p>}
      </div>

      <BulkBox
        hint="One airline per line: Name, IATA, Logo URL (logo optional)."
        placeholder={"Flynas, XY\nQatar Airways, QR\nEmirates, EK"}
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

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Total Airlines: {items.length}
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {items.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No airlines configured yet.</li>
          )}
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-4 p-3.5 transition-colors hover:bg-[var(--rohi-surface-tint)] sm:p-4">
              <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-border">
                <AirlineImg airline={a} className="max-h-10 max-w-[72px] object-contain" />
              </div>
              {editId === a.id ? (
                <>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className={`flex-1 ${listInput}`}
                    placeholder="Airline name"
                  />
                  <input
                    value={draft.iata_code}
                    onChange={(e) => setDraft({ ...draft, iata_code: e.target.value.toUpperCase() })}
                    maxLength={3}
                    className={`w-20 ${listInput}`}
                    placeholder="IATA"
                  />
                  <input
                    value={draft.logo_url}
                    onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })}
                    placeholder="Logo URL"
                    className={`flex-1 ${listInput}`}
                  />
                  <button onClick={() => save(a.id)} className="rounded-lg bg-[var(--rohi-surface-strong)] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{a.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{a.iata_code}</p>
                  </div>
                  <button
                    onClick={() => { setEditId(a.id); setDraft({ name: a.name, iata_code: a.iata_code, logo_url: a.logo_url ?? "" }); }}
                    className={actionBtn}
                    title="Edit Airline"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => del(a.id)}
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    title="Delete Airline"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
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
    if (!city.trim() || !code.trim()) return;
    await create({ data: { city: city.trim().toUpperCase(), code: code.trim().toUpperCase(), urdu_name: urdu.trim() || null } });
    await refresh();
    setCity(""); setCode(""); setUrdu("");
  }
  async function save(id: string) {
    if (!draft.city.trim() || !draft.code.trim()) return;
    await update({ data: { id, city: draft.city.trim().toUpperCase(), code: draft.code.trim().toUpperCase(), urdu_name: draft.urdu_name?.trim() || null } });
    await refresh();
    setEditId(null);
  }
  async function del(id: string) {
    if (!confirm("Delete this location?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[var(--rohi-brand)]">Add New Airport / City Location</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value.toUpperCase())}
            placeholder="City (e.g. KARACHI)"
            className={listInput}
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Airport Code (e.g. KHI)"
            maxLength={4}
            className={listInput}
          />
          <input
            value={urdu}
            onChange={(e) => setUrdu(e.target.value)}
            placeholder="Urdu Name (e.g. کراچی)"
            dir="rtl"
            className={listInput}
          />
          <button
            onClick={add}
            disabled={!city.trim() || !code.trim()}
            className="rounded-lg bg-[var(--rohi-surface-strong)] px-5 py-2 text-xs font-bold text-white transition hover:bg-[var(--rohi-brand)] disabled:opacity-50"
          >
            Add Location
          </button>
        </div>
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

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Total Locations: {items.length} (used for departure and arrival selectors)
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {items.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No airport locations configured yet.</li>
          )}
          {items.map((l) => (
            <li key={l.id} className="flex items-center gap-4 p-3.5">
              {editId === l.id ? (
                <>
                  <input
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value.toUpperCase() })}
                    className={`flex-1 ${listInput}`}
                    placeholder="City"
                  />
                  <input
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                    maxLength={4}
                    className={`w-24 ${listInput}`}
                    placeholder="Code"
                  />
                  <input
                    value={draft.urdu_name}
                    onChange={(e) => setDraft({ ...draft, urdu_name: e.target.value })}
                    dir="rtl"
                    className={`flex-1 ${listInput}`}
                    placeholder="Urdu"
                  />
                  <button onClick={() => save(l.id)} className="rounded-lg bg-[var(--rohi-surface-strong)] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {l.city} <span className="font-mono text-xs text-muted-foreground">({l.code})</span>
                    </p>
                    {l.urdu_name && <p className="text-xs text-muted-foreground" dir="rtl">{l.urdu_name}</p>}
                  </div>
                  <button
                    onClick={() => { setEditId(l.id); setDraft({ city: l.city, code: l.code, urdu_name: l.urdu_name ?? "" }); }}
                    className={actionBtn}
                    title="Edit Location"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => del(l.id)}
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    title="Delete Location"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
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
    if (!label.trim()) return;
    await create({ data: { label: label.trim().toUpperCase() } });
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
    if (!confirm("Delete this baggage option?")) return;
    await remove({ data: { id } });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[var(--rohi-brand)]">Add Baggage Allowance Option</h4>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value.toUpperCase())}
            placeholder="Luggage label (e.g. 20+7KG, 30+7KG, 40KG)"
            className={listInput}
          />
          <button
            onClick={add}
            disabled={!label.trim()}
            className="shrink-0 rounded-lg bg-[var(--rohi-surface-strong)] px-5 py-2 text-xs font-bold text-white transition hover:bg-[var(--rohi-brand)] disabled:opacity-50"
          >
            Add Baggage Option
          </button>
        </div>
      </div>

      <BulkBox
        hint="One baggage label per line."
        placeholder={"20+7KG\n25+7KG\n30+7KG\n40KG"}
        onSubmit={async (lines) => {
          await bulk({ data: { labels: lines.map((l) => l.toUpperCase()) } });
          await refresh();
        }}
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Total Baggage Options: {items.length}
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {items.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No baggage options defined yet.</li>
          )}
          {items.map((l) => (
            <li key={l.id} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--rohi-surface-tint)] sm:p-4">
              {editId === l.id ? (
                <>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value.toUpperCase())}
                    className={`flex-1 ${listInput}`}
                    autoFocus
                  />
                  <button onClick={() => save(l.id)} className="rounded-lg bg-[var(--rohi-surface-strong)] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-semibold text-foreground">{l.label}</p>
                  <button
                    onClick={() => { setEditId(l.id); setEditLabel(l.label); }}
                    className={actionBtn}
                    title="Edit Baggage Option"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => del(l.id)}
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    title="Delete Baggage Option"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


function ServicesManager({ items }: { items: InquiryService[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createService);
  const update = useServerFn(updateService);
  const remove = useServerFn(deleteService);
  const syncSheet = useServerFn(syncServicesToGoogleSheet);

  const [label, setLabel] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState<number | "">("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    label: string;
    photo_url: string;
    description: string;
    sort_order: number;
  }>({ label: "", photo_url: "", description: "", sort_order: 100 });

  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const googleSheetUrl = "https://docs.google.com/spreadsheets/d/1QYY2RtXu3qxb9HpSanq5JSsjF_qgr9T05RbricOBGVM/edit#gid=1310579486";

  async function add() {
    const value = label.trim();
    if (!value || busy) return;
    if (items.some((item) => item.label.trim().toLowerCase() === value.toLowerCase())) {
      setError("A service with this name already exists.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const orderVal = typeof sortOrder === "number" ? sortOrder : (items.length + 1) * 10;
      await create({
        data: {
          label: value,
          photo_url: photoUrl.trim() || null,
          description: description.trim() || null,
          sort_order: orderVal,
        },
      });
      await qc.invalidateQueries({ queryKey: ["addons-services"] });
      await qc.invalidateQueries({ queryKey: ["inquiry-services"] });
      await qc.invalidateQueries({ queryKey: ["inquiry-services-public"] });
      setLabel("");
      setPhotoUrl("");
      setDescription("");
      setSortOrder("");
      setMessage("Service added and synced to Google Sheet successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add service.");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    const value = editDraft.label.trim();
    if (!value || busy) return;
    if (items.some((item) => item.id !== id && item.label.trim().toLowerCase() === value.toLowerCase())) {
      setError("Another service already uses this name.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await update({
        data: {
          id,
          label: value,
          photo_url: editDraft.photo_url.trim() || null,
          description: editDraft.description.trim() || null,
          sort_order: editDraft.sort_order,
        },
      });
      await qc.invalidateQueries({ queryKey: ["addons-services"] });
      await qc.invalidateQueries({ queryKey: ["inquiry-services"] });
      await qc.invalidateQueries({ queryKey: ["inquiry-services-public"] });
      setEditId(null);
      setMessage("Service updated and synced to Google Sheet.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update service.");
    } finally {
      setBusy(false);
    }
  }

  async function del(item: InquiryService) {
    if (!confirm(`Delete service "${item.label}"? Customer inquiry forms and packages may reference this service.`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await remove({ data: { id: item.id } });
      await qc.invalidateQueries({ queryKey: ["addons-services"] });
      await qc.invalidateQueries({ queryKey: ["inquiry-services"] });
      await qc.invalidateQueries({ queryKey: ["inquiry-services-public"] });
      setMessage("Service deleted and Google Sheet updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete service.");
    } finally {
      setBusy(false);
    }
  }

  async function onManualSync() {
    setSyncBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await syncSheet();
      if (res?.ok) {
        setMessage(`Successfully synced ${res.count} services to Google Sheets (Services tab).`);
      } else {
        setMessage("Services tab verified in Google Sheets.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync with Google Sheets.");
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Google Sheets Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--rohi-brand)]/20 bg-[var(--rohi-surface-tint)] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--rohi-brand)] text-white shadow-xs">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-foreground">Google Sheet: Services Tab</h4>
            <p className="text-xs text-muted-foreground">
              Live mirrored with service names, photo URLs, brief descriptions, and sort order.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void onManualSync()}
            disabled={syncBusy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-[var(--rohi-surface-muted)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncBusy ? "animate-spin text-[var(--rohi-brand)]" : ""}`} />
            {syncBusy ? "Syncing…" : "Sync with Sheet"}
          </button>
          <a
            href={googleSheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--rohi-surface-strong)] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--rohi-brand)]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open Services Tab
          </a>
        </div>
      </div>

      {/* Add New Service Form */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h3 className="text-base font-bold text-foreground">Add New Service</h3>
          <p className="text-xs text-muted-foreground">
            Configure travel services you sell to customers and agents with service photos, descriptions, and display order.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className="mb-1 block text-xs font-semibold text-foreground">Service Name *</label>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={80}
                placeholder="e.g. Umrah VIP Package"
                className={listInput}
                required
              />
            </div>

            <div className="lg:col-span-5">
              <label className="mb-1 block text-xs font-semibold text-foreground">Photo URL (Unsplash or direct image)</label>
              <input
                value={photoUrl}
                onChange={(event) => setPhotoUrl(event.target.value)}
                maxLength={800}
                placeholder="https://images.unsplash.com/..."
                className={listInput}
              />
            </div>

            <div className="lg:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-foreground">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value === "" ? "" : Number(event.target.value))}
                placeholder={`Default: ${(items.length + 1) * 10}`}
                className={listInput}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">Brief Description</label>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={400}
              placeholder="One or two sentences explaining this service, inclusions, and benefits..."
              className={listInput}
            />
          </div>

          {/* Photo Preview if given */}
          {photoUrl.trim() && (
            <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 p-2.5">
              <img
                src={photoUrl.trim()}
                alt="Service preview"
                className="h-12 w-16 rounded-lg object-cover border border-border shadow-2xs"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <span className="text-xs text-muted-foreground">Live image preview for customer-facing cards.</span>
            </div>
          )}

          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={!label.trim() || busy}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--rohi-surface-strong)] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--rohi-brand)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Add Service"}
            </button>
          </div>
        </form>

        {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{message}</p>}
      </section>

      {/* Services Catalogue List */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Services Catalogue</h3>
            <p className="text-xs text-muted-foreground">
              These services power inquiry dropdowns, public service showcases, and agent portals.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
            {items.length} total
          </span>
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {items.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">
              No services yet. Add your first service above.
            </li>
          )}
          {items.map((item) => {
            const isEditing = editId === item.id;
            const imgSrc = item.photo_url || serviceImageFor(item.label);

            return (
              <li
                key={item.id}
                className="p-4 transition-colors hover:bg-[var(--rohi-surface-tint)]"
              >
                {isEditing ? (
                  <div className="space-y-3 rounded-xl border border-[var(--rohi-brand)]/40 bg-card p-3 shadow-inner">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
                      <div className="lg:col-span-4">
                        <label className="text-[11px] font-semibold text-muted-foreground">Service Name</label>
                        <input
                          autoFocus
                          value={editDraft.label}
                          onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })}
                          maxLength={80}
                          className={listInput}
                        />
                      </div>
                      <div className="lg:col-span-5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Photo URL</label>
                        <input
                          value={editDraft.photo_url}
                          onChange={(e) => setEditDraft({ ...editDraft, photo_url: e.target.value })}
                          maxLength={800}
                          className={listInput}
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <label className="text-[11px] font-semibold text-muted-foreground">Sort Order</label>
                        <input
                          type="number"
                          value={editDraft.sort_order}
                          onChange={(e) => setEditDraft({ ...editDraft, sort_order: Number(e.target.value) || 0 })}
                          className={listInput}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">Brief Description</label>
                      <input
                        value={editDraft.description}
                        onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                        maxLength={400}
                        className={listInput}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        disabled={!editDraft.label.trim() || busy}
                        onClick={() => void save(item.id)}
                        className="rounded-lg bg-[var(--rohi-surface-strong)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--rohi-brand)] disabled:opacity-50"
                      >
                        <Check className="mr-1 inline h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className={actionBtn}
                      >
                        <X className="h-4 w-4" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative h-14 w-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
                        <img
                          src={imgSrc}
                          alt={item.label}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-sans text-sm font-bold text-foreground">{item.label}</h4>
                          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            Order: {item.sort_order ?? 100}
                          </span>
                        </div>
                        {item.description ? (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                        ) : (
                          <p className="mt-0.5 text-[11px] italic text-muted-foreground/60">No description added yet</p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(item.id);
                          setEditDraft({
                            label: item.label,
                            photo_url: item.photo_url || "",
                            description: item.description || "",
                            sort_order: item.sort_order ?? 100,
                          });
                          setError(null);
                        }}
                        className={actionBtn}
                        title={`Edit ${item.label}`}
                        aria-label={`Edit ${item.label}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void del(item)}
                        className="rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-destructive transition hover:bg-destructive/10"
                        title={`Delete ${item.label}`}
                        aria-label={`Delete ${item.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Logo URL first, then the first letter of the account name. */
function BankImg({ item, className }: { item: Pick<BankWallet, "name" | "logo_url">; className?: string }) {
  const sources = [item.logo_url?.trim() || null].filter(Boolean) as string[];
  const [failed, setFailed] = useState(0);
  useEffect(() => setFailed(0), [item.logo_url]);
  const src = sources[failed];
  if (!src) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--rohi-surface-tint)] text-sm font-bold text-[var(--rohi-brand)]">
        {item.name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return <img src={src} alt={`${item.name} logo`} className={className} loading="lazy" onError={() => setFailed((n) => n + 1)} />;
}

function BanksWalletsManager({ items }: { items: BankWallet[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createBankWallet);
  const update = useServerFn(updateBankWallet);
  const remove = useServerFn(deleteBankWallet);
  const blank = { name: "", kind: "bank" as "bank" | "wallet", logo_url: "" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState(blank);
  const refresh = () => qc.invalidateQueries({ queryKey: ["banks-wallets"] });

  async function add() {
    const name = form.name.trim();
    if (!name || busy) return;
    if (items.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      setErrorMsg(`"${name}" is already in your list. Use the edit pencil below to update it.`);
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await create({ data: { name, kind: form.kind, logo_url: form.logo_url } });
      await refresh();
      setForm(blank);
      setSuccessMsg("Saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    if (!draft.name.trim()) return;
    setErrorMsg(null);
    try {
      await update({ data: { id, name: draft.name.trim(), kind: draft.kind, logo_url: draft.logo_url } });
      await refresh();
      setEditId(null);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to update. Please try again.");
    }
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete "${name}" from the list?`)) return;
    setErrorMsg(null);
    try {
      await remove({ data: { id } });
      await refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to delete. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--rohi-brand)]">Add Account</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Account name (e.g. HBL)" className={listInput} />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "bank" | "wallet" })} className={listInput}>
            <option value="bank">Bank</option>
            <option value="wallet">Wallet</option>
          </select>
          <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="Logo URL (optional)" className={listInput} />
          <button
            type="button"
            onClick={add}
            disabled={!form.name.trim() || busy}
            className="rounded-lg bg-[var(--rohi-surface-strong)] px-5 py-2 text-xs font-bold text-white transition hover:bg-[var(--rohi-brand)] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Add Bank / Wallet"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Your Accounts Book banks and wallets are listed here. Paste a direct https logo image link to set or change a logo; without one, the first letter of the name is shown.</p>
        {errorMsg && <p className="mt-2 text-xs font-semibold text-red-600">{errorMsg}</p>}
        {successMsg && <p className="mt-2 text-xs font-semibold text-emerald-600">{successMsg}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Total Banks &amp; Wallets: {items.length}</p>
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {items.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No banks or wallets added yet.</li>}
          {items.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-4 p-3.5 transition-colors hover:bg-[var(--rohi-surface-tint)] sm:p-4">
              <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-border">
                <BankImg item={editId === b.id ? { name: draft.name || b.name, logo_url: draft.logo_url } : b} className="max-h-10 max-w-[72px] object-contain" />
              </div>
              {editId === b.id ? (
                <>
                  <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`flex-1 ${listInput}`} placeholder="Name" />
                  <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as "bank" | "wallet" })} className={`w-28 ${listInput}`}>
                    <option value="bank">Bank</option>
                    <option value="wallet">Wallet</option>
                  </select>
                  <input value={draft.logo_url} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} placeholder="Logo URL (optional)" className={`flex-1 ${listInput}`} />
                  <button onClick={() => save(b.id)} className="rounded-lg bg-[var(--rohi-surface-strong)] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-semibold text-foreground">{b.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{b.kind}</p>
                  </div>
                  <div className="min-w-[160px] flex-1 truncate text-xs text-muted-foreground">
                    {b.logo_url ? "Custom logo set" : "Automatic initials logo"}
                  </div>
                  <button
                    onClick={() => { setEditId(b.id); setDraft({ name: b.name, kind: b.kind, logo_url: b.logo_url ?? "" }); }}
                    className={actionBtn}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => del(b.id, b.name)}
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AddonsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useServerFn(adminLogout);
  async function onLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    router.navigate({ to: "/admin" });
  }

  const [tab, setTab] = useState<"airlines" | "locations" | "luggage" | "services" | "banks-wallets" | "dropdown-addons" | "email-preview">("airlines");

  const { data: airlines = [] } = useQuery({ queryKey: ["airlines"], queryFn: () => listAirlines() });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const { data: luggages = [] } = useQuery({ queryKey: ["luggage"], queryFn: () => listLuggage() });
  const { data: services = [] } = useQuery({ queryKey: ["addons-services"], queryFn: () => listServices() });
  const { data: banksWallets = [] } = useQuery({ queryKey: ["banks-wallets"], queryFn: () => listBanksWallets() });

  const tabs = [
    { key: "airlines" as const, label: "Airlines", icon: Plane, count: airlines.length },
    { key: "locations" as const, label: "Airports & Locations", icon: MapPin, count: locations.length },
    { key: "luggage" as const, label: "Baggage Allowances", icon: Luggage, count: luggages.length },
    { key: "services" as const, label: "Services", icon: Briefcase, count: services.length },
    { key: "banks-wallets" as const, label: "Banks & Wallets", icon: Landmark, count: banksWallets.length },
    { key: "email-preview" as const, label: "Email Previews", icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Standard Admin Header */}
      <header className="border-b border-[rgba(255,255,255,0.10)] bg-navy text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-white" />
            <div>
              <p className="font-sans text-lg font-semibold text-white">Admin Panel</p>
              <p className="text-[11px] font-medium text-white/70">Manage Addons &amp; Master Lists</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdminHeaderExtras />
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3d3d3a] bg-[#262624] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-[#55554f] hover:bg-[#34342f]"
            >
              <Home className="h-3.5 w-3.5" /> Home
            </a>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <AdminPageHeading
          icon={Layers}
          label="Addons"
          description="Configure booking addons and master list values used by the booking engine."
        />

        {/* Section Navigation Tabs */}
        <div className="mb-6">
          <nav aria-label="System Lists Sub-navigation" className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-[var(--rohi-surface-muted)] p-1.5 shadow-sm">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                    active
                      ? "bg-[var(--rohi-surface-strong)] text-[var(--rohi-text-inverse)] shadow-sm"
                      : "bg-[var(--rohi-surface-muted)] text-muted-foreground hover:bg-[var(--rohi-surface-tint)] hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-[var(--rohi-brand)]" : ""}`} />
                  <span>{t.label}</span>
                  {typeof t.count === "number" && (
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                        active ? "bg-white/15 text-[var(--rohi-text-inverse)]" : "bg-[var(--rohi-surface-tint)] text-muted-foreground"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Panel */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          {tab === "airlines" && <AirlinesManager items={airlines} />}
          {tab === "locations" && <LocationsManager items={locations} />}
          {tab === "luggage" && <LuggageManager items={luggages} />}
          {(tab === "services" || (tab as string) === "dropdown-addons") && <ServicesManager items={services} />}
          {tab === "banks-wallets" && <BanksWalletsManager items={banksWallets} />}
          {tab === "email-preview" && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-base font-bold text-foreground">Agent Booking Email Previews</h3>
                <p className="text-xs text-muted-foreground">
                  Preview how agents receive automated booking confirmations and vouchers across different email templates.
                </p>
              </div>
              <BookingEmailPreview />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
