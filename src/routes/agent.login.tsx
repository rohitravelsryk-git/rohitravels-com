import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageCircle,
  Plane,
  ShieldCheck,
  CheckCircle2,
  Ticket,
  FileSpreadsheet,
  Headphones,
  Sparkles,
  PhoneCall,
  ChevronRight,
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
          "Authorized B2B Agent Portal for Rohi International Travels. Access exclusive group fares, packages, and instant reservations.",
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
      setErr("Enter your agent email first, then click Forgot password.");
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
      const { data: agent, error: agentLookupError } = await (supabase as any).from("registered_agents")
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

  return (
    <div className="min-h-screen bg-[#F4EFEA] text-[#1C1917] flex flex-col font-sans selection:bg-[#D97757] selection:text-white">
      {/* Top Navbar — TravelUstaad Style: Crisp, Clean, Professional */}
      <nav className="w-full bg-white border-b border-[#E7E5E4] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group" aria-label="Rohi International Travels">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D97757] text-white shadow-sm transition-transform group-hover:scale-105">
              <Plane className="h-5 w-5 -rotate-12" />
            </span>
            <div className="leading-tight">
              <span className="block font-serif text-xl font-bold tracking-tight text-[#141413]">
                Rohi <span className="text-[#D97757]">Travels</span>
              </span>
              <span className="block text-[9px] font-bold uppercase tracking-[.22em] text-[#78716C]">
                B2B Agent Portal
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="https://wa.me/923056622988?text=Hello%20Rohi%20Travels%20Desk%2C%20I%20need%20assistance%20with%20my%20B2B%20Agent%20Portal"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-[#1C1917] hover:text-[#D97757] transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Partner Help Desk:</span>
              <span className="font-bold">+92 305 6622988</span>
            </a>

            {!psfData?.registrationHidden ? (
              <Link
                to="/agent/register"
                className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-[#D97757]/30 bg-[#FAF9F5] px-3 py-1.5 text-xs font-semibold text-[#D97757] hover:bg-[#D97757] hover:text-white transition-all shadow-xs"
              >
                <span>Register Agency</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: B2B Highlights & Perks (TravelUstaad marketing showcase) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D97757]/20 bg-[#D97757]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#D97757]">
              <ShieldCheck className="h-4 w-4 text-[#D97757]" />
              <span>Official B2B Partner Portal</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#141413] tracking-tight leading-tight">
                Pakistan’s Trusted <br className="hidden sm:inline" />
                <span className="text-[#D97757]">B2B Travel Network</span>
              </h1>
              <p className="text-sm sm:text-base text-[#78716C] max-w-xl leading-relaxed">
                Empowering travel agencies across Pakistan with direct consolidated group fares, real-time PNR booking, automated ledger accounting, and 24/7 dedicated support.
              </p>
            </div>

            {/* 4 Feature Cards (TravelUstaad Style Perks Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-white rounded-xl border border-[#E7E5E4] p-4.5 shadow-xs hover:border-[#D97757]/40 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-[#D97757]/10 text-[#D97757] flex items-center justify-center mb-3">
                  <Ticket className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#141413] mb-1">Airline Group Fares</h3>
                <p className="text-xs text-[#78716C] leading-normal">
                  Exclusive locked seat allocations on SalamAir, PIA, Saudia, AirSial, Fly Jinnah, and more.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-[#E7E5E4] p-4.5 shadow-xs hover:border-[#D97757]/40 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-[#141413]/5 text-[#141413] flex items-center justify-center mb-3">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#141413] mb-1">Instant PNR Confirmation</h3>
                <p className="text-xs text-[#78716C] leading-normal">
                  Reserve, hold, and confirm seats in real time with automatic agency branding on e-tickets.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-[#E7E5E4] p-4.5 shadow-xs hover:border-[#D97757]/40 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-[#141413]/5 text-[#141413] flex items-center justify-center mb-3">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#141413] mb-1">Live Agent Ledger</h3>
                <p className="text-xs text-[#78716C] leading-normal">
                  Transparent running balances, receipt postings, bank transfers, and automated reconciliation.
                </p>
              </div>

              <div className="bg-white rounded-xl border border-[#E7E5E4] p-4.5 shadow-xs hover:border-[#D97757]/40 transition-colors">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                  <Headphones className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-[#141413] mb-1">24/7 Priority Support</h3>
                <p className="text-xs text-[#78716C] leading-normal">
                  Direct WhatsApp priority line for rapid flight reissues, date modifications, and refunds.
                </p>
              </div>
            </div>

            {/* Trust Banner Bar */}
            <div className="flex items-center gap-4 pt-2 text-xs text-[#78716C]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Zero Hidden Fees</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Instant Ticket Issuance</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Verified Partner Desk</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Form Box (Exact TravelUstaad Form Layout) */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white rounded-2xl border border-[#E7E5E4] shadow-md p-6 sm:p-8">
              
              {/* Form Header with Logo */}
              <div className="text-center mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D97757] text-white shadow-sm mb-3">
                  <Plane className="h-6 w-6 -rotate-12" />
                </div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#141413] tracking-tight">
                  {step === "password" ? "Sign in to Rohi B2B" : "Security Verification"}
                </h2>
                <p className="text-xs sm:text-sm text-[#78716C] mt-1">
                  {step === "password"
                    ? "Enter your registered agent credentials below"
                    : `Enter the 6-digit code sent to ${maskedEmail || "your email"}`}
                </p>
              </div>

              {/* Status Note Banner */}
              {note && (
                <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
                  {note}
                </div>
              )}

              {/* Error Alert Banner */}
              {err && (
                <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-800">
                  {err}
                </div>
              )}

              {step === "password" ? (
                <form onSubmit={submit} className="space-y-4">
                  {/* Email Field */}
                  <div>
                    <label htmlFor="agent-email" className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                      Email <span className="text-[#D97757]">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
                      <input
                        id="agent-email"
                        type="email"
                        autoComplete="username"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="agent@agency.com"
                        className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] py-3 pl-10 pr-3.5 text-sm text-[#1C1917] placeholder:text-[#A8A29E] outline-none transition focus:bg-white focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/20"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="agent-password" className="text-xs font-semibold text-[#1C1917]">
                        Password <span className="text-[#D97757]">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotNote((v) => !v);
                          setErr(null);
                          setNote(null);
                        }}
                        className="text-xs font-medium text-[#D97757] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {showForgotNote && (
                      <div className="mb-3 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3 space-y-2">
                        <p className="text-xs text-[#78716C] leading-relaxed">
                          We will send a secure password reset link to the email entered above.
                        </p>
                        <button
                          type="button"
                          onClick={sendPasswordReset}
                          disabled={busy}
                          className="w-full rounded-lg bg-[#141413] py-2 px-3 text-xs font-bold text-white transition hover:bg-[#262624] disabled:opacity-50"
                        >
                          {busy ? "Sending link..." : "Send Password Reset Link"}
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
                      <input
                        id="agent-password"
                        type={showPw ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] py-3 pl-10 pr-10 text-sm text-[#1C1917] placeholder:text-[#A8A29E] outline-none transition focus:bg-white focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-[#78716C] hover:text-[#1C1917]"
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs text-[#78716C] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-[#E7E5E4] text-[#D97757] accent-[#D97757] focus:ring-[#D97757]"
                      />
                      <span>Remember my email</span>
                    </label>
                  </div>

                  {/* Submit Button (TravelUstaad Style: Full-width prominent button) */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#D97757] py-3 px-4 text-sm font-bold text-white shadow-sm transition-all hover:bg-[#BD6346] focus:outline-none focus:ring-2 focus:ring-[#D97757] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {busy ? (
                        <span>Please Wait...</span>
                      ) : (
                        <>
                          <span>Login</span>
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* Sign-up Prompt (Exact TravelUstaad Style: "Don't have account? Click Here to Sign-up") */}
                  <div className="text-center pt-2 text-xs text-[#78716C]">
                    {!psfData?.registrationHidden ? (
                      <p>
                        Don’t have an account?{" "}
                        <Link to="/agent/register" className="font-bold text-[#D97757] hover:underline">
                          Click Here to Sign-up
                        </Link>
                      </p>
                    ) : (
                      <p>
                        Don’t have an account?{" "}
                        <a
                          href="https://wa.me/923056622988?text=Hello%20Rohi%20Travels%2C%20I%20want%20to%20register%20my%20agency%20for%20the%20B2B%20Agent%20Portal"
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-[#D97757] hover:underline"
                        >
                          Contact Desk to Register
                        </a>
                      </p>
                    )}
                  </div>
                </form>
              ) : (
                <form onSubmit={submitCode} className="space-y-4">
                  <div>
                    <label htmlFor="agent-code" className="block text-xs font-semibold text-[#1C1917] mb-1.5">
                      6-Digit Security Code <span className="text-[#D97757]">*</span>
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
                      className="w-full rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] py-3 px-4 text-center font-mono text-2xl tracking-[.4em] text-[#1C1917] outline-none transition focus:bg-white focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/20"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={busy || code.length < 6}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#141413] py-3 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#262624] disabled:opacity-50"
                    >
                      {busy ? "Verifying..." : "Verify & Enter Portal"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("password");
                        setCode("");
                        setErr(null);
                      }}
                      className="text-[#78716C] hover:text-[#1C1917] hover:underline"
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
                      className="font-bold text-[#D97757] hover:underline disabled:opacity-50"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}

              {/* Divider & WhatsApp Direct Contact */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E7E5E4]"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#78716C]">Need Immediate Help?</span>
                </div>
              </div>

              <a
                href="https://wa.me/923056622988?text=Hello%20Rohi%20Travels%20Desk%2C%20I%20need%20assistance%20logging%20in%20to%20my%20B2B%20Agent%20Account"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3 transition hover:border-[#D97757] hover:bg-white"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-[#1C1917]">Chat with Partner Support</p>
                    <p className="text-[11px] text-[#78716C]">WhatsApp Priority Desk (+92 305 6622988)</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#78716C] transition-transform group-hover:translate-x-1 group-hover:text-[#D97757]" />
              </a>

            </div>
          </div>

        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="w-full border-t border-[#E7E5E4] bg-white py-4 text-center text-xs text-[#78716C]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} Rohi International Travels. All rights reserved.</p>
          <p className="text-[11px] text-[#A8A29E]">Authorized B2B Portal · Encrypted 256-bit Connection</p>
        </div>
      </footer>
    </div>
  );
}
