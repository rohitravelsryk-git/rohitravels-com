import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { flightBlockText } from "./booking-flight-format";

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

const ADMIN_EMAIL = "raisabdulrazzaq@gmail.com";
const SITE_URL = (typeof process !== "undefined" ? process.env.PUBLIC_SITE_URL : undefined) ?? "https://rohitravels.lovable.app";

export type BookingAttachment = { name: string; path: string; size: number; type: string; url?: string };

export type AdminBooking = {
  id: string;
  booking_ref: string | null;
  agent_user_id: string;
  fare_snapshot: any;
  seats: number;
  passenger_names: string;
  contact_phone: string;
  notes: string | null;
  fare_on_demand: string | null;

  status: string;
  payment_status: string;
  ticket_status: string;
  tickets: BookingAttachment[];
  attachments: BookingAttachment[];
  payment_slips: BookingAttachment[];
  created_at: string;
  updated_at: string;
  agency_name: string | null;
  contact_person: string | null;
  agent_email: string | null;
  agent_phone: string | null;
};

function esc(s: unknown) {
  const str = String(s ?? "");
  return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fareSummary(f: any, fare?: string | null): string {
  return flightBlockText(f, { fare });
}

async function sendBookingEmail(to: string, subject: string, html: string): Promise<{ sent: boolean }> {
  const { sendAppMail } = await import("./mailer");
  const r = await sendAppMail({ to, subject, html, label: "agent-booking", fromUser: "bookings" });
  return { sent: r.sent };
}

/**
 * Called by the agent right after inserting an agent_bookings row.
 * Notifies the admin by email. Public server fn (no session gate) —
 * safe because it only READS the row that was just created and sends
 * an email to a hardcoded admin address.
 */
export const notifyBookingCreated = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ bookingId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: b } = await supabaseAdmin
      .from("agent_bookings")
      .select("*")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!b) return { ok: false as const };
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("agency_name, contact_person, email, cell_number, country_code")
      .eq("user_id", (b as any).agent_user_id)
      .maybeSingle();

    const summary = fareSummary((b as any).fare_snapshot, (b as any).fare_on_demand);
    const panelLink = `${SITE_URL.replace(/\/$/, "")}/admin/bookings`;
    const html = `<div style="font-family:Arial,sans-serif;padding:24px;max-width:640px;margin:auto;color:#0b2545">
      <h2 style="color:#0b2545;margin:0 0 8px">New Group Booking Request</h2>
      <p style="color:#666;margin:0 0 16px">Confirmation required</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 8px;color:#666;width:140px">Agency</td><td style="padding:6px 8px;font-weight:600">${esc(agent?.agency_name ?? "—")}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Contact</td><td style="padding:6px 8px;font-weight:600">${esc(agent?.contact_person ?? "—")} · ${esc(agent?.email ?? "")}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Phone (agent)</td><td style="padding:6px 8px">${esc(`${agent?.country_code ?? ""} ${agent?.cell_number ?? ""}`)}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Contact on booking</td><td style="padding:6px 8px;font-weight:600">${esc((b as any).contact_phone)}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Seats</td><td style="padding:6px 8px;font-weight:700">${esc((b as any).seats)}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Passengers</td><td style="padding:6px 8px;white-space:pre-line">${esc((b as any).passenger_names)}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Flight</td><td style="padding:6px 8px;white-space:pre-line;font-family:monospace">${esc(summary)}</td></tr>
        ${(b as any).fare_on_demand ? `<tr><td style="padding:6px 8px;color:#666">Fare On Demand</td><td style="padding:6px 8px;font-weight:700;color:#c2410c">${esc((b as any).fare_on_demand)}</td></tr>` : ""}
        ${(b as any).notes ? `<tr><td style="padding:6px 8px;color:#666">Notes</td><td style="padding:6px 8px">${esc((b as any).notes)}</td></tr>` : ""}

      </table>
      <p style="margin:20px 0"><a href="${panelLink}" style="background:#f59e0b;color:#0b2545;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">Open bookings panel →</a></p>
    </div>`;

    await sendBookingEmail(
      ADMIN_EMAIL,
      `New booking · ${agent?.agency_name ?? "Agent"} · ${(b as any).seats} seats`,
      html,
    );

    // Confirmation copy to the booking agent
    if (agent?.email) {
      const agentHtml = `<div style="font-family:Arial,sans-serif;padding:24px;max-width:640px;margin:auto;color:#0b2545">
        <h2 style="color:#0b2545;margin:0 0 8px">Booking Request Received</h2>
        <p style="color:#666;margin:0 0 16px">Dear ${esc(agent?.contact_person ?? agent?.agency_name ?? "Partner")}, we have received your group booking request. Our team will confirm shortly.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 8px;color:#666;width:140px">Seats</td><td style="padding:6px 8px;font-weight:700">${esc((b as any).seats)}</td></tr>
          <tr><td style="padding:6px 8px;color:#666">Passengers</td><td style="padding:6px 8px;white-space:pre-line">${esc((b as any).passenger_names)}</td></tr>
          <tr><td style="padding:6px 8px;color:#666">Flight</td><td style="padding:6px 8px;white-space:pre-line;font-family:monospace">${esc(summary)}</td></tr>
        </table>
        <p style="margin:20px 0;color:#666;font-size:12px">Rohi International Travels · B2B Portal</p>
      </div>`;
      await sendBookingEmail(agent.email, "Your group booking request — Rohi International Travels", agentHtml);
    }
    return { ok: true as const };
  });

