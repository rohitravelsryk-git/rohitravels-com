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
  
  // Get all approved agents
  const { data: agents, error: agentsError } = await supabaseAdmin
    .from("agents")
    .select("user_id, agency_name, contact_person, cell_number, country_code")
    .eq("status", "approved");
  
  if (agentsError) throw new Error(agentsError.message);
  
  const results = [];
  for (const agent of agents) {
    // Calculate balance for each agent
    const { data: bookings } = await supabaseAdmin
      .from("agent_bookings")
      .select("seats, fare_on_demand, fare_snapshot, payment_status, status")
      .eq("agent_user_id", agent.user_id)
      .neq("status", "cancelled");

    let balance = 0;
    for (const b of (bookings ?? [])) {
      const unit = parseInt(String(b.fare_on_demand ?? b.fare_snapshot?.price_text ?? "").replace(/[^0-9]/g, ""), 10) || 0;
      const debit = unit * (b.seats ?? 0);
      const credit = (b.payment_status === "confirmed" || b.payment_status === "paid" || b.payment_status === "ledger") ? debit : 0;
      balance += (debit - credit);
    }
    
    results.push({
      ...agent,
      balance,
      contact: `${agent.country_code} ${agent.cell_number}`.trim()
    });
  }
  
  if (results.length > 0) {
      try {
          const { syncMasterLedger } = await import("./backup/ledger-sync.server");
          await syncMasterLedger(results);
      } catch (e) {
          console.error("Master ledger sync failed:", e);
      }
  }
  
  return results;
});
