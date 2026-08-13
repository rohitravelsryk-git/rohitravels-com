import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ExternalLink, Search, ShieldCheck, Globe2, Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import { listVisaLinks, updateVisaLink, createVisaLink, deleteVisaLink, type VisaLink } from "@/lib/visa-links.functions";
import { checkAdminUnlocked } from "@/lib/fares.functions";

const visaLinksQuery = {
  queryKey: ["visa-links"] as const,
  queryFn: async () => {
    const fn = (window as any).__listVisaLinks ?? listVisaLinks;
    return (await fn()) as VisaLink[];
  },
};

export const Route = createFileRoute("/verify-visa")({
  head: () => ({
    meta: [
      { title: "Verify Your Visa — Rohi International Travels" },
      {
        name: "description",
        content:
          "Official visa verification links for Saudi Arabia, UAE, Oman, Qatar, Bahrain, Kuwait and Turkey. Check your visa in one click.",
      },
      { property: "og:title", content: "Verify Your Visa — Rohi International Travels" },
      {
        property: "og:description",
        content: "One-click access to official government portals to verify your visa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "canonical", href: "https://rohitravels.lovable.app/verify-visa" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: visaLinksQuery.queryKey,
      queryFn: () => listVisaLinks(),
    });
  },
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center">
      <p className="mb-4 text-destructive">Failed to load visa links: {error.message}</p>
      <button onClick={reset} className="rounded bg-navy px-4 py-2 text-white">
        Retry
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
  component: VerifyVisaPage,
});

const COUNTRY_ISO: Record<string, string> = {
  "SAUDI ARABIA": "sa", "KSA": "sa",
  "UAE": "ae", "UNITED ARAB EMIRATES": "ae",
  "OMAN": "om",
  "QATAR": "qa",
  "BAHRAIN": "bh",
  "KUWAIT": "kw",
  "TURKEY": "tr", "TURKIYE": "tr",
  "EGYPT": "eg",
  "JORDAN": "jo",
  "IRAN": "ir",
  "IRAQ": "iq",
  "PAKISTAN": "pk",
  "INDIA": "in",
  "MALAYSIA": "my",
  "INDONESIA": "id",
  "THAILAND": "th",
  "SINGAPORE": "sg",
  "CHINA": "cn",
  "UK": "gb", "UNITED KINGDOM": "gb",
  "USA": "us", "UNITED STATES": "us",
  "CANADA": "ca",
  "AUSTRALIA": "au",
  "GERMANY": "de",
  "FRANCE": "fr",
  "ITALY": "it",
  "SPAIN": "es",
  "SCHENGEN": "eu",
  "AZERBAIJAN": "az",
  "UZBEKISTAN": "uz",
  "MALDIVES": "mv",
  "SRI LANKA": "lk",
};

function isoFor(country: string): string | null {
  const key = country.trim().toUpperCase();
  if (COUNTRY_ISO[key]) return COUNTRY_ISO[key];
  if (/^[A-Z]{2}$/.test(key)) return key.toLowerCase();
  return null;
}

function FlagImg({ country, size = 20, className = "" }: { country: string; size?: number; className?: string }) {
  const iso = isoFor(country);
  if (!iso) {
    return <span className={className} style={{ fontSize: size }}>🌐</span>;
  }
  // flagcdn.com only serves fixed widths (20, 40, 80, 160, 320). Requesting
  // arbitrary widths like w28 returns 404 → broken image.
  const pick = (target: number) => {
    const opts = [20, 40, 80, 160, 320];
    return opts.find((o) => o >= target) ?? 320;
  };
  const w1 = pick(Math.round(size * 1.4));
  const w2 = pick(Math.round(size * 2.8));
  const src = `https://flagcdn.com/w${w1}/${iso}.png`;
  const src2 = `https://flagcdn.com/w${w2}/${iso}.png`;
  const width = Math.round(size * 1.4);
  return (
    <img
      src={src}
      srcSet={`${src} 1x, ${src2} 2x`}
      alt={`${country} flag`}
      width={width}
      height={size}
      loading="lazy"
      className={`inline-block rounded-sm object-cover shadow-sm ring-1 ring-black/10 ${className}`}
      style={{ width, height: size }}
    />
  );
}

function VerifyVisaPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const fn = useServerFn(listVisaLinks);
  const update = useServerFn(updateVisaLink);
  const create = useServerFn(createVisaLink);
  const remove = useServerFn(deleteVisaLink);
  const { data } = useSuspenseQuery({
    queryKey: visaLinksQuery.queryKey,
    queryFn: () => fn(),
  });
  const adminCheck = useServerFn(checkAdminUnlocked);
  const { data: adminStatus } = useQuery({
    queryKey: ["admin-unlocked"] as const,
    queryFn: () => adminCheck(),
  });
  const isAdmin = Boolean(adminStatus?.unlocked);
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPurpose, setEditPurpose] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingCountry, setAddingCountry] = useState<string | null>(null);
  const [newPurpose, setNewPurpose] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCountryName, setNewCountryName] = useState("");

  function handleAuthError(e: any) {
    alert(e.message?.includes("Unauthorized") ? "Please sign in via Admin Panel first." : e.message);
  }

  function startEdit(l: VisaLink) {
    setEditingId(l.id);
    setEditPurpose(l.purpose);
    setEditUrl(l.url);
  }

  async function saveEdit(l: VisaLink) {
    setBusy(true);
    try {
      await update({
        data: {
          id: l.id,
          country: l.country,
          purpose: editPurpose,
          url: editUrl,
          sort_order: l.sort_order,
        },
      });
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: visaLinksQuery.queryKey });
      router.invalidate();
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setBusy(false);
    }
  }

  async function addLink(countryName: string) {
    if (!newPurpose.trim() || !newUrl.trim()) {
      alert("Please enter purpose and URL");
      return;
    }
    setBusy(true);
    try {
      await create({ data: { country: countryName, purpose: newPurpose, url: newUrl, sort_order: 999 } });
      setAddingCountry(null);
      setNewPurpose("");
      setNewUrl("");
      await qc.invalidateQueries({ queryKey: visaLinksQuery.queryKey });
      router.invalidate();
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setBusy(false);
    }
  }

  async function addNewCountry() {
    const c = newCountryName.trim().toUpperCase();
    if (!c || !newPurpose.trim() || !newUrl.trim()) {
      alert("Please enter country, purpose and URL");
      return;
    }
    setBusy(true);
    try {
      await create({ data: { country: c, purpose: newPurpose, url: newUrl, sort_order: 0 } });
      setAddingCountry(null);
      setNewCountryName("");
      setNewPurpose("");
      setNewUrl("");
      await qc.invalidateQueries({ queryKey: visaLinksQuery.queryKey });
      router.invalidate();
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setBusy(false);
    }
  }

  async function deleteLink(l: VisaLink) {
    if (!confirm(`Delete "${l.purpose}"?`)) return;
    setBusy(true);
    try {
      await remove({ data: { id: l.id } });
      await qc.invalidateQueries({ queryKey: visaLinksQuery.queryKey });
      router.invalidate();
    } catch (e: any) {
      handleAuthError(e);
    } finally {
      setBusy(false);
    }
  }


  const countries = useMemo(() => {
    const set = new Set(data.map((l) => l.country));
    return ["ALL", ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((l) => {
      if (country !== "ALL" && l.country !== country) return false;
      if (!q) return true;
      return (
        l.country.toLowerCase().includes(q) ||
        l.purpose.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q)
      );
    });
  }, [data, country, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, VisaLink[]>();
    for (const l of filtered) {
      const arr = map.get(l.country) ?? [];
      arr.push(l);
      map.set(l.country, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-secondary/30 text-navy">
      <section className="bg-navy text-white mt-[-1px]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-center gap-3 text-gold">
            <ShieldCheck className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Visa Verification</span>
          </div>
          <h1 className="mt-3 font-serif text-4xl font-black md:text-5xl">Verify Your Visa</h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Use the official government portals below to check the authenticity and status of your
            visa before you travel. Select a country or search for a service.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country, purpose or portal…"
              className="w-full rounded-md border border-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  country === c
                    ? "bg-navy text-white"
                    : "border border-border bg-white text-navy hover:bg-secondary"
                }`}
              >
                {c === "ALL" ? (
                  <span className="inline-flex items-center gap-1.5">🌍 All Countries</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <FlagImg country={c} size={14} /> {c}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="mb-6 rounded-md border border-dashed border-gold/60 bg-white p-4">
            {addingCountry === "__NEW__" ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={newCountryName}
                  onChange={(e) => setNewCountryName(e.target.value)}
                  placeholder="Country (e.g. EGYPT)"
                  className="flex-1 rounded border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gold"
                />
                <input
                  value={newPurpose}
                  onChange={(e) => setNewPurpose(e.target.value)}
                  placeholder="Heading / purpose"
                  className="flex-1 rounded border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gold"
                />
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gold"
                />
                <div className="flex gap-2">
                  <button onClick={addNewCountry} disabled={busy} className="rounded bg-navy px-3 py-1 text-xs font-bold text-white hover:bg-gold hover:text-navy">
                    Save
                  </button>
                  <button onClick={() => setAddingCountry(null)} className="rounded bg-secondary px-3 py-1 text-xs font-bold text-navy">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAddingCountry("__NEW__");
                  setNewCountryName("");
                  setNewPurpose("");
                  setNewUrl("");
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-xs font-bold uppercase tracking-wider text-navy hover:bg-navy hover:text-white"
              >
                <Plus className="h-4 w-4" /> Add New Country / Link
              </button>
            )}
          </div>
        )}


        {grouped.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-white p-8 text-center text-muted-foreground">
            No visa links match your search.
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([countryName, links]) => (
              <section
                key={countryName}
                className="overflow-hidden rounded-xl border border-border bg-white shadow-sm"
              >
                <header className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary/40 px-5 py-3">
                  <FlagImg country={countryName} size={22} />
                  <h2 className="text-lg font-black uppercase tracking-wide text-navy">
                    {countryName}
                  </h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-navy ring-1 ring-border">
                    {links.length}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setAddingCountry(countryName);
                        setNewPurpose("");
                        setNewUrl("");
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-navy hover:bg-gold hover:text-navy"
                      title="Add another link for this country"
                    >
                      <Plus className="h-3 w-3" /> Add Link
                    </button>
                  )}
                </header>

                {isAdmin && addingCountry === countryName && (
                  <div className="flex flex-col gap-2 border-b border-border bg-gold/10 p-3 sm:flex-row">
                    <input
                      value={newPurpose}
                      onChange={(e) => setNewPurpose(e.target.value)}
                      placeholder="Heading / purpose"
                      className="flex-1 rounded border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gold"
                    />
                    <input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 rounded border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-gold"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => addLink(countryName)} disabled={busy} className="rounded bg-navy px-3 py-1 text-xs font-bold text-white hover:bg-gold hover:text-navy">
                        Save
                      </button>
                      <button onClick={() => setAddingCountry(null)} className="rounded bg-secondary px-3 py-1 text-xs font-bold text-navy">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <ul className="divide-y divide-border">
                  {links.map((l) => {
                    const editing = isAdmin && editingId === l.id;
                    return (
                      <li key={l.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          {editing ? (
                            <>
                              <input
                                value={editPurpose}
                                onChange={(e) => setEditPurpose(e.target.value)}
                                className="w-full rounded border border-border bg-white px-2 py-1 text-sm font-bold text-navy outline-none focus:ring-2 focus:ring-gold"
                              />
                              <input
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                placeholder="https://..."
                                className="mt-1 w-full rounded border border-border bg-white px-2 py-1 text-xs text-navy outline-none focus:ring-2 focus:ring-gold"
                              />
                            </>
                          ) : (
                            <>
                              <h3 className="text-sm font-bold leading-snug text-navy">{l.purpose}</h3>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={l.url}>
                                {l.url}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <a
                            href={editing ? editUrl : l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md bg-navy px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-gold hover:text-navy"
                          >
                            Verify <ExternalLink className="h-3 w-3" />
                          </a>
                          {isAdmin && (editing ? (
                            <>
                              <button onClick={() => saveEdit(l)} disabled={busy} className="grid h-8 w-8 place-items-center rounded-full bg-gold text-navy hover:opacity-90" title="Save">
                                <Save className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-navy hover:bg-secondary/80" title="Cancel">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(l)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-navy hover:bg-gold hover:text-navy" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => deleteLink(l)} disabled={busy} className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-red-600 hover:bg-red-600 hover:text-white" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <p className="mt-10 rounded-md border border-border bg-secondary/50 p-4 text-xs text-muted-foreground">
          Links open the official government / airline portals in a new tab. Rohi International
          Travels is not responsible for third-party website availability. For assistance, WhatsApp
          us at <strong>+92 305 6622988</strong>.
        </p>
      </main>
    </div>
  );
}
