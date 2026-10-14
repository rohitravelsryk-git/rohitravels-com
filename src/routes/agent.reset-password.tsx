import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cleanAuthErrorMessage } from "@/lib/auth-error-cleanup";

export const Route = createFileRoute("/agent/reset-password")({
  ssr: false,
  head: () => [{ title: "Reset Agent Password — Rohi International Travels" }],
  component: ResetAgentPasswordPage,
});

function ResetAgentPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      if (!data.user) throw new Error("The reset session is missing or expired. Request a new reset link.");
      setMessage("Your password has been updated. You can now sign in with your new password.");
      setPassword("");
      setConfirmPassword("");
      window.setTimeout(() => navigate({ to: "/agent/login" }), 1800);
    } catch (e) {
      setError(cleanAuthErrorMessage(e, "Unable to update your password. Request a new reset link and try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4EFEA] px-5 py-12 text-[#1C1917]">
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-[#E7DED5] bg-[#FAF9F5] shadow-xl">
        <div className="h-1.5 bg-gradient-to-r from-[#B85C40] via-[#D97757] to-[#E9B39B]" />
        <div className="p-7 sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#B85C40]">Rohi International Travels</p>
          <h1 className="mt-3 font-serif text-3xl font-medium">Set a new password</h1>
          <p className="mt-2 text-sm leading-6 text-[#766B62]">Open this page from the secure password-reset email, then choose a new password for your agent account.</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#57504A]">
              New password
              <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[#E7DED5] bg-white px-4 py-3.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15" placeholder="At least 8 characters" />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#57504A]">
              Confirm new password
              <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-[#E7DED5] bg-white px-4 py-3.5 text-sm font-normal normal-case tracking-normal outline-none focus:border-[#D97757] focus:ring-4 focus:ring-[#D97757]/15" placeholder="Enter it again" />
            </label>
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
            {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
            <button disabled={busy} type="submit" className="w-full rounded-xl bg-[#141413] px-5 py-4 text-sm font-bold text-white disabled:opacity-60">{busy ? "Updating password…" : "Update password"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-[#766B62]"><Link to="/agent/login" className="font-bold text-[#B85C40] underline underline-offset-4">Back to Agent Login</Link></p>
        </div>
      </section>
    </main>
  );
}