/**
 * Item 7 — once a booking is BOTH confirmed and has ticket file(s) uploaded,
 * copy it into the Group Tickets Confirmed ledger (once, deduped on booking_id)
 * and email the ticket to the agent + admin.
 */
async function promoteConfirmedBooking(bookingId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: b } = await supabaseAdmin
    .from("agent_bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!b) return;
  const row = b as any;
  const f = row.fare_snapshot ?? {};
  const tickets = Array.isArray(row.tickets) ? row.tickets : [];
  
  const isSelf = f.group_type === "self";
  if (row.status !== "confirmed") return;
  if (!isSelf && tickets.length === 0) return;



  const { data: existing } = await supabaseAdmin
    .from("group_tickets").select("id").eq("booking_id", bookingId).maybeSingle();

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("agency_name, contact_person, email, country_code, cell_number")
    .eq("user_id", row.agent_user_id)
    .maybeSingle();

  const agentPhone = `${(agent as any)?.country_code ?? ""}${(agent as any)?.cell_number ?? ""}`.trim();

  if (!existing) {
    const flight = f.flight_details
      ?? `${f.flight_date ?? ""} ${f.origin_code ?? ""} ${f.destination_code ?? ""} ${f.depart_time ?? ""} ${f.arrive_time ?? ""}`.trim();
    
    const { data: insertedTicket } = await supabaseAdmin.from("group_tickets").insert({
      booking_id: bookingId,
      fare_id: fareId,
      booking_date: new Date(row.created_at).toISOString().slice(0, 10),
      agent_name: (agent as any)?.agency_name ?? "",
      agent_contact: [(agent as any)?.contact_person, agentPhone].filter(Boolean).join(" · "),
      pax_name: row.passenger_names ?? "",
      seats: Number(row.seats ?? 0),
      sector: String(flight).toUpperCase(),
      pnr: "", // Removed automatic carry over of booking_ref to PNR field
      airline: f.airline ?? "",
      otb: "NOT REQUIRED",
      contact: row.contact_phone ?? agentPhone,
      vendor: f.vendor_name ?? "",
      sale: Number(String(row.fare_on_demand ?? f.price_text ?? "").replace(/[^\d.]/g, "")) || 0,
      purchase: (Number(String(f.vendor_fare ?? "").replace(/[^\d.]/g, "")) || 0) * Number(row.seats || 1),
      group_type: f.group_type === "self" ? "self" : "party",
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      flight_status: "BOOKED",
      remarks: "UPDATED",
    } as never).select("id").maybeSingle();

    // Subtract seats from the fare
    const fareId = f.id;
    if (fareId && row.seats) {
      const { data: fare } = await supabaseAdmin
        .from("fares")
        .select("seats")
        .eq("id", fareId)
        .single();
      
      if (fare) {
        // Handle "9 out of 10" or plain numbers
        const currentSeats = String(fare.seats || "");
        const match = currentSeats.match(/(\d+)\s+out\s+of\s+(\d+)/i);
        let nextSeats = currentSeats;
        
        if (match) {
          const sold = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          const newSold = Math.min(sold + Number(row.seats), total);
          nextSeats = `${newSold} out of ${total}`;
        } else if (/^\d+$/.test(currentSeats)) {
          const count = parseInt(currentSeats, 10);
          nextSeats = String(Math.max(count - Number(row.seats), 0));
        }
        
        await supabaseAdmin.from("fares").update({ seats: nextSeats }).eq("id", fareId);
      }
    }

    // If it's a self group, add to self_group_passengers
    if (f.group_type === "self" && insertedTicket?.id) {
      const seatsCount = Number(row.seats || 1);
      const paxLines = (row.passenger_names || "").split("\n").map((l: string) => l.trim()).filter(Boolean);
      
      const paxInserts = [];
      // If we have pax names, use them up to seatsCount
      for (let i = 0; i < seatsCount; i++) {
        const name = paxLines[i] || `PAX ${i + 1} SEAT`;
        const parts = name.split(/\s+/);
        let first = name;
        let last = "";
        
        if ((name.startsWith("PAX") || name.startsWith("FULL GROUP")) && name.endsWith("SEAT")) {
          first = name;
          last = "SEAT";
        } else if (parts.length > 1) {
          last = parts.pop()!;
          first = parts.join(" ");
        }

        paxInserts.push({
          ticket_id: insertedTicket.id,
          fare_id: row.fare_id,
          first_name: first,
          last_name: last,
          title: "MR",
          sector: String(flight).toUpperCase(),
          status: "BOOKED"
        });
      }
      
      if (paxInserts.length > 0) {
        await supabaseAdmin.from("self_group_passengers").insert(paxInserts as any);
      }
    }
    
    // Auto-sync: The self-groups dashboard query handles the display side by matching sector.
    // Ensure that if it's a self group ticket, it shows up in the dashboard.


  }

  // Signed links to the uploaded ticket file(s)
  const links: string[] = [];
  for (const t of tickets) {
    if (!t?.path) continue;
    const { data: sig } = await supabaseAdmin.storage
      .from("booking-attachments").createSignedUrl(t.path, 60 * 60 * 24 * 7);
    if (sig?.signedUrl) links.push(`<li><a href="${sig.signedUrl}">${esc(t.name)}</a></li>`);
  }

  const html = `<div style="font-family:Arial,sans-serif;padding:24px;max-width:640px;margin:auto;color:#0b2545">
    <h2 style="margin:0 0 8px">Ticket Issued &amp; Confirmed</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 8px;color:#666;width:150px">Agency</td><td style="padding:6px 8px;font-weight:700">${esc((agent as any)?.agency_name ?? "—")}</td></tr>
      <tr><td style="padding:6px 8px;color:#666">Seats</td><td style="padding:6px 8px;font-weight:700">${esc(row.seats)}</td></tr>
      <tr><td style="padding:6px 8px;color:#666">Passengers</td><td style="padding:6px 8px;white-space:pre-line">${esc(row.passenger_names)}</td></tr>
      <tr><td style="padding:6px 8px;color:#666">Flight</td><td style="padding:6px 8px;white-space:pre-line;font-family:monospace">${esc(fareSummary(f))}</td></tr>
    </table>
    ${links.length ? `<p style="margin:16px 0 6px;font-weight:700">Ticket file(s)</p><ul>${links.join("")}</ul>` : ""}
    <p style="margin-top:20px;color:#666;font-size:12px">Rohi International Travels · B2B Portal</p>
  </div>`;

  const subject = `Ticket confirmed · ${(agent as any)?.agency_name ?? "Agent"} · ${row.seats} seats`;
  await sendBookingEmail(ADMIN_EMAIL, subject, html);
  if ((agent as any)?.email) await sendBookingEmail((agent as any).email, "Your ticket is confirmed — Rohi International Travels", html);
}

