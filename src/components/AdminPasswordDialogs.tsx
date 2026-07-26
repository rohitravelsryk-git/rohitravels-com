import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, X, Mail } from "lucide-react";
import {
  changeAdminPassword,
  requestPasswordReset,
  resetPasswordWithCode,
} from "@/lib/fares.functions";

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const change = useServerFn(changeAdminPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 6) return setMsg({ ok: false, text: "New password must be at least 6 characters" });
    if (next !== confirm) return setMsg({ ok: false, text: "Passwords do not match" });
    setBusy(true);
    try {
      const res = await change({ data: { currentPassword: current, newPassword: next } });
      if (res.ok) {
        setMsg({ ok: true, text: "Password updated successfully" });
        setCurrent(""); setNext(""); setConfirm("");
      } else {
        setMsg({ ok: false, text: res.error ?? "Failed to update password" });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-navy" />
            <h2 className="font-serif text-lg font-black text-navy">Change Password</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-3">
          <input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-gold" />
          <input type="password" placeholder="New password (min 6 chars)" value={next} onChange={(e) => setNext(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-gold" />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-gold" />
        </div>
        {msg && <p className={`mt-2 text-xs font-semibold ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-input py-2.5 text-sm font-semibold">Cancel</button>
          <button disabled={busy || !current || !next || !confirm} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-bold text-navy-foreground disabled:opacity-60">
            {busy ? "Saving…" : "Update Password"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ForgotPasswordDialog({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const request = useServerFn(requestPasswordReset);
  const reset = useServerFn(resetPasswordWithCode);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sendCode() {
    setBusy(true); setMsg(null);
    try {
      const res = await request();
      setMaskedEmail(res.maskedEmail);
      if (res.ok) {
        setMsg({ ok: true, text: `A 6-digit code was sent to ${res.maskedEmail}. It expires in 15 minutes.` });
        setStep("verify");
      } else {
        setMsg({ ok: false, text: `Could not send email: ${res.error ?? "unknown error"}. Ask the developer to set up the email domain.` });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 6) return setMsg({ ok: false, text: "New password must be at least 6 characters" });
    if (next !== confirm) return setMsg({ ok: false, text: "Passwords do not match" });
    setBusy(true);
    try {
      const res = await reset({ data: { code, newPassword: next } });
      if (res.ok) {
        setMsg({ ok: true, text: "Password reset! You can now sign in." });
        setTimeout(() => { onDone?.(); onClose(); }, 1200);
      } else {
        setMsg({ ok: false, text: res.error ?? "Reset failed" });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl ring-1 ring-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-navy" />
            <h2 className="font-serif text-lg font-black text-navy">Forgot Password</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {step === "request" ? (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              A 6-digit reset code will be sent to your recovery email <span className="font-semibold text-navy">rohitravels@gmail.com</span>.
            </p>
            {msg && <p className={`mt-3 text-xs font-semibold ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-input py-2.5 text-sm font-semibold">Cancel</button>
              <button disabled={busy} onClick={sendCode} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-bold text-navy-foreground disabled:opacity-60">
                {busy ? "Sending…" : "Send Code"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitReset} className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">Enter the code sent to {maskedEmail} and choose a new password.</p>
            <input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-center text-lg font-bold tracking-[0.5em] outline-none focus:border-gold" />
            <input type="password" placeholder="New password (min 6 chars)" value={next} onChange={(e) => setNext(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-gold" />
            <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-gold" />
            {msg && <p className={`text-xs font-semibold ${msg.ok ? "text-emerald-600" : "text-destructive"}`}>{msg.text}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep("request")} className="flex-1 rounded-lg border border-input py-2.5 text-sm font-semibold">Back</button>
              <button disabled={busy || !code || !next} className="flex-1 rounded-lg bg-navy py-2.5 text-sm font-bold text-navy-foreground disabled:opacity-60">
                {busy ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
