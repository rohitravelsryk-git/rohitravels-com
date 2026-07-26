import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_agentapp/agent/change-password")({
  ssr: false,
  component: ChangePassword,
});

function ChangePassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setMsg("Passwords don't match.");
    if (pw.length < 6) return setMsg("Password must be at least 6 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    setMsg(error ? error.message : "Password updated.");
    if (!error) { setPw(""); setPw2(""); }
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-800">Change Password</h1>
      <form onSubmit={submit} className="max-w-md space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium">New Password</span>
          <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Confirm New Password</span>
          <input type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
        </label>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
        <button disabled={busy} className="rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {busy ? "Updating…" : "Change Password"}
        </button>
      </form>
    </div>
  );
}
