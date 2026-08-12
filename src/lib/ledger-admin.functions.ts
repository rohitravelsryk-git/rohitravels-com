import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) return { password: "fallback-secret-for-prerender", name: "rohi-admin-prerender" };
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function requireUnlocked() {
  const s = await useSession<GateSession>(sessionConfig());
  if (!s.data.unlocked) throw new Error("Unauthorized");
  if (s.data.staffUsername) throw new Error("Forbidden: admin role required");
}

export const listAgentLedgersAdmin = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from("agents")
    .select("user_id, agency_name, contact_person, cell_number, country_code, user_code")
    .eq("status", "approved");
  
  if (agentsError) throw new Error(agentsError.message);
  
  const results = [];
  const masterSyncData = [];

  for (const agent of agents) {
    const { data: bookings } = await supabaseAdmin
      .from("agent_bookings")
      .select("id, created_at, seats, fare_on_demand, fare_snapshot, payment_status, status, passenger_names")
      .eq("agent_user_id", agent.user_id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true });

    let balance = 0;
    const ledgerRows = [];
    const airlineMap: Record<string, string> = { "SALAM AIR": "OV", "PIA": "PK", "AIRBLUE": "PA", "SERENE AIR": "ER", "AIRSIAL": "PF", "FLYDUBAI": "FZ", "AIR ARABIA": "G9" };

    for (const b of (bookings ?? [])) {
      const unit = parseInt(String(b.fare_on_demand ?? b.fare_snapshot?.price_text ?? "").replace(/[^0-9]/g, ""), 10) || 0;
      const debit = unit * (b.seats ?? 0);
      const credit = (b.payment_status === "confirmed" || b.payment_status === "paid" || b.payment_status === "ledger") ? debit : 0;
      balance += (debit - credit);

      const f = b.fare_snapshot ?? {};
      const paxCount = (b.passenger_names?.split("\n").filter(Boolean).length) || b.seats || 0;
      const firstPax = b.passenger_names?.split("\n")[0]?.trim() || "Pax";
      const paxDisplay = paxCount > 1 ? `${firstPax}*${paxCount}` : firstPax;
      const airlineName = String(f.airline ?? "").toUpperCase();
      const airlineCode = f.airline_code || airlineMap[airlineName] || airlineName;

      ledgerRows.push({
        date: b.created_at,
        details: `GRP TKT ${paxDisplay} - ${f.origin_code ?? ""} ${f.destination_code ?? ""} - ${f.pnr ?? "—"} - ${airlineCode}`,
        debit,
        credit,
        balance
      });
    }
    
    const agentData = {
      ...agent,
      balance,
      contact: `${agent.country_code} ${agent.cell_number}`.trim(),
      ledger: ledgerRows
    };
    results.push(agentData);
    masterSyncData.push(agentData);
  }
  
  if (masterSyncData.length > 0) {
    try {
      const { syncMasterLedger } = await import("./backup/ledger-sync.server");
      await syncMasterLedger(masterSyncData);
    } catch (e) {
      console.error("Master ledger sync failed:", e);
    }
  }
  
  return results;
});
