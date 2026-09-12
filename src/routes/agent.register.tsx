import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { registerAgent } from "@/lib/agent-auth.functions";

export const Route = createFileRoute("/agent/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Register Your Agency — Rohi International Travels B2B" },
      { name: "description", content: "Join Pakistan's most trusted B2B travel network. Register your agency to access live group fares and Umrah packages." },
      { property: "og:title", content: "Register Your Agency — Rohi Travels B2B" },
      { property: "og:description", content: "Join Pakistan's most trusted B2B travel network." },
    ],
  }),
  component: RegisterPage,
});

const COUNTRY_CODES = [
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+968", label: "🇴🇲 +968" },
  { code: "+973", label: "🇧🇭 +973" },
  { code: "+974", label: "🇶🇦 +974" },
  { code: "+965", label: "🇰🇼 +965" },
];

function RegisterPage() {
  const navigate = useNavigate();
  const register = useServerFn(registerAgent);
  const [form, setForm] = useState({
    agency_name: "",
    email: "",
    contact_person: "",
    city: "",
    country_code: "+92",
    cell_number: "",
    office_address: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<{ user_code: string; agency_name: string; email: string } | null>(null);

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      const res = await register({
        data: {
          agency_name: form.agency_name,
          email: form.email,
          password: form.password,
          contact_person: form.contact_person,
          city: form.city,
          country_code: form.country_code,
          cell_number: form.cell_number,
          office_address: form.office_address,
        },
      });
      setBusy(false);
      setOk({
        user_code: res?.user_code ?? "—",
        agency_name: res?.agency_name ?? form.agency_name,
        email: res?.email ?? form.email,
      });
    } catch (e: unknown) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Registration failed");
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 animate-premium-fade">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground">← Back to site</Link>
          <Link to="/agent/login" className="rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-[color:var(--ledger-brown)] transition hover:bg-gold/10">Already registered? Sign in →</Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl backdrop-blur">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-[color:var(--ledger-brown)]">Rohi Travels B2B</p>
          <h1 className="mt-2 text-center font-serif text-4xl font-bold text-foreground">Register Your Agency</h1>
          <div className="mx-auto mt-3 h-0.5 w-16 bg-gold" />
          <p className="mt-2 text-center text-sm text-muted-foreground">Join Pakistan's most trusted B2B travel network</p>

          <form onSubmit={submit} className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">

              <Field label="Agency Name" required value={form.agency_name} onChange={(v) => upd("agency_name", v)} placeholder="Agency Name" />
              <Field label="Email" required type="email" value={form.email} onChange={(v) => upd("email", v)} placeholder="Email" />
              <Field label="Person" required value={form.contact_person} onChange={(v) => upd("contact_person", v)} placeholder="Contact Person Full Name" />
              <Field label="City" required value={form.city} onChange={(v) => upd("city", v)} placeholder="City Name" />


              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--ledger-brown)]">Country Code *</label>
                <select
                  value={form.country_code}
                  onChange={(e) => upd("country_code", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-foreground outline-none focus:border-gold"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-navy">{c.label}</option>
                  ))}
                </select>
              </div>
              <Field label="Cell Number" required value={form.cell_number} onChange={(v) => upd("cell_number", v)} placeholder="3336688987" />

              <div className="md:col-span-2">
                <Field label="Office Address" required value={form.office_address} onChange={(v) => upd("office_address", v)} placeholder="Full Office Address" />
              </div>

              <div className="md:col-span-2">
                <Field label="Password (min 6 chars)" required type="password" value={form.password} onChange={(v) => upd("password", v)} placeholder="Choose a password" minLength={6} />
              </div>

              {err && <p className="md:col-span-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" role="alert">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="md:col-span-2 rounded-full bg-gold px-8 py-4 text-base font-black uppercase tracking-wider text-gold-foreground shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Registering…" : "Register Now →"}
              </button>
          </form>
        </div>
      </div>

      {ok && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-gold/40 bg-background shadow-[0_30px_80px_-20px_rgba(11,37,69,.6)]">
            <div className="bg-navy px-8 py-7 text-center text-navy-foreground">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gold text-3xl text-gold-foreground">✓</div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold">Rohi International Travels</p>
              <h2 className="mt-2 font-serif text-3xl font-bold">Registration Received</h2>
              <div className="mx-auto mt-3 h-0.5 w-14 bg-gold" />
            </div>

            <div className="px-8 py-7">
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                Thank you, <span className="font-bold text-foreground">{ok.agency_name}</span>. Your application is
                now <span className="font-bold text-[color:var(--ledger-brown)]">pending admin approval</span>.
                A confirmation has been emailed to <span className="font-semibold text-foreground">{ok.email}</span>.
              </p>

              <div className="mt-6 rounded-xl border border-border bg-card p-5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[color:var(--ledger-brown)]">Your Agency Code</p>
                <p className="mt-2 font-serif text-3xl font-black tracking-[0.2em] text-navy">{ok.user_code}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">Keep this code for all correspondence with our team.</p>
              </div>

              <ol className="mt-6 space-y-2 text-[13px] text-muted-foreground">
                <li>1. Our team reviews your agency details.</li>
                <li>2. You receive an approval email with your sign-in link.</li>
                <li>3. Sign in to access live group fares &amp; bookings.</li>
              </ol>

              <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => navigate({ to: "/agent/login" })}
                  className="flex-1 rounded-full bg-gold px-6 py-3 text-sm font-black uppercase tracking-wider text-gold-foreground shadow-md transition hover:opacity-90"
                >
                  Go to sign in →
                </button>
                <Link
                  to="/"
                  className="flex-1 rounded-full border border-border bg-card px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-foreground transition hover:bg-secondary"
                >
                  Back to homepage
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );

}

function Field({
  label, value, onChange, placeholder, required, type = "text", minLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string; minLength?: number;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-[color:var(--ledger-brown)]">{label}{required ? " *" : ""}</label>
      <input
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
      />
    </div>
  );
}
