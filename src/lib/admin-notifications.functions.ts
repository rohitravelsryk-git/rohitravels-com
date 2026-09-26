import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 24 * 365,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

export type AdminNotificationKind =
  | "booking"
  | "payment"
  | "registration"
  | "query"
  | "ticket";

/**
 * One entry per record that is waiting on staff — never a merged "3 bookings"
 * line. `open` is that record's own id, so the panel it links to can load the
 * row straight away instead of the admin hunting for it in a filtered table.
 */
export type AdminNotification = {
  /** Stable key for this notification: `<kind>:<record id>`. */
  id: string;
  kind: AdminNotificationKind;
  /** WhatsApp-style contact line: who or what the notice is from. */
  name: string;
  title: string;
  body: string;
  at: string | null;
  to: "/admin/bookings" | "/admin/queries" | "/admin/agents" | "/admin/tickets";
  open: string;
  priority: "high" | "medium";
  /** Booking / ticket reference shown as the pill on the toast. */
  ref: string;
};

const LIMIT = 20;

function shortRef(id: string) {
  return `BK-${id.slice(0, 8).toUpperCase()}`;
}

function firstNameOf(names: string | null | undefined) {
  const first = String(names ?? "").split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";
  return first;
}

export const listAdminNotifications = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminNotification[]> => {
    // This runs from every public page too (the bell is mounted site-wide), so a
    // visitor without an admin session must get an empty feed rather than a 401
    // that React Query would retry on each poll.
    try {
      const { data: sess } = await useSession<GateSession>(sessionConfig());
      if (!sess?.unlocked) return [];
    } catch {
      return [];
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: AdminNotification[] = [];

    const [bookingsR, slipsR, queriesR, agentsR, remindersR] = await Promise.all([
      supabaseAdmin
        .from("agent_bookings")
        .select("id, booking_ref, seats, passenger_names, agent_user_id, created_at")
        .in("status", ["submitted", "pending"])
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabaseAdmin
        .from("agent_bookings")
        .select("id, booking_ref, seats, payment_slips, payment_status, agent_user_id, updated_at")
        .in("payment_status", ["unpaid", "pending"])
        .order("updated_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("queries")
        .select("id, seq, name, service, phone, created_at")
        .eq("status", "new")
        // The queries panel lists customer enquiries only, so a notice for an
        // agent-type query would link to a page with no such row.
        .eq("user_type", "customer")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabaseAdmin
        .from("agents")
        .select("user_id, agency_name, city, contact_person, cell_number, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
      supabaseAdmin
        .from("ticket_notifications")
        .select("id, ticket_id, title, body, created_at")
        .is("seen_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ]);

    // Agency names resolve in one extra read; the toast is far less useful
    // without the trader's name on it.
    const agentIds = [
      ...new Set([
        ...(bookingsR.data ?? []).map((r: any) => r.agent_user_id),
        ...(slipsR.data ?? []).map((r: any) => r.agent_user_id),
      ].filter(Boolean) as string[]),
    ];
    const agencyNames = new Map<string, string>();
    if (agentIds.length) {
      const { data: agencies } = await supabaseAdmin
        .from("agents")
        .select("user_id, agency_name")
        .in("user_id", agentIds);
      for (const a of (agencies ?? []) as any[]) {
        agencyNames.set(String(a.user_id), String(a.agency_name ?? ""));
      }
    }
    const agencyOf = (r: any) =>
      agencyNames.get(String(r.agent_user_id ?? ""))?.trim() || "B2B Agent";

    for (const r of (bookingsR.data ?? []) as any[]) {
      const ref = String(r.booking_ref ?? "").trim() || shortRef(r.id);
      const agency = agencyOf(r);
      const pax = firstNameOf(r.passenger_names);
      out.push({
        id: `booking:${r.id}`,
        kind: "booking",
        name: agency,
        title: "New booking request",
        body: `${r.seats} seat${Number(r.seats) === 1 ? "" : "s"}${pax ? ` · ${pax}${String(r.passenger_names ?? "").split("\n").filter(Boolean).length > 1 ? " + others" : ""}` : ""} — confirm fare, payment and ticket.`,
        at: r.created_at ?? null,
        to: "/admin/bookings",
        open: r.id,
        priority: "high",
        ref,
      });
    }

    const slips = ((slipsR.data ?? []) as any[]).filter(
      (r) => Array.isArray(r.payment_slips) && r.payment_slips.length > 0,
    );
    for (const r of slips.slice(0, LIMIT)) {
      const ref = String(r.booking_ref ?? "").trim() || shortRef(r.id);
      out.push({
        id: `payment:${r.id}`,
        kind: "payment",
        name: agencyOf(r),
        title: "Payment slip uploaded",
        body: `Proof of payment for ${ref} (${r.payment_status ?? "unpaid"}) — verify it and mark the amount received.`,
        at: r.updated_at ?? null,
        to: "/admin/bookings",
        open: r.id,
        priority: "high",
        ref,
      });
    }

    for (const r of (agentsR.data ?? []) as any[]) {
      out.push({
        id: `registration:${r.user_id}`,
        kind: "registration",
        name: String(r.agency_name ?? "New agency"),
        title: "Agent registration waiting",
        body: `${[r.contact_person, r.city].filter(Boolean).join(" · ") || "Agency"} applied for B2B access — approve or reject.`,
        at: r.created_at ?? null,
        to: "/admin/agents",
        open: r.user_id,
        priority: "high",
        ref: String(r.agency_name ?? "—"),
      });
    }

    for (const q of (queriesR.data ?? []) as any[]) {
      out.push({
        id: `query:${q.id}`,
        kind: "query",
        name: String(q.name || "Customer query"),
        title: "New enquiry",
        body: `${q.service || "General enquiry"}${q.phone ? ` · ${q.phone}` : ""} — reply and close the query.`,
        at: q.created_at ?? null,
        to: "/admin/queries",
        open: q.id,
        priority: "medium",
        ref: q.seq ? `Q-${q.seq}` : "Query",
      });
    }

    for (const n of (remindersR.data ?? []) as any[]) {
      out.push({
        id: `ticket:${n.id}`,
        kind: "ticket",
        name: String(n.title || "Group ticket reminder"),
        title: String(n.title || "Ticket reminder"),
        body: String(n.body ?? ""),
        at: n.created_at ?? null,
        to: "/admin/tickets",
        open: n.ticket_id,
        priority: "medium",
        ref: "Ticket",
      });
    }

    return out
      .sort((a, b) => new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime())
      .slice(0, 60);
  },
);
