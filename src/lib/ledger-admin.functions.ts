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

    const { data: manualEntries } = await supabaseAdmin
      .from("ledger_manual_entries")
      .select("*")
      .eq("agent_user_id", agent.user_id)
      .order("date", { ascending: true });

    let balance = 0;
    const ledgerRows = [];
    const airlineMap: Record<string, string> = { "SALAM AIR": "OV", "PIA": "PK", "AIRBLUE": "PA", "SERENE AIR": "ER", "AIRSIAL": "PF", "FLYDUBAI": "FZ", "AIR ARABIA": "G9" };

    const combined = [
      ...(bookings ?? []).map(b => ({ type: 'booking', ...b })),
      ...(manualEntries ?? []).map(m => ({ type: 'manual', ...m, created_at: m.date }))
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const item of combined) {
      let debit = 0;
      let credit = 0;
      let details = "";
      let id = item.id;
      let date = item.created_at;

      if (item.type === 'booking') {
        const b = item;
        const unit = parseInt(String(b.fare_on_demand ?? b.fare_snapshot?.price_text ?? "").replace(/[^0-9]/g, ""), 10) || 0;
        debit = unit * (b.seats ?? 0);
        credit = (b.payment_status === "confirmed" || b.payment_status === "paid" || b.payment_status === "ledger") ? debit : 0;
        
        const f = b.fare_snapshot ?? {};
        const paxCount = (b.passenger_names?.split("\n").filter(Boolean).length) || b.seats || 0;
        const firstPax = b.passenger_names?.split("\n")[0]?.trim() || "Pax";
        const paxDisplay = paxCount > 1 ? `${firstPax}*${paxCount}` : firstPax;
        const airlineName = String(f.airline ?? "").toUpperCase();
        const airlineCode = f.airline_code || airlineMap[airlineName] || airlineName;
        details = `GRP TKT ${paxDisplay} - ${f.origin_code ?? ""} ${f.destination_code ?? ""} - ${f.pnr ?? "—"} - ${airlineCode}`;
      } else {
        const m = item;
        debit = m.debit;
        credit = m.credit;
        details = m.details;
        date = m.date;
      }

      balance += (debit - credit);

      ledgerRows.push({
        id,
        date,
        details,
        debit,
        credit,
        balance,
        isManual: item.type === 'manual'
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

export const addManualLedgerEntry = createServerFn({ method: "POST" })
  .input(z.object({
    agent_user_id: z.string(),
    date: z.string(),
    details: z.string(),
    debit: z.number(),
    credit: z.number()
  }))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin.auth.getUser();
    
    const { error } = await supabaseAdmin.from("ledger_manual_entries").insert({
      ...data,
      created_by: user.user?.id
    });
    
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteManualLedgerEntry = createServerFn({ method: "POST" })
  .input(z.string())
  .handler(async ({ data: id }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ledger_manual_entries").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

