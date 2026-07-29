import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listFares, type Fare } from "@/lib/fares.functions";
import { AirlineLogo, formatFare } from "@/routes/index";

export const Route = createFileRoute("/agent/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agent Sign In — Rohi International Travels B2B" },
      { name: "description", content: "Sign in to your Rohi Travels agent portal for exclusive deals, flight inventory & Umrah bookings." },
      { property: "og:title", content: "Agent Sign In — Rohi Travels B2B" },
      { property: "og:description", content: "Sign in to your Rohi Travels agent portal." },
    ],
  }),
  component: LoginPage,
});

const URDU_CITIES: Record<string, string> = {
  KARACHI: "کراچی", LAHORE: "لاہور", ISLAMABAD: "اسلام آباد", MULTAN: "ملتان",
  PESHAWAR: "پشاور", QUETTA: "کوئٹہ", FAISALABAD: "فیصل آباد", SIALKOT: "سیالکوٹ",
  JEDDAH: "جدہ", MADINAH: "مدینہ", RIYADH: "ریاض", DAMMAM: "دمام",
  DUBAI: "دبئی", ABUDHABI: "ابوظہبی", SHARJAH: "شارجہ", DOHA: "دوحہ",
  MUSCAT: "مسقط", KUWAIT: "کویت", BAHRAIN: "بحرین", ISTANBUL: "استنبول",
};
function urduRoute(from: string, to: string) {
  const f = URDU_CITIES[from.toUpperCase().replace(/[^A-Z]/g, "")] ?? from;
  const t = URDU_CITIES[to.toUpperCase().replace(/[^A-Z]/g, "")] ?? to;
  return `${f} ${t}`;
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showFares, setShowFares] = useState(true);
  const [fares, setFares] = useState<Fare[]>([]);
  const [faresLoading, setFaresLoading] = useState(true);
  const fetchFares = useServerFn(listFares);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/agent/fares" });
    });
  }, [navigate]);

  useEffect(() => {
    fetchFares()
      .then((data) => setFares(data ?? []))
      .catch(() => setFares([]))
      .finally(() => setFaresLoading(false));
  }, [fetchFares]);

  const grouped = useMemo(() => {
    const map = new Map<string, Fare[]>();
    for (const f of fares) {
      const key = `${(f.origin_code || "—").toUpperCase()}-${(f.destination_code || "—").toUpperCase()}`;
      const arr = map.get(key) ?? [];
      arr.push(f);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [fares]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr(error.message);
    navigate({ to: "/agent/fares" });
  }

  return (
    <main className="min-h-screen bg-hero px-4 py-8">

      <header className="mx-auto flex max-w-6xl items-center justify-between text-white">
        <Link to="/" className="font-serif text-xl font-bold">Rohi Travels B2B</Link>
        <nav className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowFares((v) => !v);
              if (!showFares) setTimeout(() => document.getElementById("public-fares")?.scrollIntoView({ behavior: "smooth" }), 50);
            }}
            className="rounded-lg border border-orange-400/60 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300 hover:bg-orange-500/20"
          >
            {showFares ? "Hide Group Fares" : "Group Fares"}
          </button>
          <Link to="/" className="hidden rounded-lg border border-white/20 px-4 py-2 text-sm sm:inline-flex">About</Link>
          <Link to="/inquiry" className="hidden rounded-lg border border-white/20 px-4 py-2 text-sm sm:inline-flex">Contact</Link>
          <button className="rounded-lg border border-white/30 bg-white/5 px-4 py-2 text-sm">Login</button>
          <Link to="/agent/register" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-[#0b2545]">Register</Link>
        </nav>
      </header>

      <div className="mx-auto mt-8 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#0b2545]/70 p-8 shadow-2xl backdrop-blur">
          <p className="text-[11px] font-bold uppercase tracking-widest text-orange-400">Agent Portal • B2B Access</p>
          <h1 className="mt-3 font-serif text-3xl font-bold text-white">Sign in to dashboard</h1>
          <p className="mt-2 text-sm text-white/60">Access exclusive deals, flight inventory & Umrah bookings</p>
          <div className="mt-3 h-0.5 w-16 bg-orange-500" />

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">✉</span>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Registered Email"
                className="w-full rounded-lg border border-white/20 bg-white/5 py-3 pl-11 pr-4 text-white placeholder:text-white/40 outline-none focus:border-orange-400"
              />
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">🔒</span>
              <input
                type={showPw ? "text" : "password"} required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-white/20 bg-white/5 py-3 pl-11 pr-11 text-white placeholder:text-white/40 outline-none focus:border-orange-400"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white">
                {showPw ? "🙈" : "👁"}
              </button>
            </div>

            {err && <p className="rounded-md bg-red-500/20 border border-red-400/30 px-3 py-2 text-sm text-red-100" role="alert">{err}</p>}

            <button type="submit" disabled={busy}
              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-3.5 text-sm font-bold uppercase tracking-wider text-[#0b2545] shadow-lg hover:from-orange-400 hover:to-orange-300 disabled:opacity-50">
              {busy ? "Signing in…" : "Login to Dashboard ›"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm text-white/70">
            <p>New agent? <Link to="/agent/register" className="font-semibold text-orange-400 hover:text-orange-300">Create an account</Link></p>
            <p>Forgot your password? <button type="button" onClick={() => alert("Password reset via email: setup pending.")} className="font-semibold text-orange-400 hover:text-orange-300">Recover credentials</button></p>
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
            <p className="mb-2 font-bold text-orange-400">📞 24/7 Priority Support</p>
            <p>+92 305 6622988</p>
            <p>rohitravels@gmail.com  |  Sardar Market, Shahi Road,</p>
            <p>Rahim Yar Khan</p>
          </div>
        </div>
      </div>

      {showFares && (
        <section id="public-fares" className="mx-auto mt-12 max-w-7xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
            <div>
              <h2 className="font-serif text-2xl font-bold">Live Group Fares</h2>
              <p className="text-xs text-white/60">Preview our current inventory. Login to book seats.</p>
            </div>
            <span className="rounded-full border border-orange-400/50 bg-orange-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-orange-300">
              {fares.length} fares
            </span>
          </div>

          {faresLoading ? (
            <p className="text-white/60">Loading fares…</p>
          ) : grouped.length === 0 ? (
            <p className="text-white/60">No fares available.</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([sector, rows]) => (
                <div key={sector} className="rounded-xl bg-gradient-to-b from-amber-50/95 to-white p-3 shadow-lg ring-1 ring-amber-100">
                  <div className="mb-3 flex items-center justify-center gap-3">
                    <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/70" />
                    <h3 className="font-serif text-xl font-bold tracking-[0.28em] text-[#0b2545]">{sector}</h3>
                    <span className="text-xl text-amber-500">✈</span>
                    <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/70" />
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white">
                    <table className="w-full table-fixed border-collapse text-xs">
                      <colgroup>
                        <col className="w-[76px]" />
                        <col className="w-[82px]" />
                        <col className="w-[82px]" />
                        <col className="w-[220px]" />
                        <col className="w-[72px]" />
                        <col className="w-[100px]" />
                        <col className="w-[72px]" />
                        <col className="w-[88px]" />
                        <col className="w-[118px]" />
                      </colgroup>
                      <thead className="bg-[#0b1220] text-white">
                        <tr>
                          {["AIRLINE","FROM","TO","FLIGHT DETAILS","LUGGAGE","FARE","MEAL","SEATS","SECTOR"].map((h,i)=>(
                            <th key={i} className="whitespace-nowrap border-r border-white/10 px-2 py-2 text-center text-[10.5px] font-bold uppercase tracking-[0.14em] last:border-r-0">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((f, idx) => {
                          const details = f.flight_details ?? `${f.flight_date} ${f.origin_code} ${f.destination_code}${f.depart_time ? ` ${f.depart_time}` : ""}${f.arrive_time ? ` ${f.arrive_time}` : ""}${f.flight_number ? ` ${f.flight_number}` : ""}`;
                          const priceIsNumeric = /\d/.test(f.price_text || "");
                          const mealVal = (f.meal ?? "").trim().toUpperCase();
                          const mealColor = mealVal === "NOT INCLUDED" || mealVal === "NO" ? "text-red-600" : mealVal === "INCLUDED" || mealVal === "YES" ? "text-emerald-600" : "text-gray-600";
                          return (
                            <tr key={f.id} className={`border-t border-gray-100 align-middle ${idx % 2 === 1 ? "bg-gray-50/60" : ""}`}>
                              <td className="px-2 py-2 text-center">
                                <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                                  <AirlineLogo name={f.airline} height={44} />
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <div className="text-[12px] font-bold text-gray-800 leading-tight">{f.origin.toUpperCase()}</div>
                                <div className="text-[10px] text-gray-500">{f.origin_code}</div>
                              </td>
                              <td className="px-2 py-2 text-center">
                                <div className="text-[12px] font-bold text-gray-800 leading-tight">{f.destination.toUpperCase()}</div>
                                <div className="text-[10px] text-gray-500">{f.destination_code}</div>
                              </td>
                              <td className="px-2 py-2 font-mono text-[11px] leading-snug text-gray-700 whitespace-pre-line break-words">{details}</td>
                              <td className="px-2 py-2 text-center text-[11px] font-medium text-gray-700 whitespace-nowrap">{f.baggage ?? "—"}</td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                {priceIsNumeric ? (
                                  <span className="text-[15px] font-black text-orange-600 tabular-nums">{formatFare(f.price_text)}</span>
                                ) : (
                                  <span className="text-[11px] font-black uppercase leading-tight tracking-wide text-red-600">{f.price_text}</span>
                                )}
                              </td>
                              <td className={`px-2 py-2 text-center text-[11px] font-bold ${mealColor}`}>{f.meal ?? "—"}</td>
                              <td className="px-2 py-2 text-center text-[11px] font-bold whitespace-nowrap text-gray-800">{f.seats ?? "—"}</td>
                              <td dir="rtl" className="font-urdu px-2 py-2 text-center text-[20px] leading-tight text-gray-900 whitespace-nowrap">{urduRoute(f.origin, f.destination)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <p className="text-center text-xs text-white/60">Login above to book any of these fares with live seat availability.</p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
