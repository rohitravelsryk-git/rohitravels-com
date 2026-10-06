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
import { setRegistrationVisibility } from "@/lib/agent-admin.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { BookingEmailPreview } from "@/components/admin/email-preview/BookingEmailPreview";

export const Route = createFileRoute("/admin/manage-lists")({
  head: () => ({
    meta: [
      { title: "Manage Lists — Rohi Admin" },
      {
        name: "description",
        content: "Manage airlines, airport locations, baggage allowances, customer inquiry services, vendors, and agents.",
      },
    ],
  }),
  component: ManageListsPage,
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
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D97757] hover:underline"
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
            className="w-full rounded-lg border border-input bg-background p-2.5 font-mono text-xs outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757]"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-[#141413] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
            >
              {busy ? "Uploading…" : "Upload All Rows"}
            </button>
            {msg && <span className="text-xs font-semibold text-[#D97757]">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const listInput = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-[#1C1917] outline-none focus:border-[#D97757] focus:ring-1 focus:ring-[#D97757]";
const actionBtn = "rounded-lg border border-border bg-background p-2 text-[#1C1917] transition hover:bg-muted";

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
    if (!name.trim() || !code.trim()) return;
    await create({ data: { name: name.trim(), iata_code: code.trim().toUpperCase(), logo_url: logo.trim() || null } });
    await refresh();
    setName(""); setCode(""); setLogo("");
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
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D97757]">Add New Airline</h4>
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
            onClick={add}
            disabled={!name.trim() || !code.trim()}
            className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
          >
            Add Airline
          </button>
        </div>
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
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {items.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No airlines configured yet.</li>
          )}
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-4 p-3.5">
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
                  <button onClick={() => save(a.id)} className="rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1C1917]">{a.name}</p>
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
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D97757]">Add New Airport / City Location</h4>
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
            className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
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
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                  <button onClick={() => save(l.id)} className="rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1C1917]">
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
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D97757]">Add Baggage Allowance Option</h4>
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
            className="shrink-0 rounded-lg bg-[#141413] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
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
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {items.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No baggage options defined yet.</li>
          )}
          {items.map((l) => (
            <li key={l.id} className="flex items-center gap-3 p-3.5">
              {editId === l.id ? (
                <>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value.toUpperCase())}
                    className={`flex-1 ${listInput}`}
                    autoFocus
                  />
                  <button onClick={() => save(l.id)} className="rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-semibold text-[#1C1917]">{l.label}</p>
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


function ManageListsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"airlines" | "locations" | "luggage" | "email-preview">("airlines");

  const { data: airlines = [] } = useQuery({ queryKey: ["airlines"], queryFn: () => listAirlines() });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const { data: luggages = [] } = useQuery({ queryKey: ["luggage"], queryFn: () => listLuggage() });

  const tabs = [
    { key: "airlines" as const, label: "Airlines", icon: Plane, count: airlines.length },
    { key: "locations" as const, label: "Airports & Locations", icon: MapPin, count: locations.length },
    { key: "luggage" as const, label: "Baggage Allowances", icon: Luggage, count: luggages.length },
    { key: "email-preview" as const, label: "Email Previews", icon: Mail },
  ];

  return (
    <div className="min-h-screen bg-[#F4EFEA] text-[#1C1917]">
      {/* Top Brand Banner */}
      <header className="border-b border-[#D97757]/20 bg-[#D97757] px-4 py-3 text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="flex items-center gap-1.5 rounded-lg bg-black/20 px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-black/30"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Main Site</span>
            </a>
            <div className="h-4 w-px bg-white/20" />
            <h1 className="text-base font-black tracking-tight sm:text-lg">
              Rohi International Travels <span className="text-xs font-bold uppercase tracking-wider text-white/80">— System Lists</span>
            </h1>
          </div>
          <AdminHeaderExtras />
        </div>
      </header>

      {/* Admin Tabs Bar */}
      <AdminTabs />

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#141413]">Manage Lists & Addons</h2>
            <p className="mt-1 text-sm text-[#78716C]">
              Configure master catalog items, airlines, airports, and baggage allowances across the booking engine.
            </p>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-[#E7E5E4] pb-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-1.5 shadow-sm">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-[#141413] text-white shadow-sm"
                      : "bg-[#FAF9F5] text-[#78716C] hover:bg-[#F4EFEA] hover:text-[#1C1917]"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-[#D97757]" : ""}`} />
                  <span>{t.label}</span>
                  {typeof t.count === "number" && (
                    <span
                      className={`ml-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                        active ? "bg-white/20 text-white" : "bg-[#F4EFEA] text-[#78716C]"
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Panel */}
        <div className="rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-5 shadow-sm sm:p-7">
          {tab === "airlines" && <AirlinesManager items={airlines} />}
          {tab === "locations" && <LocationsManager items={locations} />}
          {tab === "luggage" && <LuggageManager items={luggages} />}
          {tab === "email-preview" && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-base font-black text-[#141413]">Agent Booking Email Previews</h3>
                <p className="text-xs text-[#78716C]">
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
