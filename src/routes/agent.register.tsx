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
  const [ok, setOk] = useState(false);

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    try {
      await register({
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
    } catch (e: unknown) {
      setBusy(false);
      setErr(e instanceof Error ? e.message : "Registration failed");
      return;
    }
    setBusy(false);
    setOk(true);
    setTimeout(() => navigate({ to: "/agent/login" }), 2500);
  }

  return (
    <main className="min-h-screen bg-hero px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="rounded-lg border border-gold/20 px-4 py-2 text-sm text-navy-foreground/80 transition hover:bg-white/10 hover:text-navy-foreground">← Back to site</Link>
          <Link to="/agent/login" className="rounded-lg border border-gold/40 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/10">Already registered? Sign in →</Link>
        </div>

        <div className="rounded-2xl border border-gold/10 bg-navy/70 p-8 shadow-2xl backdrop-blur">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-gold">Rohi Travels B2B</p>
          <h1 className="mt-2 text-center font-serif text-4xl font-bold text-navy-foreground">Register Your Agency</h1>
          <div className="mx-auto mt-3 h-0.5 w-16 bg-gold" />
          <p className="mt-2 text-center text-sm text-navy-foreground/70">Join Pakistan's most trusted B2B travel network</p>

          {ok ? (
            <div className="mt-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 p-6 text-center text-emerald-100">
              <p className="font-semibold">Registration submitted!</p>
              <p className="mt-1 text-sm">Your agency is pending admin approval. Redirecting to sign-in…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label="Agency Name" required value={form.agency_name} onChange={(v) => upd("agency_name", v)} placeholder="Agency Name" />
              <Field label="Email" required type="email" value={form.email} onChange={(v) => upd("email", v)} placeholder="Email" />
              <Field label="Contact Person Name" required value={form.contact_person} onChange={(v) => upd("contact_person", v)} placeholder="Full Name" />
              <Field label="City" required value={form.city} onChange={(v) => upd("city", v)} placeholder="City Name" />

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gold">Country Code *</label>
                <select
                  value={form.country_code}
                  onChange={(e) => upd("country_code", e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gold/20 bg-white/5 px-4 py-3 text-navy-foreground outline-none focus:border-gold"
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

              {err && <p className="md:col-span-2 rounded-md bg-red-500/20 border border-red-400/30 px-3 py-2 text-sm text-red-100" role="alert">{err}</p>}

              <button
                type="submit"
                disabled={busy}
                className="md:col-span-2 rounded-full bg-gold px-8 py-4 text-base font-black uppercase tracking-wider text-gold-foreground shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Registering…" : "Register Now →"}
              </button>
            </form>
          )}
        </div>
      </div>
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
      <label className="block text-[11px] font-bold uppercase tracking-wider text-gold">{label}{required ? " *" : ""}</label>
      <input
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-gold/20 bg-white/5 px-4 py-3 text-navy-foreground placeholder:text-navy-foreground/40 outline-none focus:border-gold"
      />
    </div>
  );
}
