import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { brandedEmailHtml, emailRows } from "./email-templates/brand-html";
import { travelAtFromFlight } from "./booking-flight-format";
import { formatDateTimeShort } from "./date-format";

type GateSession = { unlocked?: boolean };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function requireUnlocked() {
  try {
    const s = await useSession<GateSession>(sessionConfig());
    if (!s.data.unlocked) throw new Error("Unauthorized");
    return s;
  } catch (e) {
    throw e;
  }
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
  fare_id?: string | null;
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
  try {
    await requireUnlocked();
  } catch (e) {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") throw e;
    return [] as GroupTicket[];
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("group_tickets")
    .select("*")
    .order("travel_at", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as GroupTicket[];
  // Sign every attachment in one batched call: the loop this replaces made a
  // separate Storage round-trip per file, which dominated this page's load time.
  const paths = Array.from(
    new Set(
      rows
        .flatMap((r) => (Array.isArray(r.attachments) ? r.attachments : []) as Array<{ path?: string }>)
        .map((a) => a?.path)
        .filter((p): p is string => Boolean(p)),
    ),
  );
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabaseAdmin.storage
      .from("booking-attachments")
      .createSignedUrls(paths, 60 * 60);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
    }
  }
  for (const r of rows) {
    const list = Array.isArray(r.attachments) ? r.attachments : [];
    r.attachments = list.map((a: any) => (a?.path ? { ...a, url: urls.get(a.path) } : a));
  }
  return rows;
});


export const createTicket = createServerFn({ method: "POST" })
  .validator((d: unknown) => ticketInput.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("group_tickets")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    try { await notifyUpdateNameStatus(supabaseAdmin, row as GroupTicket); } catch (e) { console.error("update-name notice", e); }
    // Auto-mirror self-group tickets into the passenger manifest so they show
    // up on the Self Groups dashboards immediately (linked to their fare).
    if ((row as GroupTicket).group_type === "self") {
      const { syncSelfTicketsToDashboards } = await import("./self-group-link.server");
      try { await syncSelfTicketsToDashboards(supabaseAdmin); } catch (e) { console.error("self-sync", e); }
    }
    return row as GroupTicket;
  });

export const updateTicket = createServerFn({ method: "POST" })
  .validator((d: unknown) => ticketInput.extend({ id: z.string().uuid() }).parse(d))
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
    try { await notifyUpdateNameStatus(supabaseAdmin, row as GroupTicket); } catch (e) { console.error("update-name notice", e); }
    if ((row as GroupTicket).group_type === "self") {
      const { syncSelfTicketsToDashboards } = await import("./self-group-link.server");
      try { await syncSelfTicketsToDashboards(supabaseAdmin); } catch (e) { console.error("self-sync", e); }
    }
    return row as GroupTicket;
  });


