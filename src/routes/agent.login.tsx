import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageCircle,
  Plane,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  requestAgentLoginCode,
  resendAgentLoginCode,
  verifyAgentLoginCode,
  syncAgentProfile,
} from "@/lib/agent-otp.functions";
import { cleanAuthErrorMessage } from "@/lib/auth-error-cleanup";

export const Route = createFileRoute("/agent/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agent Sign In — Rohi International Travels B2B Portal" },
      {
        name: "description",
        content:
          "Authorized B2B Agent Portal for Rohi International Travels. Access exclusive fares, packages, and instant reservations.",
      },
      { property: "og:title", content: "Agent B2B Portal — Rohi International Travels" },
      { property: "og:description", content: "Sign in to your Rohi Travels B2B partner account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { data: psfData } = useQuery({ queryKey: ["site-settings", "psf"], queryFn: () => getPsf() });
  const navigate = useNavigate();
  const router = useRouter();
  const requestCode = useServerFn(requestAgentLoginCode);
  const verifyCode = useServerFn(verifyAgentLoginCode);
  const resendCode = useServerFn(resendAgentLoginCode);
  const syncProfile = useServerFn(syncAgentProfile);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<"password" | "code">("password");
  const [challenge, setChallenge] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [showForgotNote, setShowForgotNote] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("rohi_agent_login_email");
      if (savedEmail) {
        setEmail(savedEmail);
      }
    } catch {
      // ignore
    }
  }, []);

  async function sendPasswordReset() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setErr("Enter your agent email first, then choose Forgot password.");
      return;
    }
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/agent/reset-password`,
      });
      if (error) {
        setErr(cleanAuthErrorMessage(error, "Unable to send a password reset email. Please try again."));
        return;
      }
      setNote("If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.");
      setShowForgotNote(false);
    } catch (resetError) {
      setErr(cleanAuthErrorMessage(resetError, "Unable to send a password reset email. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setNote(null);
    const trimmedEmail = email.trim().toLowerCase();

    try {
      if (rememberMe) {
        try {
          localStorage.setItem("rohi_agent_login_email", trimmedEmail);
        } catch {}
      } else {
        try {
          localStorage.removeItem("rohi_agent_login_email");
        } catch {}
      }

      // Validate credentials through the server-side auth flow. This avoids
      // browser-side key/session mismatches and returns a session when MFA is off.
      const res = await requestCode({ data: { email: trimmedEmail, password } });
      if (!res.ok) {
        setErr(cleanAuthErrorMessage(res.error, "Unable to sign in. Please verify your email and password."));
        return;
      }

      if (!(res as any).skipMfa) {
        setChallenge((res as any).challenge || "");
        setMaskedEmail((res as any).maskedEmail || "");
        setStep("code");
        setNote(
          (res as any).sent
            ? `Verification code sent to ${(res as any).maskedEmail}.`
            : "Code created, but the email could not be delivered. Contact priority desk."
        );
        return;
      }

      const session = (res as any).session;
      if (!session?.access_token || !session?.refresh_token) {
        setErr("Sign-in was verified, but a secure session could not be created. Please try again.");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (sessionError || !sessionData.user) {
        setErr(cleanAuthErrorMessage(sessionError, "Unable to establish your session. Please try again."));
        return;
      }

      try {
        await syncProfile({ data: { email: trimmedEmail, userId: sessionData.user.id } });
      } catch (profileErr) {
        console.warn("syncProfile failed, continuing:", profileErr);
      }

      // Preserve the legacy suspended-account guard for existing agent records.
      const { data: agent, error: agentLookupError } = await supabase
        .from("registered_agents")
        .select("status")
        .eq("auth_user_id", sessionData.user.id)
        .maybeSingle();

      if (agentLookupError) {
        console.warn("Agent status lookup failed after authentication:", agentLookupError);
      }
      if (agent?.status === "suspended") {
        await supabase.auth.signOut();
        setErr("Your agency account has been suspended. Please contact the priority partner desk.");
        return;
      }

      await router.invalidate();
      await navigate({ to: "/agent/fares" });
    } catch (e2) {
      setErr(cleanAuthErrorMessage(e2, "Unable to sign in. Please verify your connection and try again."));
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
        const errorText = cleanAuthErrorMessage(res.error, "Verification failed. Please try again.");
        setErr(errorText);
        if (/again/i.test(errorText)) {
          setStep("password");
          setCode("");
        }
        return;
      }
      if ((res as any).tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: (res as any).tokenHash,
          type: "magiclink",
        });
        if (!otpError) {
          await router.invalidate();
          navigate({ to: "/agent/fares" });
          return;
        }
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setErr(cleanAuthErrorMessage(error, "Verification successful, but sign-in failed. Please check your password."));
        return;
      }
      await router.invalidate();
      navigate({ to: "/agent/fares" });
    } catch (e2) {
      setErr(cleanAuthErrorMessage(e2, "Verification error. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const stats = [
    { value: "5,000+", label: "Travel Partners", icon: Users },
    { value: "200+", label: "Global Destinations", icon: Plane },
    { value: "1M+", label: "Bookings Processed", icon: TrendingUp },
    { value: "99%", label: "Partner Satisfaction", icon: CheckCircle2 },
  ];

  return (
    <main className="relative min-h-screen bg-[#F4EFEA] text-[#1C1917] selection:bg-[#D97757] selection:text-white">
      {/* Background ambient warmth */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-[#E8B69E]/25 blur-3xl" />
        <div className="absolute right-0 top-1/4 h-[32rem] w-[32rem] rounded-full bg-white/70 blur-3xl" />
      </div>

      {/* Single clean header */}
      <header className="relative z-10 border-b border-[#302C29] bg-[#141413] text-[#FAF9F5]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <Link to="/" className="group flex items-center gap-3.5" aria-label="Rohi International Travels home">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#D97757] text-white shadow-md shadow-[#D97757]/20 transition-transform group-hover:scale-105">
              <Plane className="h-5 w-5 -rotate-12" />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-2xl font-bold tracking-tight text-[#FAF9F5]">Rohi</span>
              <span className="block text-[9px] font-bold uppercase tracking-[.25em] text-[#B7A99E]">
                International Travels
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-medium text-[#B7A99E] md:inline">Not an agent yet?</span>
            {!psfData?.registrationHidden ? (
              <Link
                to="/agent/register"
                className="inline-flex items-center gap-2 rounded-xl border border-[#D97757]/40 bg-white/80 px-4 py-2 text-xs font-bold text-[#D97757] shadow-sm transition hover:border-[#D97757] hover:bg-[#D97757] hover:text-white"
              >
                Request Access
              </Link>
            ) : (
              <a
                href="https://wa.me/923056622988?text=Hello%2C%20I%20would%20like%20to%20register%20as%20a%20partner%20agent%20with%20Rohi%20Travels"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#D97757]/40 bg-white/80 px-4 py-2 text-xs font-bold text-[#D97757] shadow-sm transition hover:border-[#D97757] hover:bg-[#D97757] hover:text-white"
              >
                Contact Desk
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main split-screen container */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-14">
          {/* Left Column: Editorial & Airplane Hero */}
          <div className="relative flex flex-col justify-between space-y-8 overflow-hidden rounded-[32px] border border-[#302C29] bg-[#141413] p-6 text-[#FAF9F5] shadow-2xl shadow-black/20 sm:p-9 lg:col-span-7 lg:min-h-[760px] lg:p-10">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7DED5] pb-3">
                <span className="text-[10px] font-bold uppercase tracking-[.28em] text-[#E9A48A]">
                  B2B Agent Portal
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#B7A99E]">
                  Global Destinations · Stronger Together
                </span>
              </div>

              <h1 className="font-serif text-4xl font-normal tracking-tight text-[#FAF9F5] sm:text-5xl lg:text-6xl">
                Your Trusted <br className="hidden sm:inline" />
                <span className="italic text-[#E9A48A]">Travel Partner</span>
              </h1>

              <p className="text-xs font-bold uppercase tracking-[.3em] text-[#B7A99E]">
                Flights &middot; Hotels &middot; Holidays &middot; Visas
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-sm backdrop-blur-sm transition hover:bg-white/10"
                  >
                    <Icon className="h-5 w-5 text-[#D97757]" />
                    <div className="mt-3 font-serif text-2xl font-bold tracking-tight text-[#FAF9F5]">{s.value}</div>
                    <div className="mt-1 text-[11px] leading-tight text-[#B7A99E]">{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Airplane Hero Card */}
            <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#302C29] shadow-lg shadow-black/20">
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#302C29]">
                <img
                  src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=82"
                  alt="Rohi International Travels commercial airliner flying over golden sunset clouds"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#141413]/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-[#D97757] animate-pulse" />
                    <p className="text-[11px] font-bold uppercase tracking-[.25em] text-[#FAF9F5]">
                      Travel Further. Together.
                    </p>
                  </div>
                  <span className="hidden text-[10px] uppercase tracking-[.2em] text-[#FAF9F5]/80 sm:inline">
                    People · Places · Possibilities
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Floating Card */}
          <div className="w-full lg:col-span-5">
            <div className="overflow-hidden rounded-[28px] border border-[#E7DED5] bg-[#FAF9F5] shadow-[0_20px_60px_rgba(64,42,29,0.08)]">
              {/* Top terracotta gradient accent */}
              <div className="h-1.5 bg-gradient-to-r from-[#B85C40] via-[#D97757] to-[#E9B39B]" />

              <div className="p-7 sm:p-9">
                <div className="mb-7">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#D97757]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#B85C40]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {step === "password" ? "Partner Access" : "Security Verification"}
                  </div>
                  <h2 className="mt-3 font-serif text-3xl font-medium tracking-tight text-[#1C1917]">
                    {step === "password" ? "Welcome Back" : "Verify Identity"}
                  </h2>
                  <p className="mt-1.5 text-sm text-[#766B62]">
                    {step === "password"
                      ? "Sign in to your Rohi International Travels B2B Agent Portal."
                      : `Enter the 6-digit code sent to ${maskedEmail || "your email"}.`}
                  </p>
                </div>

                {step === "password" ? (
                  <form onSubmit={submit} className="space-y-5">
                    <div>
                      <label htmlFor="agent-email" className="mb-2 block text-xs font-bold uppercase tracking-[.14em] text-[#57504A]">
                        Agent Email
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94877D]" />
                        <input
                          id="agent-email"
                          type="email"
                          autoComplete="username"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@youragency.com"
                          className="w-full rounded-xl border border-[#E7DED5] bg-white py-3.5 pl-11 pr-4 text-sm text-[#1C1917] placeholder:text-[#91877F] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label htmlFor="agent-password" className="text-xs font-bold uppercase tracking-[.14em] text-[#57504A]">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => { setShowForgotNote((v) => !v); setErr(null); setNote(null); }}
                          className="text-xs font-semibold text-[#B85C40] underline-offset-4 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>

                      {showForgotNote && (
                        <div className="mb-3 space-y-3 rounded-xl border border-[#E7DED5] bg-[#F4EFEA] p-3">
                          <p className="text-xs leading-5 text-[#655A51]">We’ll email a secure password reset link to the agent email above.</p>
                          <button type="button" onClick={sendPasswordReset} disabled={busy} className="w-full rounded-lg bg-[#141413] px-4 py-3 text-xs font-bold text-white disabled:opacity-60">
                            {busy ? "Sending reset link…" : "Send password reset link"}
                          </button>
                        </div>
                      )}

                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94877D]" />
                        <input
                          id="agent-password"
                          type={showPw ? "text" : "password"}
                          autoComplete="current-password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full rounded-xl border border-[#E7DED5] bg-white py-3.5 pl-11 pr-12 text-sm text-[#1C1917] placeholder:text-[#91877F] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[#81766D] transition hover:text-[#B85C40]"
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#6F655D]">
                      <label className="flex cursor-pointer select-none items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 rounded border-[#E7DED5] text-[#D97757] accent-[#D97757] focus:ring-[#D97757]"
                        />
                        <span>Remember me</span>
                      </label>
                    </div>

                    {note && (
                      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm leading-5 text-emerald-800">{note}</div>
                    )}

                    {err && (
                      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800">
                        {err}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#D97757] px-5 py-4 text-sm font-bold text-white shadow-md shadow-[#D97757]/20 transition hover:bg-[#BD6346] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? "Verifying credentials…" : "Sign In"}
                      {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={submitCode} className="space-y-5">
                    <div>
                      <label htmlFor="agent-code" className="mb-2 block text-xs font-bold uppercase tracking-[.14em] text-[#57504A]">
                        6-Digit Security Code
                      </label>
                      <input
                        id="agent-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••••"
                        className="w-full rounded-xl border border-[#E7DED5] bg-white px-4 py-4 text-center font-mono text-2xl tracking-[.5em] text-[#1C1917] outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15"
                      />
                    </div>

                    {note && !err && (
                      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        {note}
                      </div>
                    )}

                    {err && (
                      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
                        {err}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy || code.length < 6}
                      className="w-full rounded-xl bg-[#141413] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#302C29] disabled:opacity-50"
                    >
                      {busy ? "Verifying code…" : "Verify & Enter Portal"}
                    </button>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("password");
                          setCode("");
                          setErr(null);
                        }}
                        className="font-semibold text-[#766B62] underline underline-offset-4 hover:text-[#1C1917]"
                      >
                        ← Back to password
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setErr(null);
                          try {
                            const r = await resendCode({ data: { challenge } });
                            if (r.ok) {
                              setChallenge(r.challenge);
                              setNote(`New verification code delivered to ${r.maskedEmail}.`);
                            } else {
                              setErr(cleanAuthErrorMessage(r.error, "Failed to resend code. Please try signing in again."));
                            }
                          } catch (e2) {
                            setErr(cleanAuthErrorMessage(e2, "Failed to resend code. Please try signing in again."));
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="font-bold text-[#B85C40] hover:underline disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    </div>
                  </form>
                )}

                {/* Divider */}
                <div className="my-6 flex items-center gap-3 text-xs text-[#94877D]">
                  <span className="h-px flex-1 bg-[#E7DED5]" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-[#E7DED5]" />
                </div>

                {/* WhatsApp Support Help Desk */}
                <a
                  href="https://wa.me/923056622988?text=Hello%20Rohi%20Travels%20Desk%2C%20I%20need%20assistance%20with%20my%20B2B%20Agent%20Portal%20account"
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-[#E7DED5] bg-[#F4EFEA]/80 p-3.5 transition hover:border-[#D97757]/60 hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <MessageCircle className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#1C1917]">Need Help? Chat with Partner Support</p>
                      <p className="text-[11px] text-[#766B62]">WhatsApp us for quick assistance (+92 305 6622988)</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#94877D] transition-transform group-hover:translate-x-1 group-hover:text-[#D97757]" />
                </a>

                {/* Agency registration note */}
                <div className="mt-6 text-center text-xs text-[#766B62]">
                  {!psfData?.registrationHidden ? (
                    <p>
                      Not registered with Rohi yet?{" "}
                      <Link
                        to="/agent/register"
                        className="font-bold text-[#B85C40] underline decoration-[#D97757]/40 underline-offset-4 hover:decoration-[#D97757]"
                      >
                        Register your agency
                      </Link>
                    </p>
                  ) : (
                    <p>New agency registration is managed through priority desk onboarding.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom branding footer */}
            <div className="mt-6 text-center space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#B7A99E]">
                Rohi International Travels
              </p>
              <p className="text-[9px] uppercase tracking-[.2em] text-[#766B62]">
                Trusted by Agents &middot; Connecting the World
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
