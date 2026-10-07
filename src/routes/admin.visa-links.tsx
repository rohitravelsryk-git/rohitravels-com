import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Home, Plus, Save, Trash2, X, Pencil, Plane, LogOut, Link as LinkIcon, Search, ExternalLink, Globe2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminLogout } from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminPageHeading } from "@/components/AdminPageHeading";
import { listVisaLinks, createVisaLink, updateVisaLink, deleteVisaLink, syncVisaLinksToAddons, type VisaLink } from "@/lib/visa-links.functions";
import { listCountries, createCountry, updateCountry, deleteCountry, type Country } from "@/lib/fares.functions";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/visa-links")({
  ssr: false,
  head: () => ({ meta: [{ title: "Visa Links Admin — Rohi" }] }),
  loader: async ({ context }) => {
    try { await context.queryClient.ensureQueryData({ queryKey: ["visa-links"], queryFn: () => listVisaLinks() }); } catch {}
  },
  errorComponent: ({ error, reset }) => (
    <div className="min-h-screen grid place-items-center p-8" style={{ background: "#e3dacc", color: "#141413" }}>
      <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
        <p className="mb-4">{error instanceof Error ? error.message : String(error)}</p>
        <button onClick={reset} className="rounded-lg px-4 py-2 font-semibold" style={{ background: "#d97757", color: "#141413" }}>Retry</button>
      </div>
    </div>
  ),
  component: AdminVisaLinksPage,
});


const COUNTRY_ISO: Record<string, string> = {
  "SAUDI ARABIA": "sa", KSA: "sa", UAE: "ae", "UNITED ARAB EMIRATES": "ae", OMAN: "om", QATAR: "qa",
  BAHRAIN: "bh", KUWAIT: "kw", TURKEY: "tr", TURKIYE: "tr", EGYPT: "eg", JORDAN: "jo", IRAN: "ir",
  IRAQ: "iq", PAKISTAN: "pk", INDIA: "in", MALAYSIA: "my", INDONESIA: "id", THAILAND: "th",
  SINGAPORE: "sg", CHINA: "cn", UK: "gb", "UNITED KINGDOM": "gb", USA: "us", "UNITED STATES": "us",
  CANADA: "ca", AUSTRALIA: "au", GERMANY: "de", FRANCE: "fr", ITALY: "it", SPAIN: "es",
  SCHENGEN: "eu", AZERBAIJAN: "az", UZBEKISTAN: "uz", MALDIVES: "mv", "SRI LANKA": "lk",
};

function FlagImg({ country, size = 18 }: { country: string; size?: number }) {
  const normalized = country.trim().toUpperCase();
  const iso = COUNTRY_ISO[normalized] ?? (/^[A-Z]{2}$/.test(normalized) ? normalized.toLowerCase() : null);
  if (!iso) return <Globe2 className="text-[#d97757]" style={{ width: size, height: size }} />;
  const w = size >= 40 ? 80 : size >= 25 ? 40 : 20;
  return (
    <img
      src={`https://flagcdn.com/w${w}/${iso}.png`}
      alt=""
      width={Math.round(size * 1.4)}
      height={size}
      loading="lazy"
      className="inline-block rounded-sm object-cover ring-1 ring-black/10"
      style={{ width: Math.round(size * 1.4), height: size }}
    />
  );
}

type Draft = { country: string; purpose: string; url: string };
const emptyDraft: Draft = { country: "", purpose: "", url: "" };

