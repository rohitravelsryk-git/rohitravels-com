import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { withMaskedPrice, type MaskableFare } from "./fare-mask";

/**
 * The Lovable AI gateway is already wired for the marketing tools
 * (src/lib/marketing.server.ts), so this file only adds the two things the site
 * needs on top of it: live agency data as the grounding block, and a budget
 * guard, because the public assistant answers to anonymous visitors and every
 * answer spends workspace credits.
 */

const WA_DISPLAY = "0305 6622988";
const LANDLINE = "068 5871647";
const EMAIL = "rohitravels@gmail.com";
const ADDRESS = "Dera Ghazi Khan, Punjab, Pakistan";

// ---------- credit guard ----------

const WINDOW_MS = 60_000;
const MAX_PER_MINUTE = 10;
const MAX_PER_DAY = 800;

const hits: number[] = [];
let todayKey = "";
let todayTotal = 0;

function budgetAllows(now: number): boolean {
  const day = new Date(now).toISOString().slice(0, 10);
  if (day !== todayKey) {
    todayKey = day;
    todayTotal = 0;
  }
  if (todayTotal >= MAX_PER_DAY) return false;
  while (hits.length && now - hits[0] > WINDOW_MS) hits.shift();
  if (hits.length >= MAX_PER_MINUTE) return false;
  hits.push(now);
  todayTotal += 1;
  return true;
}

// ---------- live grounding ----------

/** Columns the public fare list already exposes; no vendor cost, no PNR. */
const FACT_COLUMNS =
  "origin,origin_code,destination,destination_code,airline,flight_date,depart_time,seats,category,group_type,price_text,hide_fare_after_2h,auto_hide_hours,updated_at";

type FactFare = MaskableFare & {
  origin: string | null;
  origin_code: string | null;
  destination: string | null;
  destination_code: string | null;
  airline: string | null;
  flight_date: string | null;
  seats: number | null;
  category: string | null;
  group_type: string | null;
};

async function siteFacts(): Promise<{ facts: string; assistantEnabled: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);

  const [faresR, servicesR, settingsR] = await Promise.all([
    supabaseAdmin
      .from("fares")
      .select(FACT_COLUMNS)
      .eq("is_deleted", false)
      .gte("flight_date", today)
      .order("flight_date", { ascending: true })
      .limit(30),
    supabaseAdmin.from("inquiry_services").select("label").order("sort_order"),
    supabaseAdmin
      .from("site_settings")
      .select("key,value")
      .in("key", ["latest_update_toast", "assistant_enabled"]),
  ]);

  const settings = new Map<string, string>(
    (settingsR.data ?? []).map((s: { key: string; value: string }) => [s.key, s.value ?? ""]),
  );

  const lines = ((faresR.data ?? []) as FactFare[]).map((raw) => {
    const f = withMaskedPrice(raw);
    return [
      f.flight_date,
      `${f.origin_code || f.origin}→${f.destination_code || f.destination}`,
      f.airline,
      f.group_type || f.category,
      f.seats != null ? `seats ${f.seats}` : "",
      f.price_text,
    ]
      .filter(Boolean)
      .join(" · ");
  });

  const services = (servicesR.data ?? []).map((s: { label: string }) => s.label).filter(Boolean);
  const update = settings.get("latest_update_toast") ?? "";

  const facts = [
    `Today is ${new Date().toISOString().slice(0, 10)}.`,
    `Contact: WhatsApp ${WA_DISPLAY} (second line ${WA2_DISPLAY}), landline ${LANDLINE}, email ${EMAIL}, based in ${ADDRESS}.`,
    services.length ? `Services offered: ${services.join(", ")}.` : "",
    update ? `Latest announcement on the site: ${update.slice(0, 400)}` : "",
    lines.length
      ? `Live group fares right now (oldest date first, only the next 30):\n${lines.join("\n")}`
      : "No upcoming group fares are published right now.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const flag = settings.get("assistant_enabled");
  return { facts, assistantEnabled: flag !== "0" && flag !== "false" };
}

