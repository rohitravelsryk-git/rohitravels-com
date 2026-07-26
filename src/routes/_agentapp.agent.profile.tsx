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
      agency_name: agent.agency_name,
      contact_person: agent.contact_person,
      cell_number: agent.cell_number,
      country_code: agent.country_code,
      city: agent.city,
      country: agent.country,
      office_address: agent.office_address,
    }).eq("user_id", sess.session!.user.id);
    setBusy(false);
    setMsg(error ? error.message : "Profile updated.");
  }

  if (!agent) return <div className="p-6 text-gray-500">Loading…</div>;
  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-800">My Profile</h1>
      <form onSubmit={save} className="grid grid-cols-1 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-2">
        {(["agency_name","contact_person","cell_number","country_code","city","country","office_address"] as const).map((k) => (
          <label key={k} className="block">
            <span className="text-sm font-medium text-gray-700">{k.replace(/_/g, " ")}</span>
            <input value={agent[k] ?? ""} onChange={(e) => setAgent({ ...agent, [k]: e.target.value })}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
        ))}
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