function AdminVisaLinksPage() {
  const router = useRouter();
  const list = useServerFn(listVisaLinks);
  const fetchCountries = useServerFn(listCountries);
  const create = useServerFn(createVisaLink);
  const update = useServerFn(updateVisaLink);
  const remove = useServerFn(deleteVisaLink);
  const syncAddons = useServerFn(syncVisaLinksToAddons);
  const logout = useServerFn(adminLogout);
  const { data: rawData = [] } = useQuery({ queryKey: ["visa-links"], queryFn: () => list() });
  const { data: dbCountries = [] } = useQuery({ queryKey: ["countries"], queryFn: () => fetchCountries() });
  const data = rawData ?? [];

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<VisaLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  // Countries Management Modal state
  const [showCountriesModal, setShowCountriesModal] = useState(false);
  const qc = useQueryClient();
  const { data: countriesList = [], refetch: refetchCountries } = useQuery({
    queryKey: ["countries"],
    queryFn: () => listCountries(),
  });
  const createCtry = useServerFn(createCountry);
  const updateCtry = useServerFn(updateCountry);
  const deleteCtry = useServerFn(deleteCountry);
  const [newCtryName, setNewCtryName] = useState("");
  const [newCtryCode, setNewCtryCode] = useState("");
  const [editingCtryId, setEditingCtryId] = useState<string | null>(null);
  const [editingCtryName, setEditingCtryName] = useState("");
  const [editingCtryCode, setEditingCtryCode] = useState("");

  const [countryFilter, setCountryFilter] = useState("ALL");
  const [customCountryMode, setCustomCountryMode] = useState(false);

  // Normalize so "Saudi Arabia", "saudi arabia" and " Saudi Arabia " are
  // treated as the same country instead of showing up as separate/duplicate
  // entries. The first-seen casing (alphabetically) becomes the canonical
  // display name.
  const normalizeKey = (s: string) => s.trim().toLowerCase();

  // Full picker list for the Add/Edit form's country <select> — this is the
  // only place the generic seeded country list should appear, since it's a
  // legitimate convenience for picking a country that has no links yet.
  const availableCountryOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    [...dbCountries.map((c: any) => c.name as string), ...data.map((l) => l.country)]
      .filter(Boolean)
      .forEach((name) => {
        const key = normalizeKey(name);
        const existing = byKey.get(key);
        if (!existing || name.localeCompare(existing) < 0) byKey.set(key, name);
      });
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [dbCountries, data]);

  // Canonical display name for every country name actually present in real
  // visa link rows (deduped, normalized) — drives the filter pills and the
  // grouped list below, so dummy/seeded countries with zero real links never
  // show up as clutter, and near-duplicate spellings merge into one entry.
  const canonicalNameFor = useMemo(() => {
    const byKey = new Map<string, string>();
    data.forEach((l) => {
      const key = normalizeKey(l.country);
      const existing = byKey.get(key);
      if (!existing || l.country.localeCompare(existing) < 0) byKey.set(key, l.country);
    });
    return byKey;
  }, [data]);

  const countries = useMemo(
    () => Array.from(new Set(canonicalNameFor.values())).sort((a, b) => a.localeCompare(b)),
    [canonicalNameFor],
  );

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = data.filter((l) => {
      const canonical = canonicalNameFor.get(normalizeKey(l.country)) ?? l.country;
      return (
        (countryFilter === "ALL" || canonical === countryFilter) &&
        (!q || l.country.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
      );
    });
    const map = new Map<string, VisaLink[]>();
    filtered.forEach((l) => {
      const canonical = canonicalNameFor.get(normalizeKey(l.country)) ?? l.country;
      map.set(canonical, [...(map.get(canonical) ?? []), l]);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, search, countryFilter, canonicalNameFor]);

  async function syncAddonsAfterSave() {
    try {
      await syncAddons();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent("rohi:message", { detail: { message: `Saved in Supabase, but the Addons sheet could not be synced: ${e?.message || "Unknown sync error"}`, kind: "info" } }));
    }
  }

  function openAdd() {
    setDraft(emptyDraft);
    setCustomCountryMode(false);
    setAddOpen(true);
  }

  function openEdit(link: VisaLink) {
    setDraft({ country: link.country, purpose: link.purpose, url: link.url });
    setCustomCountryMode(false);
    setEditing(link);
  }

  async function save() {
    if (!draft.country.trim() || !draft.purpose.trim() || !draft.url.trim()) {
      window.dispatchEvent(new CustomEvent("rohi:message", { detail: { message: "Please fill Country, Purpose and URL.", kind: "error" } }));
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await update({ data: { id: editing.id, ...draft, country: draft.country.trim(), purpose: draft.purpose.trim(), url: draft.url.trim() } });
      } else {
        await create({ data: { ...draft, country: draft.country.trim(), purpose: draft.purpose.trim(), url: draft.url.trim() } });
      }
      await syncAddonsAfterSave();
      setDraft(emptyDraft);
      setEditing(null);
      setAddOpen(false);
      await router.invalidate();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent("rohi:message", { detail: { message: e?.message || `Unable to ${editing ? "update" : "add"} visa link.`, kind: "error" } }));
    } finally {
      setBusy(false);
    }
  }

  async function del(link: VisaLink) {
    if (!confirm(`Delete "${link.purpose}" for ${link.country}?`)) return;
    setBusy(true);
    try {
      await remove({ data: { id: link.id } });
      await syncAddonsAfterSave();
      await router.invalidate();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent("rohi:message", { detail: { message: e?.message || "Unable to delete visa link.", kind: "error" } }));
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    try { await logout(); } catch {}
    router.navigate({ to: "/admin" });
  }

  const closeForm = () => {
    if (busy) return;
    setAddOpen(false);
    setEditing(null);
    setDraft(emptyDraft);
    setCustomCountryMode(false);
  };

  return (
    <div className="min-h-screen" style={{ background: "#e3dacc", color: "#141413" }}>
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#141413] text-[#e3dacc] shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-[#d97757]" />
            <div><p className="text-base font-semibold">Admin Panel</p><p className="text-[11px] opacity-70">Visa verification links</p></div>
          </div>
          <div className="flex items-center gap-2">
            <AdminHeaderExtras />
            <a href="/" className="hidden items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 sm:inline-flex"><Home className="h-3.5 w-3.5" /> Home</a>
            <button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97757] px-3 py-2 text-xs font-semibold text-[#141413]"><LogOut className="h-3.5 w-3.5" /> Logout</button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <AdminPageHeading
          icon={LinkIcon}
          label="Visa Links"
          count={data.length}
          countLabel="Official links"
          description="Manage official visa verification portals. Links are grouped by country for quick review."
        />

        <section className="mb-6 flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,.05)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold">Visa verification directory</h2>
            <p className="mt-1 text-xs opacity-60">Supabase is the source of truth; the existing Addons sheet is only a mirror.</p>
          </div>
          <button type="button" onClick={openAdd} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#d97757] px-4 text-xs font-bold text-[#141413]">
            <Plus className="h-4 w-4" /> Add Visa Link
          </button>
        </section>

        <section className="mb-6 rounded-2xl border border-black/10 bg-white p-4 sm:p-5 shadow-[0_4px_12px_rgba(0,0,0,.05)]">
          <div className="flex flex-col gap-3.5">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-45" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country, service or official portal URL…"
                className="h-12 w-full rounded-xl border border-black/15 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-[#d97757] focus:ring-2"
                style={{ ["--tw-ring-color" as any]: "#d97757" }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCountryFilter("ALL")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition hover:opacity-90"
                style={countryFilter === "ALL" ? { background: "#d97757", color: "#141413" } : { background: "#eee9e1", color: "#141413" }}
              >
                <Globe2 className="h-3.5 w-3.5" /> All countries ({data.length})
              </button>
              {countries.map((country) => {
                const count = data.filter((l) => (canonicalNameFor.get(normalizeKey(l.country)) ?? l.country) === country).length;
                return (
                  <button
                    key={country}
                    type="button"
                    onClick={() => setCountryFilter(country)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition hover:opacity-90"
                    style={countryFilter === country ? { background: "#141413", color: "#e3dacc" } : { background: "#eee9e1", color: "#141413" }}
                  >
                    <FlagImg country={country} size={15} />
                    <span>{country}</span>
                    {count > 0 && <span className="opacity-60 text-[10px]">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-14 text-center">
            <Globe2 className="mx-auto mb-3 h-9 w-9 opacity-25" />
            <p className="font-semibold">{search ? "No matching visa links" : "No visa links yet"}</p>
            <p className="mt-1 text-sm opacity-55">{search ? "Try a different search." : "Add the first official country portal."}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([country, links]) => (
              <section key={country} className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_4px_12px_rgba(0,0,0,.05)]">
                <header className="flex flex-wrap items-center gap-3 border-b border-black/10 bg-[#f1ece4] px-5 py-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#141413] text-[#e3dacc] overflow-hidden p-1.5">
                    <FlagImg country={country} size={20} />
                  </span>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">{country}</h2>
                    <p className="text-[11px] uppercase tracking-wider opacity-50">{links.length} official portal{links.length === 1 ? "" : "s"}</p>
                  </div>
                </header>
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  {links.map((link) => (
                    <article key={link.id} className="rounded-xl border border-black/10 bg-[#faf9f7] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-5">{link.purpose}</p>
                          <p className="mt-2 truncate text-[11px] opacity-50" title={link.url}>{link.url}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#141413] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#e3dacc]">Official</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2f6fed] hover:underline">
                          Open portal <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <div className="flex gap-1.5">
                          <button onClick={() => openEdit(link)} aria-label="Edit" title="Edit" className="grid h-8 w-8 place-items-center rounded-lg bg-black/[0.06] hover:bg-black/[0.1]"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => del(link)} disabled={busy} aria-label="Delete" title="Delete" className="grid h-8 w-8 place-items-center rounded-lg bg-[#ea4335]/10 text-[#b42318] hover:bg-[#ea4335]/15 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <Dialog open={addOpen || Boolean(editing)} onOpenChange={(open) => { if (!open) closeForm(); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Visa Verification Link" : "Add Visa Verification Link"}</DialogTitle>
              <DialogDescription>
                Use the official government or authority portal. The change is saved to Supabase first and then mirrored to Addons.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="flex flex-col gap-1.5 text-xs">
                <span className="font-bold uppercase tracking-wider opacity-55">Country *</span>
                {!customCountryMode ? (
                  <div className="flex gap-2">
                    <select
                      value={draft.country}
                      onChange={(e) => {
                        if (e.target.value === "__NEW__") {
                          setCustomCountryMode(true);
                          setDraft({ ...draft, country: "" });
                        } else {
                          setDraft({ ...draft, country: e.target.value });
                        }
                      }}
                      className="h-11 flex-1 rounded-xl border border-black/15 bg-white px-3 text-sm font-medium outline-none focus:ring-2"
                      style={{ ["--tw-ring-color" as any]: "#d97757" }}
                    >
                      <option value="">-- Select Country from Addons --</option>
                      {availableCountryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__NEW__">➕ Other / Add New Country...</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      value={draft.country}
                      placeholder="Enter new country name"
                      onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                      className="h-11 flex-1 rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:ring-2"
                      style={{ ["--tw-ring-color" as any]: "#d97757" }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setCustomCountryMode(false)}
                      className="rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold hover:bg-black/5"
                    >
                      Select list
                    </button>
                  </div>
                )}
              </div>
              <Field label="Purpose / Description *" value={draft.purpose} onChange={(v) => setDraft({ ...draft, purpose: v })} />
              <Field label="Official URL *" value={draft.url} onChange={(v) => setDraft({ ...draft, url: v })} placeholder="https://…" />
            </div>
            <DialogFooter>
              <button type="button" disabled={busy} onClick={closeForm} className="rounded-lg border border-black/15 px-4 py-2 text-xs font-semibold disabled:opacity-50">Cancel</button>
              <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97757] px-4 py-2 text-xs font-bold text-[#141413] disabled:opacity-50">
                {busy ? "Saving…" : <><Save className="h-4 w-4" /> {editing ? "Save Changes" : "Save Visa Link"}</>}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    
      {/* Countries Directory Modal */}
      {showCountriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-[#E7E5E4] bg-[#FAF9F5] p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#E7E5E4] pb-3">
              <div className="flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-[#D97757]" />
                <h3 className="text-base font-bold text-[#141413]">Manage Countries Directory</h3>
              </div>
              <button
                onClick={() => setShowCountriesModal(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <p className="mb-4 text-xs text-muted-foreground">
              Distinct countries and ISO codes mapped for visa verification links.
            </p>

            <div className="mb-4 flex gap-2">
              <input
                value={newCtryName}
                onChange={(e) => setNewCtryName(e.target.value)}
                placeholder="Country Name (e.g. Oman)"
                className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-[#D97757]"
              />
              <input
                value={newCtryCode}
                onChange={(e) => setNewCtryCode(e.target.value.toUpperCase())}
                placeholder="ISO (OM)"
                maxLength={4}
                className="w-20 rounded-xl border border-input bg-background px-3 py-2 text-xs uppercase outline-none focus:border-[#D97757]"
              />
              <button
                onClick={async () => {
                  if (!newCtryName.trim()) return;
                  await createCtry({ data: { name: newCtryName.trim(), code: newCtryCode.trim().toUpperCase() || undefined } });
                  setNewCtryName("");
                  setNewCtryCode("");
                  refetchCountries();
                }}
                disabled={!newCtryName.trim()}
                className="rounded-xl bg-[#141413] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#D97757] disabled:opacity-50"
              >
                Add Country
              </button>
            </div>

            <div className="max-h-72 divide-y divide-[#E7E5E4] overflow-y-auto rounded-xl border border-[#E7E5E4] bg-card">
              {countriesList.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 text-xs">
                  {editingCtryId === c.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        value={editingCtryName}
                        onChange={(e) => setEditingCtryName(e.target.value)}
                        className="flex-1 rounded-lg border border-input bg-background px-2.5 py-1 text-xs"
                      />
                      <input
                        value={editingCtryCode}
                        onChange={(e) => setEditingCtryCode(e.target.value.toUpperCase())}
                        className="w-16 rounded-lg border border-input bg-background px-2.5 py-1 text-xs uppercase"
                      />
                      <button
                        onClick={async () => {
                          if (!editingCtryName.trim()) return;
                          await updateCtry({ data: { id: c.id, name: editingCtryName.trim(), code: editingCtryCode.trim().toUpperCase() || null } });
                          setEditingCtryId(null);
                          refetchCountries();
                        }}
                        className="rounded-lg bg-[#141413] px-2.5 py-1 font-bold text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingCtryId(null)}
                        className="rounded-lg border border-border px-2.5 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1C1917]">{c.name}</span>
                        {c.code && (
                          <span className="rounded bg-[#F4EFEA] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#78716C]">
                            {c.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingCtryId(c.id);
                            setEditingCtryName(c.name);
                            setEditingCtryCode(c.code ?? "");
                          }}
                          className="rounded-lg border border-border p-1.5 hover:bg-muted"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete country ${c.name}?`)) return;
                            await deleteCtry({ data: { id: c.id } });
                            refetchCountries();
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowCountriesModal(false)}
                className="rounded-xl bg-[#141413] px-4 py-2 text-xs font-bold text-white hover:bg-[#D97757]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs">
      <span className="font-bold uppercase tracking-wider opacity-55">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl border border-black/15 bg-white px-3 text-sm outline-none focus:ring-2" style={{ ["--tw-ring-color" as any]: "#d97757" }} />
    </label>
  );
}