const PUBLIC_SYSTEM = (
  facts: string,
) => `You are the online assistant of Rohi International Travels, a Pakistani travel agency selling group airfares, Umrah groups, visas, hotel bookings and system ticketing.

${facts}

Rules you must follow:
- Use only the data above. Never invent a price, date, airline, seat count, visa rule or discount.
- Where a fare shows "FARE ON WHATSAPP", say the amount is shared on WhatsApp because it moves daily.
- Anything that needs a ticket issued, a passport, an installment plan or a visa check goes to a human: give WhatsApp ${WA_DISPLAY} and ask them to send the route, travel month and passenger count.
- Ask at most one clarifying question, and only when the answer depends on it.
- Never ask for or repeat card, bank, CNIC or passport numbers.
- Never discuss other customers, their bookings or their names.
- Under 80 words. Plain WhatsApp text: no markdown, no headings, no bullet tables. Line breaks are fine.
- Reply in the language the visitor wrote in: English, Roman Urdu, or Urdu script.

If the question is not about travel, visas, fares, tickets or the agency, say you only help with Rohi travel services and hand them to WhatsApp.`;

const REPLY_SYSTEM = (
  facts: string,
) => `You write WhatsApp replies for the staff of Rohi International Travels.

${facts}

Produce one ready-to-send reply to the customer message you are given. Requirements:
- Start with a short greeting using the customer's name.
- Answer what can be answered from the data above; if the fare or detail is missing, say you are confirming it and will send it shortly.
- Ask only for the single most useful missing detail (travel date, passenger count, or the passport/visa copy).
- Do not include any phone number, price you cannot verify, or promise about visa approval.
- Under 70 words. Plain text, no markdown, no signature.`;

const SUMMARY_SYSTEM = (
  facts: string,
) => `You brief the owner of Rohi International Travels on what needs his attention today.

${facts}

Turn the pending list into at most 5 short action lines, ordered by urgency, each starting with "→". Merge duplicates of the same kind into one line with the count and the names. If nothing is waiting, say so in one line. Plain text, no markdown, under 110 words.`;

// ---------- public assistant ----------

const askInput = z.object({
  question: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().max(1200) }))
    .max(8)
    .default([]),
});

export const askAssistant = createServerFn({ method: "POST" })
  .validator((d: unknown) => askInput.parse(d))
  .handler(async ({ data }) => {
    const { facts, assistantEnabled } = await siteFacts();
    if (!assistantEnabled)
      throw new Error("The online assistant is switched off — please message us on WhatsApp.");
    if (!budgetAllows(Date.now()))
      throw new Error("The assistant is busy right now — please try again in a minute.");

    const { chatMessages } = await import("./marketing.server");
    return (
      await chatMessages([
        { role: "system", content: PUBLIC_SYSTEM(facts) },
        ...data.history,
        { role: "user", content: data.question },
      ])
    ).slice(0, 1500);
  });

// ---------- staff tools ----------

async function requireStaff() {
  const { requireAdminUnlocked } = await import("./marketing.server");
  await requireAdminUnlocked();
}

export const draftQueryReply = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireStaff();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q, error } = await supabaseAdmin
      .from("queries")
      .select("seq,name,service,message,user_type,created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new Error("That query could not be found.");

    const { chatMessages } = await import("./marketing.server");
    const { facts } = await siteFacts();
    return (
      await chatMessages([
        { role: "system", content: REPLY_SYSTEM(facts) },
        {
          role: "user",
          content: `Customer: ${q.name || "—"}\nService: ${q.service || "—"}\nReceived: ${q.created_at}\n\nTheir message:\n${String(q.message ?? "").slice(0, 1500)}`,
        },
      ])
    ).slice(0, 900);
  });

export const summarisePending = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff();
  const { collectAdminNotifications } = await import("./admin-notifications.functions");
  const items = await collectAdminNotifications();
  if (!items.length)
    return "Nothing is waiting: no new bookings, slips, enquiries, agent approvals or ticket reminders.";

  const list = items
    .slice(0, 40)
    .map((i) => `- ${i.kind} | ${i.name} | ${i.title} | ${i.ref} | ${i.at ?? ""}`)
    .join("\n");

  const { chatMessages } = await import("./marketing.server");
  const { facts } = await siteFacts();
  return (
    await chatMessages([
      { role: "system", content: SUMMARY_SYSTEM(facts) },
      { role: "user", content: `Pending right now:\n${list}` },
    ])
  ).slice(0, 1200);
});
