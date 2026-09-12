import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_agentapp/agent/admin")({
  ssr: false,
  component: AdminAgents,
});

type Agent = {
  user_id: string;
  agency_name: string;
  email: string;
  contact_person: string;
  city: string;
  country_code: string;
  cell_number: string;
  office_address: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function AdminAgents() {
  const [rows, setRows] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
    if (error) setErr(error.message); else setRows((data ?? []) as Agent[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function setStatus(user_id: string, status: Agent["status"]) {
    const { error } = await supabase.from("agents").update({ status }).eq("user_id", user_id);
    if (error) return alert(error.message);
    load();
  }

  return (
    <div className="p-6 animate-premium-fade">
      <h1 className="mb-4 text-xl font-semibold text-gray-800">Manage Agents</h1>
      {err && <p className="text-red-600">{err}</p>}
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#1e3a5f] text-white">
            <tr>
              {["Agency", "Contact", "Email", "Phone", "City", "Status", "Actions"].map((h) =>
                <th key={h} className="px-3 py-2.5 text-left">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="p-6 text-center text-gray-500">Loading…</td></tr> :
              rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-gray-500">No agents.</td></tr> :
              rows.map((a, i) => (
                <tr key={a.user_id} className={i % 2 ? "bg-blue-50/40" : "bg-white"}>
                  <td className="px-3 py-3 font-medium">{a.agency_name}</td>
                  <td className="px-3 py-3">{a.contact_person}</td>
                  <td className="px-3 py-3">{a.email}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{a.country_code} {a.cell_number}</td>
                  <td className="px-3 py-3">{a.city}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded px-2 py-1 text-xs font-semibold ${
                      a.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                      a.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"}`}>{a.status}</span>
                  </td>
                  <td className="px-3 py-3 space-x-1">
                    {a.status !== "approved" && <button onClick={() => setStatus(a.user_id, "approved")} className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600">Approve</button>}
                    {a.status !== "rejected" && <button onClick={() => setStatus(a.user_id, "rejected")} className="rounded bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600">Reject</button>}
                    {a.status !== "pending" && <button onClick={() => setStatus(a.user_id, "pending")} className="rounded bg-gray-400 px-2 py-1 text-xs font-semibold text-white hover:bg-gray-500">Pending</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