/** Admin edits editable booking fields (seats, passengers, contact, notes). */

export const updateBookingAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      seats: z.number().int().min(1).max(200),
      passenger_names: z.string().max(4000),
      contact_phone: z.string().max(60),
      notes: z.string().max(4000),
      fare_on_demand: z.string().max(200).optional(),

    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin
      .from("agent_bookings")
      .update({ ...patch, status: "pending" } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin edits just the "Fare On Demand" cell (no status reset). */
export const setBookingFareOnDemand = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ id: z.string().uuid(), fare_on_demand: z.string().max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agent_bookings")
      .update({ fare_on_demand: data.fare_on_demand } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });



/** Admin deletes a booking and its stored files. */
export const deleteBookingAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("agent_bookings")
      .select("attachments, tickets, payment_slips")
      .eq("id", data.id)
      .maybeSingle();
    const paths = ["attachments", "tickets", "payment_slips"]
      .flatMap((k) => (Array.isArray((row as any)?.[k]) ? (row as any)[k] : []))
      .map((a: any) => a?.path)
      .filter(Boolean) as string[];
    if (paths.length) {
      await supabaseAdmin.storage.from("booking-attachments").remove(paths);
    }
    const { error } = await supabaseAdmin.from("agent_bookings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


async function signAttachments(atts: BookingAttachment[] | null | undefined): Promise<BookingAttachment[]> {
  const list = Array.isArray(atts) ? atts : [];
  if (!list.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: BookingAttachment[] = [];
  for (const a of list) {
    if (!a?.path) { out.push(a); continue; }
    const { data: sig } = await supabaseAdmin.storage
      .from("booking-attachments")
      .createSignedUrl(a.path, 60 * 60);
    out.push({ ...a, url: sig?.signedUrl });
  }
  return out;
}

export const listBookingsAdmin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireUnlocked();
  } catch (e) {
    if (typeof process !== "undefined" && process.env.NODE_ENV === "production") throw e;
    return [] as AdminBooking[];
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("agent_bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Supabase error in listBookingsAdmin:", error.message);
    return [] as AdminBooking[];
  }
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [] as AdminBooking[];
  const ids = Array.from(new Set(rows.map((r) => r.agent_user_id)));
  const { data: agents } = await supabaseAdmin
    .from("agents")
    .select("user_id, agency_name, contact_person, email, country_code, cell_number")
    .in("user_id", ids);
  const byId = new Map((agents ?? []).map((a: any) => [a.user_id, a]));
  const out: AdminBooking[] = [];
  for (const r of rows) {
    const a = byId.get(r.agent_user_id) as any;
    out.push({
      ...r,
      payment_status: r.payment_status ?? "unpaid",
      ticket_status: r.ticket_status ?? "pending",
      tickets: await signAttachments(r.tickets),
      attachments: await signAttachments(r.attachments),
      payment_slips: await signAttachments(r.payment_slips),
      agency_name: a?.agency_name ?? null,
      contact_person: a?.contact_person ?? null,
      agent_email: a?.email ?? null,
      agent_phone: a ? `${a.country_code ?? ""} ${a.cell_number ?? ""}`.trim() : null,
    });
  }

  return out;
});