export const deleteTicket = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("group_tickets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin uploads a passport / visa-OTB copy against a confirmed group ticket. */
export const uploadTicketDoc = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      kind: z.enum(["passport", "visa"]),
      name: z.string().min(1),
      type: z.string().default("application/octet-stream"),
      base64: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: rowErr } = await (supabaseAdmin as any)
      .from("group_tickets").select("attachments").eq("id", data.id).maybeSingle();
    if (rowErr || !row) throw new Error(rowErr?.message ?? "Ticket not found");

    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");

    const safe = data.name.replace(/[^\w.\-]+/g, "_");
    const path = `group-tickets/${data.id}/${data.kind}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("booking-attachments")
      .upload(path, bin, { contentType: data.type, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const existing: TicketAttachment[] = Array.isArray(row.attachments) ? row.attachments : [];
    const attachments = [...existing, { name: data.name, path, type: data.type, kind: data.kind }];
    const { error } = await (supabaseAdmin as any)
      .from("group_tickets").update({ attachments }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeTicketDoc = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid(), path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("group_tickets").select("attachments").eq("id", data.id).maybeSingle();
    const existing: TicketAttachment[] = Array.isArray(row?.attachments) ? row.attachments : [];
    const attachments = existing.filter((a) => a?.path !== data.path);
    await supabaseAdmin.storage.from("booking-attachments").remove([data.path]);
    const { error } = await (supabaseAdmin as any)
      .from("group_tickets").update({ attachments }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireUnlocked();
  } catch {
    // Not signed in (or session not yet established during SSR/prerender):
    // return an empty list instead of throwing, which blanks the page.
    return [] as TicketNotification[];
  }
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
  try {
    await requireUnlocked();
  } catch {
    return { unread: 0 };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await (supabaseAdmin as any)
    .from("ticket_notifications")
    .select("id", { count: "exact", head: true })
    .is("seen_at", null);
  if (error) throw new Error(error.message);
  return { unread: count ?? 0 };
});

export const markNotificationsSeen = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).optional() }).parse(d))
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
  return formatDateTimeShort(iso);
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

const REMINDER_EMAIL_TO = "rohitravelsryk@gmail.com";
const REMINDER_WHATSAPP_TO = "923056622988";
const SITE_URL = (typeof process !== "undefined" ? process.env.PUBLIC_SITE_URL : undefined) ?? "https://rohitravels.com";

const REMINDER_EMAIL_COPY: Record<string, { category: string; title: string; intro: string }> = {
  "48h_update_name": {
    category: "GROUP TICKETS CONFIRMED · NAME UPDATE",
    title: "Update passenger name(s) — 48 hours left",
    intro: "This flight departs within 48 hours. Please confirm the passenger name(s) against the airline booking and update this record before the airline's change cut-off.",
  },
  status_update_name: {
    category: "GROUP TICKETS CONFIRMED · NAME UPDATE",
    title: "Status set to UPDATE NAME — passenger name(s) must be fixed",
    intro: "A Group Tickets Confirmed row has been flagged UPDATE NAME. Confirm the passenger name(s) with the agency and correct the airline record before this flight departs.",
  },
  "72h": {
    category: "GROUP TICKETS CONFIRMED · PRE-DEPARTURE CHECK",
    title: "Travellers depart in about 72 hours",
    intro: "Verify ticket, OTB and passenger details for this group before the airline's three-day deadline.",
  },
  "24h": {
    category: "GROUP TICKETS CONFIRMED · FINAL CALL",
    title: "Travellers depart in about 24 hours",
    intro: "Final check: confirm the group is OTB-ready and the airline record matches the names below.",
  },
};

/** Branded HTML for a reminder, same shell as the booking and ticket emails.
 * The plain-text body stays the WhatsApp/notice copy. */
function reminderEmailHtml(kind: string, t: GroupTicket): string {
  const copy = REMINDER_EMAIL_COPY[kind] ?? REMINDER_EMAIL_COPY["72h"];
  const rows: [string, unknown][] = [
    ["Transaction", `#${t.seq ?? "—"}${t.booking_id ? ` · BK-${t.booking_id.slice(0, 8).toUpperCase()}` : ""}`],
    ["Pax Name(s)", t.pax_name || "—"],
    ["Seats", t.seats || 0],
    ["Flight Date & Time", t.travel_at ? fmtTravel(t.travel_at) : "—"],
    ["Sector", t.sector || "—"],
    ["PNR", t.pnr || "—"],
    ["Airline", t.airline || "—"],
    ["Agency", t.agent_name || "—"],
    ["Contact", t.contact || "—"],
    ["Vendor", t.vendor || "—"],
    ["Ticket Status", t.flight_status || "—"],
  ];
  if (t.ledger_entry) rows.push(["Ledger Entry", t.ledger_entry]);
  return brandedEmailHtml({
    category: copy.category,
    title: copy.title,
    intro: copy.intro,
    body: `${emailRows(rows)}<p style="margin:18px 0 0;color:#78716C;font-size:11px;line-height:18px;text-transform:uppercase;letter-spacing:0.06em">For official use only · Rohi International Travels</p>`,
    action: { label: "Open Group Tickets Confirmed", url: `${SITE_URL.replace(/\/$/, "")}/admin/tickets` },
  });
}

async function sendEmail(subject: string, body: string, html: string): Promise<boolean> {
  const { sendAppMail } = await import("./mailer");
  const r = await sendAppMail({
    to: REMINDER_EMAIL_TO,
    subject,
    text: body,
    html,
    fromLabel: "Rohi Travels Reminders",
    fromUser: "reminders",
    label: "ticket-reminder",
  });
  return r.sent;
}

