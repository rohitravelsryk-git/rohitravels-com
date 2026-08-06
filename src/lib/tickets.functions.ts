import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  const password = process.env.SESSION_SECRET;
  if (!password) throw new Error("SESSION_SECRET not set");
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
}

export type TicketAttachment = { name: string; path?: string; url?: string; type?: string; kind?: string };

export type GroupTicket = {
  id: string;
  seq: number;
  booking_date: string | null;
  agent_name: string;
  agent_contact: string;
  pax_name: string;
  seats: number;
  sector: string;
  pnr: string;
  airline: string;
  travel_at: string | null;
  flight_status: string;
  otb: string;
  contact: string;
  vendor: string;
  sale: number;
  purchase: number;
  profit: number;
  ledger_entry: string;
  remarks: string;
  group_type: string;
  attachments: TicketAttachment[];
  booking_id: string | null;
  reminder_24h_sent_at: string | null;
  reminder_72h_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketNotification = {
  id: string;
  ticket_id: string;
  kind: string;
  title: string;
  body: string;
  channels_sent: string[];
  seen_at: string | null;
  created_at: string;
};

const ticketInput = z.object({
  booking_date: z.string().optional().nullable(),
  agent_name: z.string().default(""),
  agent_contact: z.string().default(""),
  pax_name: z.string().default(""),
  seats: z.coerce.number().int().min(0).default(0),
  sector: z.string().default(""),
  pnr: z.string().default(""),
  airline: z.string().default(""),
  travel_at: z.string().optional().nullable(),
  flight_status: z.string().default("BOOKED"),
  otb: z.string().default("NOT REQUIRED"),
  contact: z.string().default(""),
  vendor: z.string().default(""),
  sale: z.coerce.number().default(0),
  purchase: z.coerce.number().default(0),
  ledger_entry: z.string().default(""),
  remarks: z.string().default(""),
  group_type: z.enum(["self", "party"]).optional().default("party"),
});


// Split "MUHAMMAD ALI KHAN" into { first: "MUHAMMAD", last: "ALI KHAN" }.
function splitName(full: string): { title: string; first: string; last: string } {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { title: "MR", first: "", last: "" };
  if (parts.length === 1) return { title: "MR", first: parts[0], last: "" };
  return { title: "MR", first: parts[0], last: parts.slice(1).join(" ") };
}

export const listTickets = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("group_tickets")
    .select("*")
    .order("travel_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as GroupTicket[];
  // Sign attachment paths (passport / visa copies carried over from agent bookings)
  for (const r of rows) {
    const list = Array.isArray(r.attachments) ? r.attachments : [];
    r.attachments = [];
    for (const a of list) {
      if (!a?.path) { r.attachments.push(a); continue; }
      const { data: sig } = await supabaseAdmin.storage
        .from("booking-attachments")
        .createSignedUrl(a.path, 60 * 60);
      r.attachments.push({ ...a, url: sig?.signedUrl });
    }
  }
  return rows;
});


export const createTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ticketInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("group_tickets")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Auto-mirror self-group tickets into the passenger manifest so they show
    // up on the Self Groups tab immediately.
    if ((row as GroupTicket).group_type === "self") {
      const nm = splitName((row as GroupTicket).pax_name);
      await (supabaseAdmin as any).from("self_group_passengers").insert({
        ticket_id: (row as GroupTicket).id,
        title: nm.title,
        first_name: nm.first,
        last_name: nm.last,
        pnr: (row as GroupTicket).pnr || "",
        sector: (row as GroupTicket).sector || "",
      });
    }
    return row as GroupTicket;
  });

export const updateTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ticketInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("group_tickets")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as GroupTicket;
  });

export const deleteTicket = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("group_tickets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("ticket_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as TicketNotification[];
});

export const countUnreadNotifications = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await (supabaseAdmin as any)
    .from("ticket_notifications")
    .select("id", { count: "exact", head: true })
    .is("seen_at", null);
  if (error) throw new Error(error.message);
  return { unread: count ?? 0 };
});

export const markNotificationsSeen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).optional() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = (supabaseAdmin as any)
      .from("ticket_notifications")
      .update({ seen_at: new Date().toISOString() })
      .is("seen_at", null);
    const { error } = data.ids && data.ids.length ? await q.in("id", data.ids) : await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Compute automatic flight status from travel_at (Excel-style rule):
 *   >48h  → FLIGHT IS FAR
 *   >36h  → UPDATE NAME
 *   >=1h  → SCHEDULED
 *   <0    → FLOWN
 *   else  → UPCOMMING
 */
export function deriveFlightStatus(travelAt: string | null | undefined, now: Date = new Date()): string {
  if (!travelAt) return "";
  const hours = (new Date(travelAt).getTime() - now.getTime()) / 3600000;
  if (hours > 48) return "FLIGHT IS FAR";
  if (hours > 36) return "UPDATE NAME";
  if (hours >= 1) return "SCHEDULED";
  if (hours < 0) return "FLOWN";
  return "UPCOMMING";
}

