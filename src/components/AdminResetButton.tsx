import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, ShieldAlert, X, Mail, KeyRound } from "lucide-react";
import { performReset, requestResetCode, type ResetTarget } from "@/lib/reset.functions";

/**
 * Admin-only "reset test data" control.
 *
 * Deletes every record of one dataset and restarts its numbering from 1.
 * Requires the admin password or a one-time code emailed to the recovery
 * address before anything is deleted.
 */
export function AdminResetButton({
  target,
  label,
  numbering,
  onDone,
}: {
  target: ResetTarget;
  label: string;
  numbering: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const request = useServerFn(requestResetCode);
  const run = useServerFn(performReset);

  const [mode, setMode] = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  function close() {
    setOpen(false);
    setPassword("");
    setCode("");
    setChallenge(null);
    setError("");
    setDone("");
    setMode("password");
  }

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      const res = await request({ data: { target } });
      setChallenge(res.challenge);
      setMasked(res.maskedEmail);
      setMode("otp");
      if (!res.sent) setError("Code created but the email could not be delivered. Use the password instead.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const res = await run({
        data:
          mode === "otp" && challenge
            ? { target, challenge, code: code.trim() }
            : { target, password },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(`${res.deleted} record(s) deleted. ${numbering} restarts at 1.`);
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-700 hover:bg-red-100"
      >
        <Trash2 className="h-3.5 w-3.5" /> Reset data
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-navy/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border">
            <div className="flex items-start justify-between bg-navy px-5 py-4 text-white">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-gold" />
                <div>
                  <p className="font-serif text-base font-black leading-tight">Reset {label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                    Deletes all records · {numbering} back to 1
                  </p>
                </div>
              </div>
              <button onClick={close} className="rounded p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {done ? (
                <>
                  <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
                    {done}
                  </p>
                  <button
                    onClick={close}
                    className="w-full rounded-md bg-navy px-4 py-2.5 text-xs font-black uppercase tracking-wider text-navy-foreground"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700 ring-1 ring-red-200">
                    This permanently deletes every record in <b>{label}</b> and restarts {numbering} from 1.
                    This cannot be undone.
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode("password")}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-black uppercase tracking-wider ring-1 ${mode === "password" ? "bg-navy text-navy-foreground ring-navy" : "bg-background text-navy ring-border"}`}
                    >
                      <KeyRound className="h-3.5 w-3.5" /> Password
                    </button>
                    <button
                      onClick={() => (challenge ? setMode("otp") : sendCode())}
                      disabled={busy}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-black uppercase tracking-wider ring-1 disabled:opacity-50 ${mode === "otp" ? "bg-navy text-navy-foreground ring-navy" : "bg-background text-navy ring-border"}`}
                    >
                      <Mail className="h-3.5 w-3.5" /> Email code
                    </button>
                  </div>

                  {mode === "password" ? (
                    <input
                      type="password"
                      autoFocus
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Admin password"
                      className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
                    />
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-muted-foreground">
                        6-digit code sent to <b className="text-navy">{masked}</b>.
                      </p>
                      <input
                        autoFocus
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="······"
                        className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-gold"
                      />
                      <button
                        onClick={sendCode}
                        disabled={busy}
                        className="text-[11px] font-bold uppercase tracking-wider text-navy underline disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    </div>
                  )}

                  {error && <p className="text-[12px] font-semibold text-destructive">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      onClick={close}
                      className="flex-1 rounded-md border border-input px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-navy"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirm}
                      disabled={busy || (mode === "password" ? !password : code.length < 4)}
                      className="flex-1 rounded-md bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50"
                    >
                      {busy ? "Working…" : "Delete all & reset"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
