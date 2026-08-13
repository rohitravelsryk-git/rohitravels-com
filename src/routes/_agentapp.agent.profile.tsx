import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_agentapp/agent/profile")({
  ssr: false,
  component: ProfilePage,
});

function ProfilePage() {
  const [agent, setAgent] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const { data } = await supabase.from("agents").select("*").eq("user_id", sess.session!.user.id).maybeSingle();
      setAgent(data);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data: sess } = await supabase.auth.getSession();
    const { error } = await supabase.from("agents").update({
      contact_person: agent.contact_person,
      cell_number: agent.cell_number,
      country_code: agent.country_code,
      office_address: agent.office_address,
    }).eq("user_id", sess.session!.user.id);
    setBusy(false);
    setMsg(error ? error.message : "Profile updated.");
  }

  if (!agent) return <div className="p-6 text-gray-500">Loading…</div>;
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-800">My Profile</h1>
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-amber-50 p-4 shadow-sm ring-1 ring-amber-100">
          <div>
            <h3 className="font-bold text-navy">MFA for Login</h3>
            <p className="text-xs text-muted-foreground">Require an email code every time you sign in to your portal.</p>
          </div>
          <button
            onClick={async () => {
              setBusy(true);
              const { data: sess } = await supabase.auth.getSession();
              await supabase.from("agents").update({ mfa_enabled: !agent.mfa_enabled }).eq("user_id", sess.session!.user.id);
              setAgent({ ...agent, mfa_enabled: !agent.mfa_enabled });
              setBusy(false);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${agent.mfa_enabled ? 'bg-navy' : 'bg-gray-200'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${agent.mfa_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-amber-50 p-4 shadow-sm ring-1 ring-amber-100">
          <div>
            <h3 className="font-bold text-navy">MFA for Booking Confirmation</h3>
            <p className="text-xs text-muted-foreground">Always required for your security. Cannot be disabled.</p>
          </div>
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-navy/40 cursor-not-allowed">
            <span className="inline-block h-4 w-4 transform translate-x-6 rounded-full bg-white/50" />
          </div>
        </div>
      </div>

      <form onSubmit={save} className="grid grid-cols-1 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Agency name (cannot change)</span>
          <input value={agent.agency_name ?? ""} disabled className="mt-1 w-full rounded-md border bg-gray-100 px-3 py-2 text-sm" />
        </label>
        {(["contact_person","cell_number","country_code","office_address"] as const).map((k) => (
          <label key={k} className="block">
            <span className="text-sm font-medium text-gray-700">{k.replace(/_/g, " ")}</span>
            <input value={agent[k] ?? ""} onChange={(e) => setAgent({ ...agent, [k]: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
        ))}
        <label className="block">
          <span className="text-sm font-medium text-gray-700">City (cannot change)</span>
          <input value={agent.city ?? ""} disabled className="mt-1 w-full rounded-md border bg-gray-100 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Country (cannot change)</span>
          <input value={agent.country ?? ""} disabled className="mt-1 w-full rounded-md border bg-gray-100 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email (cannot change)</span>
          <input value={agent.email} disabled className="mt-1 w-full rounded-md border bg-gray-100 px-3 py-2 text-sm" />
        </label>
        <div className="md:col-span-2">
          <button disabled={busy} className="rounded-md bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy ? "Saving…" : "Update"}
          </button>
          {msg && <span className="ml-3 text-sm text-gray-600">{msg}</span>}
        </div>
      </form>
    </div>
  );
}
