import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ExternalLink, Search, ShieldCheck, Globe2 } from "lucide-react";
import { listVisaLinks, type VisaLink } from "@/lib/visa-links.functions";

const visaLinksQuery = { queryKey: ["visa-links"] as const };
const COUNTRY_ISO: Record<string, string> = {
  "SAUDI ARABIA":"sa", KSA:"sa", UAE:"ae", "UNITED ARAB EMIRATES":"ae", OMAN:"om", QATAR:"qa",
  BAHRAIN:"bh", KUWAIT:"kw", TURKEY:"tr", TURKIYE:"tr", EGYPT:"eg", JORDAN:"jo", IRAN:"ir",
  IRAQ:"iq", PAKISTAN:"pk", INDIA:"in", MALAYSIA:"my", INDONESIA:"id", THAILAND:"th",
  SINGAPORE:"sg", CHINA:"cn", UK:"gb", "UNITED KINGDOM":"gb", USA:"us", "UNITED STATES":"us",
  CANADA:"ca", AUSTRALIA:"au", GERMANY:"de", FRANCE:"fr", ITALY:"it", SPAIN:"es",
  SCHENGEN:"eu", AZERBAIJAN:"az", UZBEKISTAN:"uz", MALDIVES:"mv", "SRI LANKA":"lk",
};

function FlagImg({ country, size = 24 }: { country: string; size?: number }) {
  const normalized = country.trim().toUpperCase();
  const iso = COUNTRY_ISO[normalized] ?? (/^[A-Z]{2}$/.test(normalized) ? normalized.toLowerCase() : null);
  if (!iso) return <Globe2 className="text-[#d97757]" style={{ width: size, height: size }} />;
  const w = size >= 40 ? 80 : size >= 25 ? 40 : 20;
  return <img src={`https://flagcdn.com/w${w}/${iso}.png`} alt="" width={Math.round(size * 1.4)} height={size} loading="lazy" className="rounded-sm object-cover ring-1 ring-black/10" style={{ width: Math.round(size * 1.4), height: size }} />;
}

function portalLabel(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export const Route = createFileRoute("/verify-visa")({
  head: () => ({
    meta: [
      { title: "Verify Your Visa — Rohi International Travels" },
      { name: "description", content: "Find official visa verification and government portals by country." },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/verify-visa" }],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: visaLinksQuery.queryKey, queryFn: () => listVisaLinks() });
  },
  errorComponent: ({ error, reset }) => (
    <div className="grid min-h-screen place-items-center bg-[#e3dacc] p-8 text-[#141413]">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="mb-4">Failed to load visa links: {error instanceof Error ? error.message : String(error)}</p>
        <button onClick={reset} className="rounded-lg bg-[#d97757] px-4 py-2 font-semibold">Retry</button>
      </div>
    </div>
  ),
  component: VerifyVisaPage,
});

function VerifyVisaPage() {
  const list = useServerFn(listVisaLinks);
  const { data } = useSuspenseQuery({ queryKey: visaLinksQuery.queryKey, queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("ALL");

  const countries = useMemo(() => Array.from(new Set(data.map((l) => l.country))).sort((a, b) => a.localeCompare(b)), [data]);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = data.filter((l) =>
      (country === "ALL" || l.country === country) &&
      (!q || l.country.toLowerCase().includes(q) || l.purpose.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)),
    );
    const map = new Map<string, VisaLink[]>();
    filtered.forEach((l) => map.set(l.country, [...(map.get(l.country) ?? []), l]));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data, search, country]);

  return (
    <div className="min-h-screen bg-[#e3dacc] text-[#141413]" style={{ fontFamily: "var(--font-anthropic-sans, ui-sans-serif, system-ui)" }}>
      <section className="relative overflow-hidden bg-[#141413] text-[#e3dacc]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d97757] text-[#141413]"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#d97757]">Rohi International Travels</p>
              <p className="text-xs opacity-65">Official visa verification directory</p>
            </div>
          </div>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">Verify your visa from the official source.</h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 opacity-72 sm:text-base">
            Choose your destination and open the relevant government or official authority portal. We keep the links organized by country so you can find the right service quickly.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        <section className="sticky top-2 z-20 mb-8 rounded-2xl border border-black/10 bg-white/95 p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,.08)] backdrop-blur">
          <div className="flex flex-col gap-3.5">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 opacity-45" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search destination country, official visa service or portal URL…"
                className="h-13 w-full rounded-xl border border-black/15 bg-white pl-12 pr-4 text-sm sm:text-base outline-none transition focus:border-[#d97757] focus:ring-2 shadow-sm"
                style={{ ["--tw-ring-color" as any]: "#d97757" }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md bg-black/5 px-2 py-1 text-xs font-semibold text-black/60 hover:bg-black/10"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCountry("ALL")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs sm:text-sm font-bold transition hover:opacity-90"
                style={country === "ALL" ? { background: "#d97757", color: "#141413" } : { background: "#eee9e1", color: "#141413" }}
              >
                <Globe2 className="h-3.5 w-3.5" /> All countries ({data.length})
              </button>
              {countries.map((c) => {
                const count = data.filter((l) => l.country === c).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCountry(c)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs sm:text-sm font-bold transition hover:opacity-90"
                    style={country === c ? { background: "#141413", color: "#e3dacc" } : { background: "#eee9e1", color: "#141413" }}
                  >
                    <FlagImg country={c} size={16} />
                    <span>{c}</span>
                    {count > 0 && <span className="opacity-60 text-[11px]">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d97757]">Official portals</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">{country === "ALL" ? "Visa verification by country" : country}</h2>
          </div>
          <p className="text-xs opacity-50">{grouped.reduce((n, [, links]) => n + links.length, 0)} link{grouped.reduce((n, [, links]) => n + links.length, 0) === 1 ? "" : "s"}</p>
        </div>

        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-14 text-center">
            <Search className="mx-auto mb-3 h-9 w-9 opacity-25" />
            <p className="font-semibold">No visa portals found</p>
            <p className="mt-1 text-sm opacity-55">Try another country or search term.</p>
          </div>
        ) : (
          <div className="space-y-7">
            {grouped.map(([countryName, links]) => (
              <section key={countryName} className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_8px_28px_rgba(0,0,0,.06)]">
                <header className="flex items-center gap-3 border-b border-black/10 bg-[#f1ece4] px-5 py-5 sm:px-6">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white shadow-sm"><FlagImg country={countryName} size={25} /></div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">{countryName}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-45">{links.length} official portal{links.length === 1 ? "" : "s"}</p>
                  </div>
                </header>
                <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
                  {links.map((link) => (
                    <article key={link.id} className="group rounded-2xl border border-black/10 bg-[#fbfaf8] p-5 transition hover:-translate-y-0.5 hover:border-[#d97757]/50 hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#141413] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#e3dacc]"><ShieldCheck className="h-3 w-3" /> Official</span>
                        <span className="truncate text-[10px] opacity-40" title={link.url}>{portalLabel(link.url)}</span>
                      </div>
                      <h4 className="mt-4 text-base font-bold leading-6">{link.purpose}</h4>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d97757] px-4 py-3 text-xs font-black text-[#141413] transition hover:opacity-90">
                        Open official portal <ExternalLink className="h-4 w-4" />
                      </a>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="mt-8 rounded-2xl border border-black/10 bg-white/70 p-4 text-center text-[11px] leading-5 opacity-60">
          Always verify sensitive visa information on the linked official government or authority website. Rohi International Travels does not replace the issuing authority.
        </p>
      </main>
    </div>
  );
}