async function sendWhatsApp(text: string): Promise<boolean> {
  const url = typeof process !== "undefined" ? process.env.WHATSAPP_WEBHOOK_URL : undefined;
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
 * Record + deliver one notice. The unique(ticket_id, kind) row is also the dedupe
 * key, so a re-run of the scan never mails the same notice twice.
 */
async function dispatchTicketNotice(
  supabaseAdmin: any,
  t: GroupTicket,
  kind: string,
  title: string,
  body: string,
  opts: { sentField?: "reminder_24h_sent_at" | "reminder_72h_sent_at"; whatsapp?: boolean } = {},
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("ticket_notifications").insert({ ticket_id: t.id, kind, title, body });
  if (error) return false;
  const channels: string[] = [];
  if (await sendEmail(title, body, reminderEmailHtml(kind, t))) channels.push("email");
  if (opts.whatsapp !== false && (await sendWhatsApp(body))) channels.push("whatsapp");
  if (opts.sentField) {
    await supabaseAdmin.from("group_tickets").update({ [opts.sentField]: new Date().toISOString() }).eq("id", t.id);
  }
  if (channels.length) {
    await supabaseAdmin
      .from("ticket_notifications")
      .update({ channels_sent: channels })
      .eq("ticket_id", t.id).eq("kind", kind);
  }
  return true;
}

/**
 * The STATUS column is the office's own flag, so picking UPDATE NAME mails
 * rohitravelsryk@gmail.com straight away rather than waiting for the 36–48h
 * reminder window. WhatsApp is skipped: re-flagging a batch must not spam the thread.
 */
export async function notifyUpdateNameStatus(supabaseAdmin: any, t: GroupTicket): Promise<boolean> {
  if (!t?.id) return false;
  if (String(t.flight_status || "").trim().toUpperCase() !== "UPDATE NAME") return false;
  const title = `UPDATE NAME · #${t.seq ?? "—"} ${t.pax_name || "Pax"} · ${(t.sector || "").replace(/\n/g, " ")} · PNR ${t.pnr || "—"}`;
  return dispatchTicketNotice(supabaseAdmin, t, "status_update_name", title, buildUpdateNameMessage(t), { whatsapp: false });
}

/**
 * Scan tickets by travel_at and create notifications for 72h / 48h-update-name / 24h windows.
 * Sends email + optional WhatsApp webhook. Dedupes via unique(ticket_id, kind).
 */
export const runTicketReminderScan = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const in72 = new Date(now.getTime() + 72 * 3600 * 1000);

  // Tickets copied from a confirmed booking used to land without travel_at, which
  // left their Status column blank and out of every reminder window.
  const { data: undated } = await (supabaseAdmin as any)
    .from("group_tickets")
    .select("id, sector")
    .is("travel_at", null)
    .limit(200);
  for (const row of (undated ?? []) as { id: string; sector: string | null }[]) {
    const iso = travelAtFromFlight(row.sector);
    if (iso) await (supabaseAdmin as any).from("group_tickets").update({ travel_at: iso }).eq("id", row.id);
  }

  // Rows whose travel_at was derived while the parser read the sector clock in the
  // server's zone sit exactly five hours off FLIGHT DETAILS, so they are re-derived.
  // Anything else — including a date an admin typed by hand — is left alone.
  const HOUR = 3600000;
  const { data: dated } = await (supabaseAdmin as any)
    .from("group_tickets")
    .select("id, sector, travel_at")
    .not("travel_at", "is", null)
    .order("travel_at", { ascending: true })
    .limit(500);
  for (const row of (dated ?? []) as { id: string; sector: string | null; travel_at: string }[]) {
    const iso = travelAtFromFlight(row.sector);
    if (!iso) continue;
    const stored = new Date(row.travel_at).getTime();
    if (Number.isNaN(stored)) continue;
    if (Math.abs(stored - new Date(iso).getTime() - 5 * HOUR) < 2000) {
      await (supabaseAdmin as any).from("group_tickets").update({ travel_at: iso }).eq("id", row.id);
    }
  }

  // PNR, Vendor and Purchase are copied from the booking and its Admin Fare — the
  // same three values the Agents Group Bookings panel shows. Rows copied before
  // that hand-off existed are filled here, and anything already entered in the
  // tickets ledger is left alone.
  const colSelect = "id, booking_id, fare_id, pnr, vendor, purchase";
  const blankCols = await Promise.all([
    (supabaseAdmin as any).from("group_tickets").select(colSelect).eq("pnr", "").limit(200),
    (supabaseAdmin as any).from("group_tickets").select(colSelect).eq("vendor", "").limit(200),
    (supabaseAdmin as any).from("group_tickets").select(colSelect).eq("purchase", 0).limit(200),
  ]);
  const rowsToFill = new Map<string, any>();
  for (const res of blankCols) {
    for (const r of (res?.data ?? []) as any[]) rowsToFill.set(r.id, r);
  }
  if (rowsToFill.size) {
    const pending = Array.from(rowsToFill.values());
    const fareIds = Array.from(new Set(pending.map((r) => r.fare_id).filter(Boolean)));
    const bookingIds = Array.from(new Set(pending.map((r) => r.booking_id).filter(Boolean)));
    const [faresRes, bookingsRes] = await Promise.all([
      fareIds.length
        ? (supabaseAdmin as any).from("fares").select("id, pnr, vendor_fare, vendor_name").in("id", fareIds)
        : Promise.resolve({ data: [] as any[] }),
      bookingIds.length
        ? (supabaseAdmin as any).from("agent_bookings").select("id, pnr, fare_snapshot").in("id", bookingIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const byFare = new Map<string, any>(((faresRes?.data ?? []) as any[]).map((f) => [f.id, f]));
    const byBooking = new Map<string, any>(((bookingsRes?.data ?? []) as any[]).map((b) => [b.id, b]));

    for (const r of pending) {
      const fare = r.fare_id ? byFare.get(r.fare_id) : undefined;
      const booking = r.booking_id ? byBooking.get(r.booking_id) : undefined;
      const patch: Record<string, unknown> = {};

      if (!String(r.pnr ?? "").trim()) {
        const fromBooking =
          String((booking?.fare_snapshot as any)?.pnr ?? "").trim() || String(booking?.pnr ?? "").trim();
        const pnr = fromBooking || String(fare?.pnr ?? "").trim();
        if (pnr) patch.pnr = pnr.toUpperCase();
      }
      if (!String(r.vendor ?? "").trim()) {
        const vendorName = String(fare?.vendor_name ?? "").trim();
        if (vendorName) patch.vendor = vendorName;
      }
      if (!(Number(r.purchase) > 0)) {
        const cost = Number(String(fare?.vendor_fare ?? "").replace(/[^\d.]/g, "")) || 0;
        if (cost > 0) patch.purchase = cost;
      }
      if (Object.keys(patch).length) await (supabaseAdmin as any).from("group_tickets").update(patch).eq("id", r.id);
    }
  }

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
    const windows: { kind: "72h" | "48h_update_name" | "24h"; sentField?: "reminder_24h_sent_at" | "reminder_72h_sent_at" }[] = [];
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
        title = `UPDATE NAME · #${t.seq ?? "—"} ${t.pax_name || "Pax"} · ${t.sector || ""} · PNR ${t.pnr || "—"}`;
        body = buildUpdateNameMessage(t);
      } else {
        title = `Travel in ~${w.kind === "72h" ? "72h" : "24h"} · #${t.seq ?? "—"} ${t.pax_name || "Pax"} · ${t.sector || ""} (PNR ${t.pnr || "—"})`;
        body = [
          `Passenger: ${t.pax_name}`, `Sector: ${t.sector}`, `Airline: ${t.airline}`, `PNR: ${t.pnr}`,
          `Travel: ${travel.toUTCString()}`, `Agent: ${t.agent_name}`, `Contact: ${t.contact}`,
          `Vendor: ${t.vendor}`, `Status: ${t.flight_status}`,
        ].join("\n");
      }

      if (await dispatchTicketNotice(supabaseAdmin, t, w.kind, title, body, { sentField: w.sentField })) {
        created.push({ ticket: t.id, kind: w.kind });
      }
    }
  }
  // Safety net for rows flagged UPDATE NAME outside the save handler (older data,
  // bulk edits): the unique notification row keeps this to one mail per ticket.
  const { data: flagged } = await (supabaseAdmin as any)
    .from("group_tickets")
    .select("*")
    .eq("flight_status", "UPDATE NAME")
    .limit(200);
  for (const t of (flagged ?? []) as GroupTicket[]) {
    try {
      if (await notifyUpdateNameStatus(supabaseAdmin, t)) created.push({ ticket: t.id, kind: "status_update_name" });
    } catch (e) {
      console.error("update-name notice", e);
    }
  }

  return { scanned: tickets.length, created: created.length };
});