function fmtTravel(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${pad(d.getDate())}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildUpdateNameMessage(t: GroupTicket): string {
  return [
    "*48 HOURS LEFT*",
    "FOR GROUP TICKET NAME UPDATE",
    "",
    "*PLEASE UPDATE NAME(S)*",
    "",
    "",
    `Pax Name(s): *${t.pax_name || "—"}*`,
    `Flight Date & Time: *${t.travel_at ? fmtTravel(t.travel_at) : "—"}*`,
    "",
    `Sector: ${t.sector || "—"}`,
    `PNR: ${t.pnr || "—"}`,
    `Airline: ${t.airline || "—"}`,
    "",
    "",
    "*ROHI INTERNATIONAL TRAVELS*",
    "",
    "*FOR OFFICIAL USE ONLY*",
    `Vendor: ${t.vendor || "—"}`,
    `Agent Name: ${t.agent_name || "—"}`,
  ].join("\n");
}

const REMINDER_EMAIL_TO = "raisabdulrazzaq@gmail.com";
const REMINDER_WHATSAPP_TO = "923056622988";

async function sendEmail(subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const sender = process.env.SENDER_DOMAIN;
  if (!apiKey || !sender) return false;
  try {
    const resp = await fetch("https://api.lovable.dev/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: `Rohi Travels Reminders <reminders@${sender}>`,
        to: REMINDER_EMAIL_TO,
        subject,
        text: body,
      }),
    });
    return resp.ok;
  } catch { return false; }
}

async function sendWhatsApp(text: string): Promise<boolean> {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  if (!url) return false;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: REMINDER_WHATSAPP_TO, text }),
    });
    return resp.ok;
  } catch { return false; }
}

/**
 * Scan tickets by travel_at and create notifications for 72h / 48h-update-name / 24h windows.
 * Sends email + optional WhatsApp webhook. Dedupes via unique(ticket_id, kind).
 */
export const runTicketReminderScan = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const in72 = new Date(now.getTime() + 72 * 3600 * 1000);

  const { data: due, error } = await (supabaseAdmin as any)
    .from("group_tickets")
    .select("*")
    .not("travel_at", "is", null)
    .lte("travel_at", in72.toISOString())
    .gte("travel_at", now.toISOString());
  if (error) throw new Error(error.message);

  const tickets = (due ?? []) as GroupTicket[];
  const created: { ticket: string; kind: string }[] = [];

  for (const t of tickets) {
    const travel = new Date(t.travel_at!);
    const hoursOut = (travel.getTime() - now.getTime()) / 3600000;
    const windows: { kind: "72h" | "48h_update_name" | "24h"; sentField?: keyof GroupTicket }[] = [];
    if (hoursOut <= 72 && hoursOut > 48 && !t.reminder_72h_sent_at)
      windows.push({ kind: "72h", sentField: "reminder_72h_sent_at" });
    if (hoursOut <= 48 && hoursOut > 36)
      windows.push({ kind: "48h_update_name" });
    if (hoursOut <= 24 && !t.reminder_24h_sent_at)
      windows.push({ kind: "24h", sentField: "reminder_24h_sent_at" });

    for (const w of windows) {
      let title: string;
      let body: string;
      if (w.kind === "48h_update_name") {
        title = `Group Tickets Confirmed · UPDATE NAME · ${t.pax_name || "Pax"} · ${t.sector || ""} (${t.pnr || "—"})`;
        body = buildUpdateNameMessage(t);
      } else {
        title = `Group Tickets Confirmed · Travel in ~${w.kind === "72h" ? "72h" : "24h"} · ${t.pax_name || "Pax"} · ${t.sector || ""} (${t.pnr || "—"})`;
        body = [
          `Passenger: ${t.pax_name}`, `Sector: ${t.sector}`, `Airline: ${t.airline}`, `PNR: ${t.pnr}`,
          `Travel: ${travel.toUTCString()}`, `Agent: ${t.agent_name}`, `Contact: ${t.contact}`,
          `Vendor: ${t.vendor}`, `OTB: ${t.otb}`, `Status: ${t.flight_status}`,
        ].join("\n");
      }

      const { error: insErr } = await (supabaseAdmin as any)
        .from("ticket_notifications")
        .insert({ ticket_id: t.id, kind: w.kind, title, body });
      if (insErr) { continue; }
      created.push({ ticket: t.id, kind: w.kind });

      const channels: string[] = [];
      if (await sendEmail(title, body)) channels.push("email");
      if (await sendWhatsApp(body)) channels.push("whatsapp");

      if (w.sentField) {
        await (supabaseAdmin as any)
          .from("group_tickets")
          .update({ [w.sentField]: new Date().toISOString() })
          .eq("id", t.id);
      }
      if (channels.length) {
        await (supabaseAdmin as any)
          .from("ticket_notifications")
          .update({ channels_sent: channels })
          .eq("ticket_id", t.id).eq("kind", w.kind);
      }
    }
  }
  return { scanned: tickets.length, created: created.length };
});