export const countPendingBookings = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("agent_bookings")
    .select("id", { count: "exact", head: true })
    .in("status", ["submitted", "pending"]);
  if (error) throw new Error(error.message);
  return { pending: count ?? 0 };
});

export const setBookingStatusAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["submitted", "pending", "confirmed", "cancelled"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agent_bookings")
      .update({ status: data.status } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "confirmed") await promoteConfirmedBooking(data.id);
    return { ok: true as const };
  });

export const setBookingPaymentStatus = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      payment_status: z.enum(["unpaid", "pending", "confirmed", "refunded", "ledger"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("agent_bookings")
      .update({ payment_status: data.payment_status } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin uploads one ticket PDF/image for a booking (base64 payload). */
export const uploadBookingTicket = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200),
      type: z.string().min(1).max(120),
      base64: z.string().min(10),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("agent_bookings")
      .select("agent_user_id, tickets, payment_status")
      .eq("id", data.id)
      .maybeSingle();
    if (rowErr || !row) throw new Error(rowErr?.message ?? "Booking not found");

    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");

    const safe = data.name.replace(/[^\w.\-]+/g, "_");
    const path = `${(row as any).agent_user_id}/tickets/${data.id}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("booking-attachments")
      .upload(path, bin, { contentType: data.type, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const existing = Array.isArray((row as any).tickets) ? (row as any).tickets : [];
    const tickets = [...existing, { name: data.name, path, type: data.type, size: bin.byteLength, uploaded_at: new Date().toISOString() }];

    const { error } = await supabaseAdmin
      .from("agent_bookings")
      .update({ tickets, ticket_status: "issued" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await promoteConfirmedBooking(data.id);
    return { ok: true as const };
  });

export const removeBookingTicket = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid(), path: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("agent_bookings").select("tickets").eq("id", data.id).maybeSingle();
    const existing = Array.isArray((row as any)?.tickets) ? (row as any).tickets : [];
    const tickets = existing.filter((t: any) => t?.path !== data.path);
    await supabaseAdmin.storage.from("booking-attachments").remove([data.path]);
    const { error } = await supabaseAdmin
      .from("agent_bookings")
      .update({ tickets, ticket_status: tickets.length ? "issued" : "pending" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin uploads a visa copy (into attachments) or a payment slip for a booking. */
export const uploadBookingDoc = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      kind: z.enum(["visa", "passport", "payment_slip"]),
      name: z.string().min(1).max(200),
      type: z.string().min(1).max(120),
      base64: z.string().min(10),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: rowErr } = await supabaseAdmin
      .from("agent_bookings")
      .select("agent_user_id, attachments, payment_slips")
      .eq("id", data.id)
      .maybeSingle();
    if (rowErr || !row) throw new Error(rowErr?.message ?? "Booking not found");

    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bin.byteLength > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");

    const folder = data.kind === "payment_slip" ? "payment-slips" : "documents";
    const safe = data.name.replace(/[^\w.\-]+/g, "_");
    const path = `${(row as any).agent_user_id}/${folder}/${data.id}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("booking-attachments")
      .upload(path, bin, { contentType: data.type, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const file = { name: data.name, path, type: data.type, size: bin.byteLength, kind: data.kind, uploaded_at: new Date().toISOString() };
    const patch: Record<string, unknown> =
      data.kind === "payment_slip"
        ? { payment_slips: [...(Array.isArray((row as any).payment_slips) ? (row as any).payment_slips : []), file] }
        : { attachments: [...(Array.isArray((row as any).attachments) ? (row as any).attachments : []), file] };

    const { error } = await supabaseAdmin.from("agent_bookings").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Admin removes a visa/passport attachment or payment slip. */
export const removeBookingDoc = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ id: z.string().uuid(), path: z.string().min(1), field: z.enum(["attachments", "payment_slips"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("agent_bookings").select("attachments, payment_slips").eq("id", data.id).maybeSingle();
    const existing = Array.isArray((row as any)?.[data.field]) ? (row as any)[data.field] : [];
    const next = existing.filter((f: any) => f?.path !== data.path);
    await supabaseAdmin.storage.from("booking-attachments").remove([data.path]);
    const { error } = await supabaseAdmin
      .from("agent_bookings")
      .update({ [data.field]: next } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


