import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Mail,
  Plane,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  requestAgentLoginCode,
  resendAgentLoginCode,
  verifyAgentLoginCode,
} from "@/lib/agent-otp.functions";

const WA_COMMUNITY_URL = "https://chat.whatsapp.com/K295wuWsea1I5TP026UGqA";

export const Route = createFileRoute("/agent/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agent Sign In — Rohi International Travels B2B Portal" },
      {
        name: "description",
        content:
          "Authorized B2B Agent Portal for Rohi International Travels. Access exclusive net fares, Umrah packages, flight inventories, and instant reservations.",
      },
      { property: "og:title", content: "Agent B2B Portal — Rohi International Travels" },
      {
        property: "og:description",
        content: "Log in to your Rohi Travels B2B partner account.",
      },
    ],
  }),
  component: LoginPage,
});

function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.03-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.43 1.02 2.59.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1 1.05-.15 1.47-.86 1.47-1.41 0-.15-.02-.27-.05-.33-.03-.06-.11-.09-.23-.15z" />
    </svg>
  );
}

function LoginPage() {
  const { data: psfData } = useQuery({
    queryKey: ["site-settings", "psf"],
    queryFn: () => getPsf(),
  });
  const navigate = useNavigate();
  const router = useRouter();
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
    supabase.auth.getSession().then(({ data }: { data: any }) => {
      if (data?.session) navigate({ to: "/agent/fares" });
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

      if ((res as any).skipMfa) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return setErr(error.message);
        navigate({ to: "/agent/fares" });
        return;
      }

      setChallenge((res as any).challenge || "");
      setMaskedEmail((res as any).maskedEmail || "");
      setStep("code");
      setNote(
        (res as any).sent
          ? `Verification code sent to ${(res as any).maskedEmail}.`
          : "Code created, but the email could not be delivered. Contact priority desk."
      );
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
        if (/again/i.test(res.error)) {
          setStep("password");
          setCode("");
        }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return setErr(error.message);
      navigate({ to: "/agent/fares" });
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4EFEA] text-[#1C1917] selection:bg-[#D97757] selection:text-white">
      {/* Top micro-nav */}
      <header className="border-b border-[#E7E5E4] bg-[#FAF9F5]/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#78716C] transition-colors hover:text-[#1C1917]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Main Website</span>
          </Link>

          <div className="flex items-center gap-3 text-xs text-[#78716C]">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-[#D97757]" />
              256-Bit SSL Encrypted B2B Portal
            </span>
            <span className="hidden sm:inline text-[#E7E5E4]">•</span>
            <a
              href="tel:+923056622988"
              className="inline-flex items-center gap-1 font-semibold text-[#1C1917] hover:text-[#D97757] transition-colors"
            >
              <Headphones className="h-3.5 w-3.5 text-[#D97757]" />
              Desk: +92 305 6622988
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 lg:py-16">
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
          
          {/* Left Column: Rohi Branding, Value proposition & WhatsApp Community Callout */}
          <div className="space-y-6 lg:col-span-6 lg:pr-4">
            {/* Brand Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D97757]/20 bg-[#D97757]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#D97757]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>B2B Partner & Agent Gateway</span>
            </div>

            {/* Main Branding Title */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <img
                  src="/favicon.png"
                  alt="Rohi International Travels"
                  className="h-11 w-11 rounded-xl bg-white p-1.5 shadow-md ring-1 ring-[#E7E5E4]"
                />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#78716C]">
                    Official Travel Network
                  </p>
                  <p className="text-sm font-semibold text-[#1C1917]">
                    Rohi International Travels
                  </p>
                </div>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-[#1C1917] sm:text-4xl lg:text-5xl">
                Welcome to <br />
                <span className="text-[#D97757]">Rohi International Travels</span>
              </h1>
              <p className="text-sm leading-relaxed text-[#78716C] sm:text-base">
                Your premier B2B airline ticketing, group fares & Umrah operations platform.
                Experience real-time flight seat locks, instant booking confirmation, and dedicated
                wholesale ledger management.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="flex items-start gap-2.5 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D97757]" />
                <div className="text-xs">
                  <p className="font-bold text-[#1C1917]">Live Airline Inventory</p>
                  <p className="text-[#78716C]">PIA, Saudia, Flyadeal, Flynas, Gulf Air & more</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D97757]" />
                <div className="text-xs">
                  <p className="font-bold text-[#1C1917]">Instant Wholesale Net Fares</p>
                  <p className="text-[#78716C]">Competitive rates with automatic PNR sync</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D97757]" />
                <div className="text-xs">
                  <p className="font-bold text-[#1C1917]">Umrah & Group Blocks</p>
                  <p className="text-[#78716C]">Direct seat holding & sub-agent issuance</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-[#E7E5E4] bg-[#FAF9F5] p-3 shadow-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#D97757]" />
                <div className="text-xs">
                  <p className="font-bold text-[#1C1917]">24/7 Priority Support</p>
                  <p className="text-[#78716C]">Fast manual interventions & ticket refunds</p>
                </div>
              </div>
            </div>

            {/* Prominent WhatsApp Community Card / Button */}
            <div className="relative overflow-hidden rounded-2xl border border-[#25D366]/30 bg-gradient-to-br from-[#FAF9F5] to-[#f0faf3] p-5 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-md">
                    <WhatsAppIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-[#1C1917]">Agent WhatsApp Community</h2>
                      <span className="inline-flex items-center rounded-full bg-[#25D366]/15 px-2 py-0.5 text-[10px] font-bold text-[#168a3f]">
                        LIVE ALERTS
                      </span>
                    </div>
                    <p className="text-xs text-[#78716C] mt-0.5">
                      Join verified travel agents for instant fare updates, flash sales & seat releases.
                    </p>
                  </div>
                </div>

                <a
                  href={WA_COMMUNITY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-200 hover:bg-[#20ba5a] hover:shadow-lg active:scale-[0.98] sm:self-center shrink-0"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  <span>Join Community</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                </a>
              </div>
            </div>

          </div>

          {/* Right Column: Sleek 21st-Century Login Card */}
          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-3xl border border-[#E7E5E4] bg-[#FAF9F5] shadow-2xl backdrop-blur-xl transition-all">
              {/* Card Header Band: Warm Terracotta Brand Strip */}
              <div className="bg-[#D97757] px-6 py-4 text-white sm:px-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 backdrop-blur-md">
                      <Plane className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                        Rohi International Travels
                      </p>
                      <p className="text-sm font-bold text-white">B2B Agent Portal Login</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {step === "password" ? "Secure Entry" : "Step 2: 2FA"}
                  </span>
                </div>
              </div>

              {/* Card Content Body */}
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-xl font-extrabold text-[#1C1917] sm:text-2xl">
                    {step === "password" ? "Agent Account Sign In" : "Two-Step Verification"}
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-[#78716C]">
                    {step === "password"
                      ? "Enter your verified agency credentials to access confidential B2B rates."
                      : `Enter the 6-digit authentication code sent to ${maskedEmail || "your email"}.`}
                  </p>
                </div>

                {step === "password" ? (
                  <form onSubmit={submit} className="space-y-4">
                    {/* Email Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                        Registered Agency Email
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#78716C]">
                          <Mail className="h-4 w-4" />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="agency@example.com"
                          className="w-full rounded-xl border border-[#E7E5E4] bg-white py-3 pl-10 pr-4 text-sm text-[#1C1917] placeholder:text-[#78716C]/60 shadow-sm outline-none transition duration-150 focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/20"
                        />
                      </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => alert("Password reset via email: Please contact the Rohi priority desk at +92 305 6622988 for instant credential reset.")}
                          className="text-xs font-semibold text-[#D97757] hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#78716C]">
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          type={showPw ? "text" : "password"}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full rounded-xl border border-[#E7E5E4] bg-white py-3 pl-10 pr-11 text-sm text-[#1C1917] placeholder:text-[#78716C]/60 shadow-sm outline-none transition duration-150 focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#78716C] hover:text-[#1C1917] transition-colors"
                          aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Error Banner */}
                    {err && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
                      >
                        {err}
                      </div>
                    )}

                    {/* Submit CTA */}
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl bg-[#141413] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-200 hover:bg-black hover:shadow-lg disabled:opacity-50 active:scale-[0.99]"
                    >
                      {busy ? "Verifying Agency Credentials…" : "Sign In to B2B Portal ›"}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#78716C]">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#D97757]" />
                      <span>Encrypted session with automatic security timeout</span>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={submitCode} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#1C1917]">
                        6-Digit Security Code
                      </label>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••••"
                        className="w-full rounded-xl border border-[#E7E5E4] bg-white px-4 py-3.5 text-center font-mono text-2xl tracking-[0.5em] text-[#1C1917] outline-none shadow-sm focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/20"
                      />
                    </div>

                    {note && !err && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                        {note}
                      </div>
                    )}

                    {err && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
                      >
                        {err}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={busy || code.length < 6}
                      className="w-full rounded-xl bg-[#141413] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-200 hover:bg-black hover:shadow-lg disabled:opacity-50 active:scale-[0.99]"
                    >
                      {busy ? "Verifying Code…" : "Verify & Enter Portal ›"}
                    </button>

                    <div className="flex items-center justify-between text-xs pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStep("password");
                          setCode("");
                          setErr(null);
                        }}
                        className="font-semibold text-[#78716C] hover:text-[#1C1917] underline underline-offset-2"
                      >
                        ← Back to Password
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
                              setErr(r.error);
                            }
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="font-bold text-[#D97757] hover:underline underline-offset-2"
                      >
                        Resend Code
                      </button>
                    </div>
                  </form>
                )}

                {/* Registration link if allowed */}
                <div className="border-t border-[#E7E5E4] pt-5 text-center text-xs text-[#78716C]">
                  {!psfData?.registrationHidden ? (
                    <p>
                      Want to partner with us as an authorized agency?{" "}
                      <Link
                        to="/agent/register"
                        className="font-bold text-[#D97757] hover:underline"
                      >
                        Create an Agent Account
                      </Link>
                    </p>
                  ) : (
                    <p>
                      New agency registration is currently managed by offline verification.
                    </p>
                  )}
                </div>

                {/* Priority Support Footer Bar inside Card */}
                <div className="rounded-2xl border border-[#E7E5E4] bg-[#F4EFEA]/60 p-4 text-xs text-[#78716C] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1C1917] flex items-center gap-1.5">
                      <Headphones className="h-3.5 w-3.5 text-[#D97757]" />
                      24/7 Agent Desk
                    </span>
                    <span className="font-semibold text-[#D97757]">+92 305 6622988</span>
                  </div>
                  <p className="text-[11px] leading-tight">
                    Email: <span className="font-medium text-[#1C1917]">rohitravels@gmail.com</span> • Sardar Market, Shahi Road, Rahim Yar Khan
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
