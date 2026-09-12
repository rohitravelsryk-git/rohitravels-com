import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") ? s.next : "/",
  }),
  component: AuthPage,
});

function safeNext(n: string) {
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dest = safeNext(next);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: any }) => {
      if (data.session) navigate({ to: dest });
    });
  }, [dest, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}` },
          });
    const { error } = await fn;
    setBusy(false);
    if (error) return setErr(error.message);
    navigate({ to: dest });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 animate-premium-fade">
      <div className="w-full max-w-[420px] animate-premium-scale rounded-3xl bg-card p-8 md:p-10 shadow-[var(--shadow-lg)] border border-border/70">
        <div className="mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gold mb-2">Agent Portal • B2B Access</p>
          <h1 className="font-serif text-3xl font-black text-navy leading-tight">
            Sign in to dashboard
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-medium">
            Access exclusive deals, flight inventory &amp; Umrah bookings
          </p>
          <div className="mt-4 h-1 w-12 bg-gold/30 rounded-full" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gold transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            </div>
            <input
              type="email"
              required
              placeholder="Registered Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-navy/10 bg-secondary/40 px-11 py-3.5 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10 transition-all"
            />
          </div>

          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-gold transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-navy/10 bg-secondary/40 px-11 py-3.5 text-sm outline-none focus:border-gold focus:ring-4 focus:ring-gold/10 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy transition-colors"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88 2 2"/><path d="M17.36 15.36A10 10 0 0 0 20 12a10 10 0 0 0-16.64-4.64"/><circle cx="12" cy="12" r="3"/><path d="m22 22-7.76-7.76"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>

          {err && <p className="text-xs text-red-600 font-bold px-1" role="alert">{err}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-gold px-6 py-4 text-xs font-black uppercase tracking-[0.15em] text-gold-foreground shadow-[var(--shadow-gold)] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-premium)] disabled:opacity-50"
          >
            {busy ? "Authenticating..." : "Continue ›"}
          </button>
        </form>

        <div className="mt-8 space-y-4 text-center">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            For your security, you can enable a one-time code MFA in your profile settings.
          </p>
          
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-[11px] font-bold text-navy/60 hover:text-gold transition-colors"
          >
            {mode === "signin" ? (
              <span>Forgot your password? <span className="text-gold underline underline-offset-4">Recover credentials</span></span>
            ) : (
              <span>Have an account? <span className="text-gold underline underline-offset-4">Sign in</span></span>
            )}
          </button>
        </div>

        <div className="mt-10 rounded-2xl bg-secondary/40 p-5 border border-navy/5 text-left">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-full bg-gold/10 p-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <p className="text-[11px] font-black uppercase tracking-wider text-navy">24/7 Priority Support</p>
          </div>
          <div className="space-y-1 text-[11px] font-medium text-muted-foreground leading-relaxed">
            <p className="text-navy font-bold">+92 305 6622988</p>
            <p>rohitravels@gmail.com | Sardar Market, Shahi Road,</p>
            <p>Rahim Yar Khan</p>
          </div>
        </div>

        <p className="mt-8 text-[10px] text-center text-muted-foreground/60 italic">
          Live group fares &amp; bookings are available inside the portal after sign in.
        </p>
      </div>
    </main>
  );
}
