import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/agent/fares" });
    });
  }, [navigate]);

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
          <Link to="/" className="hidden rounded-lg border border-white/20 px-4 py-2 text-sm sm:inline-flex">About</Link>
          <Link to="/inquiry" className="hidden rounded-lg border border-white/20 px-4 py-2 text-sm sm:inline-flex">Contact</Link>
          <Link to="/agent/register" className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-2 text-sm font-bold text-navy">Register</Link>
        </nav>
      </header>

      <div className="mx-auto mt-8 max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#0b2545]/70 p-8 shadow-2xl backdrop-blur">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gold">Agent Portal • B2B Access</p>
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
              className="w-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-6 py-3.5 text-sm font-black uppercase tracking-wider text-navy shadow-lg hover:from-orange-400 hover:to-orange-300 disabled:opacity-50">
              {busy ? "Signing in…" : "Login to Dashboard ›"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-sm text-white/70">
            <p>New agent? <Link to="/agent/register" className="font-semibold text-gold hover:text-orange-300">Create an account</Link></p>
            <p>Forgot your password? <button type="button" onClick={() => alert("Password reset via email: setup pending.")} className="font-semibold text-gold hover:text-orange-300">Recover credentials</button></p>
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/70">
            <p className="mb-2 font-bold text-gold">📞 24/7 Priority Support</p>
            <p>+92 305 6622988</p>
            <p>rohitravels@gmail.com  |  Sardar Market, Shahi Road,</p>
            <p>Rahim Yar Khan</p>
          </div>

          <p className="mt-6 text-center text-[11px] text-white/50">
            Live group fares & bookings are available inside the portal after sign in.
          </p>
        </div>
      </div>
    </main>
  );
}
