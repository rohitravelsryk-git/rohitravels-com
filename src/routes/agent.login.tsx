import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  requestAgentLoginCode,
  resendAgentLoginCode,
  verifyAgentLoginCode,
} from "@/lib/agent-otp.functions";

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
  const requestCode = useServerFn(requestAgentLoginCode);
  const verifyCode = useServerFn(verifyAgentLoginCode);
  const resendCode = useServerFn(resendAgentLoginCode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"password" | "code">("password");
  const [challenge, setChallenge] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/agent/fares" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const res = await requestCode({ data: { email: email.trim(), password } });
      if (!res.ok) return setErr(res.error);
      setChallenge(res.challenge);
      setMaskedEmail(res.maskedEmail);
      setStep("code");
      setNote(res.sent ? `Verification code sent to ${res.maskedEmail}.` : "Code created, but the email could not be delivered. Contact support.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyCode({ data: { challenge, code: code.trim() } });
      if (!res.ok) {
        setErr(res.error);
        if (/again/i.test(res.error)) { setStep("password"); setCode(""); }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return setErr(error.message);
      navigate({ to: "/agent/fares" });
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }


  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between text-foreground">
        <Link to="/" className="font-serif text-xl font-bold">Rohi Travels B2B</Link>
        <nav className="flex items-center gap-2">
          <Link to="/" className="hidden rounded-lg border border-border px-4 py-2 text-sm sm:inline-flex">About</Link>
          <Link to="/inquiry" className="hidden rounded-lg border border-border px-4 py-2 text-sm sm:inline-flex">Contact</Link>
          <Link to="/agent/register" className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy">Register</Link>
        </nav>
      </header>

      <div className="mx-auto mt-8 max-w-md">
        <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl backdrop-blur">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ledger-brown)]">Agent Portal • B2B Access</p>
          <h1 className="mt-3 font-serif text-2xl font-bold text-foreground sm:text-3xl">
            {step === "password" ? "Sign in to dashboard" : "Two-step verification"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "password"
              ? "Access exclusive deals, flight inventory & Umrah bookings"
              : `Enter the 6-digit code we emailed to ${maskedEmail}`}
          </p>
          <div className="mt-3 h-0.5 w-16 bg-gold" />

          {step === "password" ? (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">✉</span>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Registered Email"
                className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-11 pr-4 text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
              />
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">🔒</span>
              <input
                type={showPw ? "text" : "password"} required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-border bg-secondary/50 py-3 pl-11 pr-11 text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? "🙈" : "👁"}
              </button>
            </div>

            {err && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">{err}</p>}

            <button type="submit" disabled={busy}
              className="w-full rounded-full bg-gold px-6 py-3.5 text-sm font-black uppercase tracking-wider text-gold-foreground shadow-lg hover:opacity-90 disabled:opacity-50">
              {busy ? "Checking…" : "Continue ›"}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              For your security we email a one-time code after your password.
            </p>
          </form>
          ) : (
          <form onSubmit={submitCode} className="mt-8 space-y-4">
            <input
              inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} required
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 text-center font-mono text-2xl tracking-[0.4em] text-foreground outline-none focus:border-gold"
            />
            {note && !err && <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700">{note}</p>}
            {err && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive" role="alert">{err}</p>}
            <button type="submit" disabled={busy || code.length < 6}
              className="w-full rounded-full bg-gold px-6 py-3.5 text-sm font-black uppercase tracking-wider text-gold-foreground shadow-lg hover:opacity-90 disabled:opacity-50">
              {busy ? "Verifying…" : "Verify & Enter Portal ›"}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => { setStep("password"); setCode(""); setErr(null); }}
                className="font-semibold text-muted-foreground underline underline-offset-2">Back</button>
              <button type="button" disabled={busy}
                onClick={async () => {
                  setBusy(true); setErr(null);
                  try {
                    const r = await resendCode({ data: { challenge } });
                    if (r.ok) { setChallenge(r.challenge); setNote(`New code sent to ${r.maskedEmail}.`); }
                    else setErr(r.error);
                  } finally { setBusy(false); }
                }}
                className="font-semibold text-[color:var(--ledger-brown)] underline underline-offset-2">Resend code</button>
            </div>
          </form>
          )}


          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>New agent? <Link to="/agent/register" className="font-semibold text-[color:var(--ledger-brown)] hover:opacity-80">Create an account</Link></p>
            <p>Forgot your password? <button type="button" onClick={() => alert("Password reset via email: setup pending.")} className="font-semibold text-[color:var(--ledger-brown)] hover:opacity-80">Recover credentials</button></p>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-secondary/50 p-4 text-xs text-muted-foreground">
            <p className="mb-2 font-bold text-[color:var(--ledger-brown)]">📞 24/7 Priority Support</p>
            <p>+92 305 6622988</p>
            <p>rohitravels@gmail.com  |  Sardar Market, Shahi Road,</p>
            <p>Rahim Yar Khan</p>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Live group fares & bookings are available inside the portal after sign in.
          </p>
        </div>
      </div>
    </main>
  );
}
