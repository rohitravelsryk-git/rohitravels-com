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
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D97757]">Add New Service / Product</h4>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Service name (e.g. Visa Services, Umrah Packages)"
            className={listInput}
          />
          <button
            onClick={add}
            disabled={!label.trim()}
            className="shrink-0 rounded-lg bg-[#141413] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
          >
            Add Service
          </button>
        </div>
      </div>

      <BulkBox
        hint="One service per line."
        placeholder={"Ticket Booking\nVisa Services\nUmrah Packages"}
        onSubmit={async (lines) => {
          await bulk({ data: { labels: lines } });
          await refresh();
        }}
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Total Services: {items.length} (shown in the Customer Inquiry form dropdown)
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {items.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No services defined yet.</li>
          )}
          {items.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-3.5">
              {editId === s.id ? (
                <>
                  <input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className={`flex-1 ${listInput}`}
                    autoFocus
                  />
                  <button onClick={() => save(s.id)} className="rounded-lg bg-[#141413] px-3 py-1.5 text-xs font-bold text-white">Save</button>
                  <button onClick={() => setEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">Cancel</button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-semibold text-[#1C1917]">{s.label}</p>
                  <button
                    onClick={() => { setEditId(s.id); setEditLabel(s.label); }}
                    className={actionBtn}
                    title="Edit Service"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => del(s.id)}
                    className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                    title="Delete Service"
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
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D97757]">Add New Vendor / Supplier</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Vendor / Supplier Name"
            className={listInput}
          />
          <input
            value={draft.contact_person}
            onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })}
            placeholder="Contact Person"
            className={listInput}
          />
          <input
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder="Phone Number"
            className={listInput}
          />
          <input
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="Email Address"
            className={listInput}
          />
          <input
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Notes (optional)"
            className={`col-span-1 sm:col-span-2 ${listInput}`}
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={add}
            disabled={busy || !draft.name.trim()}
            className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add Vendor"}
          </button>
          {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Total Vendors: {vendors.length}
        </p>
        {isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading vendors…</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {vendors.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">No vendors added yet.</li>
            )}
            {vendors.map((v) => {
              const isEdit = editingId === v.id;
              return (
                <li key={v.id} className="p-3.5">
                  {isEdit ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          value={editRow.name ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, name: e.target.value })}
                          placeholder="Name"
                          className={listInput}
                        />
                        <input
                          value={editRow.contact_person ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, contact_person: e.target.value })}
                          placeholder="Contact person"
                          className={listInput}
                        />
                        <input
                          value={editRow.phone ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, phone: e.target.value })}
                          placeholder="Phone"
                          className={listInput}
                        />
                        <input
                          value={editRow.email ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, email: e.target.value })}
                          placeholder="Email"
                          className={listInput}
                        />
                        <input
                          value={editRow.notes ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, notes: e.target.value })}
                          placeholder="Notes"
                          className={`col-span-1 sm:col-span-2 ${listInput}`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={save} disabled={busy} className="rounded-lg bg-[#141413] px-3.5 py-1.5 text-xs font-bold text-white">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold">Cancel</button>
                      </div>
                      {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1C1917]">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[v.contact_person, v.phone, v.email].filter(Boolean).join(" • ") || "—"}
                        </p>
                        {v.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">{v.notes}</p>}
                      </div>
                      <button
                        onClick={() => { setEditingId(v.id); setEditRow(v); }}
                        className={actionBtn}
                        title="Edit Vendor"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => del(v.id)}
                        className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        title="Delete Vendor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function AgentsManager() {
  const qc = useQueryClient();
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["agents", "admin"],
    queryFn: async () => {
      try {
        const data = await listAgentsAdmin();
        if (Array.isArray(data) && data.length > 0) return data;
      } catch (err) {
        console.warn("listAgentsAdmin failed, falling back to direct Supabase fetch:", err);
      }
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Direct Supabase agents fetch error:", error);
        return [];
      }
      return (data ?? []) as any[];
    },
  });
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
    if (!draft.agency_name || !draft.email || !draft.password) {
      setErr("Agency name, email, and password are required");
      return;
    }
    setBusy(true);
    try {
      await create({ data: draft });
      await qc.invalidateQueries({ queryKey: ["agents", "admin"] });
      setDraft(empty);
    } catch (e: any) { setErr(e?.message ?? "Failed to add agent"); }
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
    } catch (e: any) { setErr(e?.message ?? "Failed to save agent"); }
    finally { setBusy(false); }
  }

  async function del(user_id: string) {
    if (!confirm("Delete this agent and their account permanently?")) return;
    await remove({ data: { user_id } });
    await qc.invalidateQueries({ queryKey: ["agents", "admin"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-[#D97757]/20 bg-[#D97757]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#141413]">Public Agent Registration Portal</p>
          <p className="text-xs text-muted-foreground">Show or hide the registration button and public signup links on the website.</p>
        </div>
        <button
          onClick={toggleVisibility}
          disabled={visBusy}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#D97757] focus:ring-offset-2 ${
            !isVisible ? "bg-slate-300" : "bg-emerald-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              !isVisible ? "translate-x-1" : "translate-x-6"
            }`}
          />
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D97757]">Add New Agent Account</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            value={draft.agency_name}
            onChange={(e) => setDraft({ ...draft, agency_name: e.target.value })}
            placeholder="Agency Name"
            className={listInput}
          />
          <input
            value={draft.contact_person}
            onChange={(e) => setDraft({ ...draft, contact_person: e.target.value })}
            placeholder="Contact Person"
            className={listInput}
          />
          <input
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="Email Address"
            className={listInput}
          />
          <input
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            placeholder="Password (minimum 6 characters)"
            type="password"
            className={listInput}
          />
          <input
            value={draft.city}
            onChange={(e) => setDraft({ ...draft, city: e.target.value })}
            placeholder="City"
            className={listInput}
          />
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <input
              value={draft.country_code}
              onChange={(e) => setDraft({ ...draft, country_code: e.target.value })}
              placeholder="+92"
              className={listInput}
            />
            <input
              value={draft.cell_number}
              onChange={(e) => setDraft({ ...draft, cell_number: e.target.value })}
              placeholder="Cell Number"
              className={listInput}
            />
          </div>
          <input
            value={draft.office_address}
            onChange={(e) => setDraft({ ...draft, office_address: e.target.value })}
            placeholder="Office Address"
            className={`col-span-1 sm:col-span-2 ${listInput}`}
          />
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Status:</label>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as any })}
              className={listInput}
            >
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={add}
            disabled={busy}
            className="rounded-lg bg-[#141413] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
          >
            {busy ? "Creating Agent…" : "Add Agent"}
          </button>
          {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">
          Total Registered Agents: {agents.length}
        </p>
        {isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading agents…</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {agents.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">No agents registered yet.</li>
            )}
            {agents.map((a) => {
              const isEdit = editingId === a.user_id;
              return (
                <li key={a.user_id} className="p-3.5">
                  {isEdit ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          value={editRow.agency_name ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, agency_name: e.target.value })}
                          placeholder="Agency"
                          className={listInput}
                        />
                        <input
                          value={editRow.contact_person ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, contact_person: e.target.value })}
                          placeholder="Contact person"
                          className={listInput}
                        />
                        <input
                          value={editRow.city ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, city: e.target.value })}
                          placeholder="City"
                          className={listInput}
                        />
                        <div className="grid grid-cols-[90px_1fr] gap-2">
                          <input
                            value={editRow.country_code ?? ""}
                            onChange={(e) => setEditRow({ ...editRow, country_code: e.target.value })}
                            className={listInput}
                          />
                          <input
                            value={editRow.cell_number ?? ""}
                            onChange={(e) => setEditRow({ ...editRow, cell_number: e.target.value })}
                            className={listInput}
                          />
                        </div>
                        <input
                          value={editRow.office_address ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, office_address: e.target.value })}
                          placeholder="Office address"
                          className={`col-span-1 sm:col-span-2 ${listInput}`}
                        />
                        <select
                          value={editRow.status ?? "pending"}
                          onChange={(e) => setEditRow({ ...editRow, status: e.target.value as AgentRow["status"] })}
                          className={listInput}
                        >
                          <option value="approved">Approved</option>
                          <option value="pending">Pending</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <input
                          value={editRow.new_password ?? ""}
                          onChange={(e) => setEditRow({ ...editRow, new_password: e.target.value })}
                          placeholder="New password (leave empty to keep current)"
                          type="password"
                          className={listInput}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={save} disabled={busy} className="rounded-lg bg-[#141413] px-3.5 py-1.5 text-xs font-bold text-white">Save</button>
                        <button onClick={() => setEditingId(null)} className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold">Cancel</button>
                      </div>
                      {err && <p className="text-xs font-semibold text-destructive">{err}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#1C1917]">
                          {a.agency_name}
                          <span
                            className="ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: a.status === "approved" ? "#d1fae5" : a.status === "rejected" ? "#fee2e2" : "#fef3c7",
                              color: a.status === "approved" ? "#065f46" : a.status === "rejected" ? "#991b1b" : "#92400e",
                            }}
                          >
                            {a.status}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.contact_person} • {a.email} • {a.country_code} {a.cell_number} • {a.city}
                        </p>
                      </div>
                      <button
                        onClick={() => startEdit(a)}
                        className={actionBtn}
                        title="Edit Agent"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => del(a.user_id)}
                        className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        title="Delete Agent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

type TabKey = "airlines" | "locations" | "luggage" | "services" | "countries" | "vendors" | "agents" | "email-preview";

function ManageListsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("airlines");

  const { data: unlocked = true } = useQuery({
    queryKey: ["admin", "unlocked"],
    queryFn: () => checkAdminUnlocked(),
  });

  const { data: airlines = [] } = useQuery({ queryKey: ["airlines"], queryFn: () => listAirlines() });
  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: () => listLocations() });
  const { data: luggages = [] } = useQuery({ queryKey: ["luggage"], queryFn: () => listLuggage() });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => listServices() });
  const { data: countries = [] } = useQuery({ queryKey: ["countries"], queryFn: () => listCountries() });

  const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
    { key: "airlines", label: "Airlines", icon: Plane, count: airlines.length },
    { key: "locations", label: "Airports / Locations", icon: MapPin, count: locations.length },
    { key: "luggage", label: "Baggage Allowances", icon: Luggage, count: luggages.length },
    { key: "services", label: "Inquiry Services", icon: Layers, count: services.length },
    { key: "countries", label: "Countries", icon: Globe2, count: countries.length },
    { key: "vendors", label: "Vendors & Suppliers", icon: Building2 },
    { key: "email-preview", label: "Email Previews", icon: Mail },
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
              Rohi International Travels — Manage System Lists
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <button
              onClick={async () => {
                await adminLogout();
                router.navigate({ to: "/admin" });
              }}
              className="flex items-center gap-1.5 rounded-lg bg-black/20 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-black/40"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Tabs Bar */}
      <AdminTabs />

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-black tracking-tight text-[#141413]">System Lists & Catalog Management</h2>
          <p className="text-sm text-muted-foreground">
            Configure dropdown options, master data, airports, baggage limits, inquiry categories, and suppliers across the Rohi booking engine.
          </p>
        </div>

        {/* Section Navigation Tabs grouped into Addons, Queries, Vendors */}
        <div className="mb-6 space-y-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Addons */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-card p-1.5 ring-1 ring-border shadow-sm">
              <span className="px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Addons</span>
              {tabs.filter((t) => ["airlines", "locations", "luggage", "email-preview"].includes(t.key)).map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-[#141413] text-white shadow-sm"
                        : "bg-card text-muted-foreground ring-1 ring-border/60 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-[#D97757]" : ""}`} />
                    <span>{t.label}</span>
                    {typeof t.count === "number" && (
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Queries */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-card p-1.5 ring-1 ring-border shadow-sm">
              <span className="px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Queries</span>
              {tabs.filter((t) => t.key === "services").map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-[#141413] text-white shadow-sm"
                        : "bg-card text-muted-foreground ring-1 ring-border/60 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-[#D97757]" : ""}`} />
                    <span>{t.label}</span>
                    {typeof t.count === "number" && (
                      <span
                        className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Vendors */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-card p-1.5 ring-1 ring-border shadow-sm">
              <span className="px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Vendors</span>
              {tabs.filter((t) => t.key === "vendors").map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "bg-[#141413] text-white shadow-sm"
                        : "bg-card text-muted-foreground ring-1 ring-border/60 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${active ? "text-[#D97757]" : ""}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Panel */}
        <div className="rounded-2xl border border-border bg-[#FAF9F5] p-5 shadow-sm sm:p-7">
          {tab === "airlines" && <AirlinesManager items={airlines} />}
          {tab === "locations" && <LocationsManager items={locations} />}
          {tab === "luggage" && <LuggageManager items={luggages} />}
          {tab === "services" && <ServicesManager items={services} />}
          {tab === "countries" && <CountriesManager items={countries} />}
          {tab === "vendors" && <VendorsManager />}
          {tab === "agents" && <AgentsManager />}
          {tab === "email-preview" && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="font-bold text-[#141413]">Agent Booking Email Previews</h3>
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


function CountriesManager({ items }: { items: Country[] }) {
  const qc = useQueryClient();
  const create = useServerFn(createCountry);
  const update = useServerFn(updateCountry);
  const remove = useServerFn(deleteCountry);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["countries"] });

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await create({ data: { name: name.trim(), code: code.trim().toUpperCase() || undefined } });
      await refresh();
      setName("");
      setCode("");
    } catch (e: any) {
      alert(e?.message || "Failed to add country");
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string) {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      await update({ data: { id, name: editName.trim(), code: editCode.trim().toUpperCase() || null } });
      await refresh();
      setEditId(null);
    } catch (e: any) {
      alert(e?.message || "Failed to update country");
    } finally {
      setBusy(false);
    }
  }

  async function del(c: Country) {
    if (!confirm(`Delete country "${c.name}"?`)) return;
    setBusy(true);
    try {
      await remove({ data: { id: c.id } });
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Failed to delete country");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-[#D97757]">Add New Country</h4>
        <p className="mb-3 text-xs text-muted-foreground">Countries added here appear in the Visa Verification Link dropdown and sync to the Addons Google Sheet.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Country Name (e.g. Saudi Arabia, UAE, Qatar)"
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code (optional, e.g. SA)"
            className="w-full sm:w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm uppercase"
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={add}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#D97757] px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add Country
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Countries Directory ({items.length})</h4>
        </div>
        <div className="divide-y divide-border">
          {items.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2.5">
              {editId === c.id ? (
                <div className="flex flex-1 items-center gap-2 pr-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm font-semibold"
                  />
                  <input
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    placeholder="Code"
                    className="w-20 rounded border border-input bg-background px-2 py-1 text-sm uppercase"
                  />
                  <button
                    onClick={() => save(c.id)}
                    disabled={busy}
                    className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    disabled={busy}
                    className="rounded bg-muted px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{c.name}</span>
                    {c.code && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {c.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditId(c.id);
                        setEditName(c.name);
                        setEditCode(c.code || "");
                      }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => del(c)}
                      className="rounded p-1 text-rose-500 hover:bg-rose-50"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No countries configured yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
