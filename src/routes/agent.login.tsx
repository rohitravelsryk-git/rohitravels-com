import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPsf } from "@/lib/fares.functions";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Building2, Eye, EyeOff, FileText, Headphones, Lock, Mail, MapPin, Plane, ShieldCheck } from "lucide-react";
import { requestAgentLoginCode, resendAgentLoginCode, verifyAgentLoginCode, syncAgentProfile } from "@/lib/agent-otp.functions";
import { cleanAuthErrorMessage } from "@/lib/auth-error-cleanup";

export const Route = createFileRoute("/agent/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agent Sign In — Rohi International Travels B2B Portal" },
      { name: "description", content: "Authorized B2B Agent Portal for Rohi International Travels. Access fares, packages, and reservations." },
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
      const trimmedEmail = email.trim().toLowerCase();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (authError || !authData?.user) {
        setErr(cleanAuthErrorMessage(authError, "Invalid email or password. Please check your credentials."));
        return;
      }
      const uid = authData.user.id;
      const isMasterAdmin = trimmedEmail === "rohitravelsryk@gmail.com" || trimmedEmail === "arsiteslogin@gmail.com";
      let { data: agent } = await supabase.from("agents").select("user_id, agency_name, email, status, mfa_enabled").eq("user_id", uid).maybeSingle();
      if (!agent) {
        try {
          const syncRes = await syncProfile({ data: { email: trimmedEmail, userId: uid } });
          if (syncRes?.agent) agent = syncRes.agent as any;
        } catch {
          const { data: byEmail } = await supabase.from("agents").select("user_id, agency_name, email, status, mfa_enabled").eq("email", trimmedEmail).maybeSingle();
          if (byEmail) agent = byEmail;
        }
      }
      if (agent && agent.status !== "approved" && !isMasterAdmin) {
        await supabase.auth.signOut();
        setErr(agent.status === "rejected"
          ? "Your agency application was not approved. Contact priority desk at +92 305 6622988."
          : "Your agency account is awaiting admin approval. You will receive an email once approved.");
        return;
      }
      if (agent?.mfa_enabled === true) {
        await supabase.auth.signOut();
        const res = await requestCode({ data: { email: trimmedEmail, password } });
        if (!res.ok) {
          setErr(cleanAuthErrorMessage(res.error, "Could not start two-step verification."));
          return;
        }
        setChallenge((res as any).challenge || "");
        setMaskedEmail((res as any).maskedEmail || "");
        setStep("code");
        setNote((res as any).sent ? `Verification code sent to ${(res as any).maskedEmail}.` : "Code created, but the email could not be delivered. Contact priority desk.");
        return;
      }
      await router.invalidate();
      navigate({ to: "/agent/fares" });
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
        if (/again/i.test(errorText)) { setStep("password"); setCode(""); }
        return;
      }
      if ((res as any).tokenHash) {
        const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: (res as any).tokenHash, type: "magiclink" });
        if (!otpError) { await router.invalidate(); navigate({ to: "/agent/fares" }); return; }
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) { setErr(cleanAuthErrorMessage(error, "Verification successful, but sign-in failed. Please check your password.")); return; }
      await router.invalidate();
      navigate({ to: "/agent/fares" });
    } catch (e2) {
      setErr(cleanAuthErrorMessage(e2, "Verification error. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "w-full rounded-xl border border-[#E7DED5] bg-white/90 py-3.5 pl-11 pr-4 text-sm text-[#1C1917] placeholder:text-[#91877F] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15";
  const labelClass = "mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[#57504A]";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4EFEA] text-[#1C1917] selection:bg-[#D97757] selection:text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-[30rem] w-[30rem] rounded-full bg-[#E8B69E]/30 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-[28rem] w-[38rem] rounded-full bg-white/80 blur-3xl" />
        <div className="absolute right-[5%] top-[20%] hidden h-72 w-72 rounded-full border border-[#D97757]/15 lg:block" />
        <div className="absolute right-[8%] top-[23%] hidden h-60 w-60 rounded-full border border-[#D97757]/15 lg:block" />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-[#141413] text-[#FAF9F5]">
        <div className="mx-auto flex min-h-[82px] max-w-[1400px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link to="/" className="group flex items-center gap-3" aria-label="Rohi International Travels home">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#D97757] text-white shadow-lg shadow-black/20">
              <Plane className="h-6 w-6 -rotate-12" />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-2xl tracking-tight">Rohi</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[.23em] text-[#D9CFC5]">International Travels</span>
            </span>
          </Link>
          <div className="hidden items-center gap-3 text-sm text-[#E7DED5] sm:flex">
            <span className="h-px w-8 bg-[#D97757]" />
            Your Global Travel Partner
          </div>
          <Link to="/" className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white transition hover:border-[#D97757] hover:text-[#F0B29A] sm:hidden">Main website</Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-82px)] max-w-[1400px] items-center gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(390px,480px)] lg:gap-16 lg:px-12 lg:py-16">
        <div className="relative hidden min-w-0 lg:block">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D97757]/25 bg-white/65 px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.24em] text-[#9D5038]">
            <ShieldCheck className="h-3.5 w-3.5" /> Trusted B2B Partner Network
          </div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[.32em] text-[#766B62]">Rohi International Travels</p>
          <h1 className="max-w-xl font-serif text-5xl leading-[1.08] tracking-tight text-[#1C1917] xl:text-6xl">Your business.<br /><span className="italic text-[#C86E4E]">A world</span> of opportunity.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[#6F655D]">More bookings. Greater opportunities. Everything your travel agency needs, in one partner portal.</p>
          <div className="my-8 h-1 w-16 rounded-full bg-[#D97757]" />
          <div className="grid max-w-xl gap-5 sm:grid-cols-2">
            <div className="flex gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#D97757] shadow-sm ring-1 ring-[#E7DED5]"><Plane className="h-5 w-5" /></span>
              <div><h2 className="font-semibold">Flights</h2><p className="mt-1 text-sm text-[#766B62]">Airline fares and bookings</p></div>
            </div>
            <div className="flex gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#D97757] shadow-sm ring-1 ring-[#E7DED5]"><Building2 className="h-5 w-5" /></span>
              <div><h2 className="font-semibold">Hotels</h2><p className="mt-1 text-sm text-[#766B62]">Stay options for every trip</p></div>
            </div>
            <div className="flex gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#D97757] shadow-sm ring-1 ring-[#E7DED5]"><MapPin className="h-5 w-5" /></span>
              <div><h2 className="font-semibold">Holidays</h2><p className="mt-1 text-sm text-[#766B62]">Packages and experiences</p></div>
            </div>
            <div className="flex gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#D97757] shadow-sm ring-1 ring-[#E7DED5]"><FileText className="h-5 w-5" /></span>
              <div><h2 className="font-semibold">Visa support</h2><p className="mt-1 text-sm text-[#766B62]">Guidance for your travellers</p></div>
            </div>
          </div>
          <div className="mt-12 flex items-center gap-3 text-xs text-[#8B7F75]"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#D97757]/10 text-[#B95F41]"><ShieldCheck className="h-4 w-4" /></span> Secure partner access · Dedicated agent support</div>
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-16 right-0 -z-10 select-none font-serif text-[10rem] leading-none text-white/55">✳</div>
        </div>

        <div className="mx-auto w-full max-w-[480px]">
          <div className="mb-5 text-center lg:hidden">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-[#9D5038]">Rohi International Travels</p>
            <h1 className="mt-2 font-serif text-3xl">B2B Agent Portal</h1>
            <p className="mt-2 text-sm text-[#766B62]">Your business, connected to the world.</p>
          </div>
          <div className="overflow-hidden rounded-[28px] border border-white/80 bg-[#FAF9F5]/95 shadow-[0_24px_80px_rgba(64,42,29,0.13)] backdrop-blur-xl">
            <div className="h-1.5 bg-gradient-to-r from-[#B85C40] via-[#D97757] to-[#E9B39B]" />
            <div className="px-6 py-7 sm:px-9 sm:py-9">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D97757] text-white shadow-lg shadow-[#D97757]/20"><Plane className="h-7 w-7 -rotate-12" /></div>
                <p className="text-[10px] font-bold uppercase tracking-[.25em] text-[#A05A42]">{step === "password" ? "Partner access" : "Account security"}</p>
                <h2 className="mt-2 font-serif text-3xl tracking-tight text-[#1C1917]">{step === "password" ? "Welcome back" : "Verify your identity"}</h2>
                <p className="mt-2 text-sm leading-6 text-[#766B62]">{step === "password" ? "Sign in to continue to your agent portal." : `Enter the 6-digit code sent to ${maskedEmail || "your email"}.`}</p>
              </div>

              {step === "password" ? (
                <form onSubmit={submit} className="space-y-5">
                  <div>
                    <label htmlFor="agent-email" className={labelClass}>Registered agency email</label>
                    <div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94877D]" /><input id="agent-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agency@example.com" className={fieldClass} /></div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3"><label htmlFor="agent-password" className="text-xs font-bold uppercase tracking-[.12em] text-[#57504A]">Password</label><button type="button" onClick={() => setShowForgotNote((v) => !v)} className="text-xs font-semibold text-[#B85C40] underline-offset-4 hover:underline">Forgot password?</button></div>
                    {showForgotNote && <p className="mb-3 rounded-xl border border-[#E7DED5] bg-[#F4EFEA] px-3.5 py-3 text-xs leading-5 text-[#655A51]">For a password reset, contact the priority desk at <a href="tel:+923056622988" className="font-bold text-[#B85C40] underline">+92 305 6622988</a>.</p>}
                    <div className="relative"><Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94877D]" /><input id="agent-password" type={showPw ? "text" : "password"} autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-[#E7DED5] bg-white/90 py-3.5 pl-11 pr-12 text-sm text-[#1C1917] placeholder:text-[#91877F] outline-none transition focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15" /><button type="button" onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 right-0 flex items-center px-3.5 text-[#81766D] transition hover:text-[#B85C40]" aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                  </div>
                  {err && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm leading-5 text-red-800">{err}</div>}
                  <button type="submit" disabled={busy} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#D97757] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-[#D97757]/20 transition hover:bg-[#BD6346] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Verifying credentials…" : "Sign in to agent portal"}{!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}</button>
                </form>
              ) : (
                <form onSubmit={submitCode} className="space-y-5">
                  <div><label htmlFor="agent-code" className={labelClass}>6-digit security code</label><input id="agent-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="w-full rounded-xl border border-[#E7DED5] bg-white px-4 py-4 text-center font-mono text-2xl tracking-[.5em] text-[#1C1917] outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15" /></div>
                  {note && !err && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{note}</div>}
                  {err && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">{err}</div>}
                  <button type="submit" disabled={busy || code.length < 6} className="w-full rounded-xl bg-[#141413] px-5 py-4 text-sm font-bold text-white transition hover:bg-[#302C29] disabled:opacity-50">{busy ? "Verifying code…" : "Verify & enter portal"}</button>
                  <div className="flex items-center justify-between gap-3 text-xs"><button type="button" onClick={() => { setStep("password"); setCode(""); setErr(null); }} className="font-semibold text-[#766B62] underline underline-offset-4 hover:text-[#1C1917]">← Back to password</button><button type="button" disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { const r = await resendCode({ data: { challenge } }); if (r.ok) { setChallenge(r.challenge); setNote(`New verification code delivered to ${r.maskedEmail}.`); } else { setErr(cleanAuthErrorMessage(r.error, "Failed to resend code. Please try signing in again.")); } } catch (e2) { setErr(cleanAuthErrorMessage(e2, "Failed to resend code. Please try signing in again.")); } finally { setBusy(false); } }} className="font-bold text-[#B85C40] hover:underline disabled:opacity-50">Resend code</button></div>
                </form>
              )}

              <div className="my-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#A0968D]"><span className="h-px flex-1 bg-[#E7DED5]" />Secure agent access<span className="h-px flex-1 bg-[#E7DED5]" /></div>
              <div className="text-center text-sm text-[#766B62]">
                {!psfData?.registrationHidden ? <p>New to Rohi? <Link to="/agent/register" className="font-bold text-[#B85C40] underline decoration-[#D97757]/40 underline-offset-4 hover:decoration-[#D97757]">Register your agency</Link></p> : <p>New agency registration is currently managed by offline verification.</p>}
              </div>
              <div className="mt-6 rounded-2xl border border-[#E7DED5] bg-[#F4EFEA]/75 p-4">
                <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#B85C40]"><Headphones className="h-4 w-4" /></span><div><p className="text-xs font-bold text-[#29231F]">Need assistance?</p><a href="tel:+923056622988" className="mt-0.5 block text-sm font-semibold text-[#B85C40] hover:underline">+92 305 6622988</a></div></div>
                <p className="mt-3 border-t border-[#E3D8CE] pt-3 text-[11px] leading-5 text-[#766B62]">rohitravels@gmail.com <span className="mx-1.5 text-[#D97757]">·</span> Sardar Market, Shahi Road, Rahim Yar Khan</p>
              </div>
            </div>
          </div>
          <p className="mt-5 text-center text-[11px] text-[#8B7F75]">© {new Date().getFullYear()} Rohi International Travels. All rights reserved.</p>
        </div>
      </section>
    </main>
  );
}
