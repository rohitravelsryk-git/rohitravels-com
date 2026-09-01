import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Mandatory email OTP verification for every B2B Agent Portal booking.
 *
 * `requestBookingOtp` emails a 6-digit code (hashed + expiring in the DB) to the
 * logged-in agent's registered address. `verifyBookingOtp` returns a signed,
 * short-lived grant, and `createVerifiedBooking` refuses to insert the booking
 * without that grant — so the OTP step cannot be bypassed from the frontend.
 */

async function sendCode(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("agency_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (!agent?.email) return { ok: false as const, error: "No registered email found for your agency." };

  const { createLoginOtp } = await import("./login-otp.server");
  const otp = await createLoginOtp({
    purpose: "agent",
    subject: userId,
    email: agent.email,
    who: agent.agency_name ?? agent.email,
    kind: "booking",
  });
  if (!otp.sent) return { ok: false as const, error: otp.error ?? "Could not send the verification code." };
  return {
    ok: true as const,
    challenge: otp.challenge,
    maskedEmail: otp.maskedEmail,
    expiresInSeconds: 600,
  };
}

export const requestBookingOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => sendCode(context.userId));

export const resendBookingOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => sendCode(context.userId));

export const verifyBookingOtp = createServerFn({ method: "POST" })
  .validator((d: { challenge: string; code: string }) =>
    z.object({ challenge: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { consumeLoginOtp } = await import("./login-otp.server");
    const res = await consumeLoginOtp({ challenge: data.challenge, code: data.code, purpose: "agent" });
    if (!res.ok) return { ok: false as const, error: res.error };
    if (res.subject !== context.userId) {
      return { ok: false as const, error: "This code does not belong to your session." };
    }
    const { issueBookingGrant } = await import("./booking-grant.server");
    return { ok: true as const, grant: issueBookingGrant(context.userId) };
  });

const bookingInput = z.object({
  grant: z.string().min(10),
  fare_id: z.string().uuid(),
  fare_snapshot: z.any(),
  seats: z.number().int().min(1).max(200),
  passenger_names: z.string().min(3),
  contact_phone: z.string().max(60),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        path: z.string(),
        size: z.number(),
        type: z.string(),
        kind: z.string(),
      }),
    )
    .max(40),
});

export const createVerifiedBooking = createServerFn({ method: "POST" })
  .validator((d: unknown) => bookingInput.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { verifyBookingGrant } = await import("./booking-grant.server");
    const grant = verifyBookingGrant(data.grant, context.userId);
    if (!grant.ok) return { ok: false as const, error: grant.error };

    // Group → Self bookings inherit the PNR from their Admin Fare record so the
    // admin booking request shows the correct PNR without manual entry.
    let snapshot = data.fare_snapshot ?? {};
    const { data: fareRow } = await context.supabase
      .from("fares")
      .select("group_type, pnr, price_text")
      .eq("id", data.fare_id)
      .maybeSingle();
    const fare = fareRow as { group_type?: string | null; pnr?: string | null; price_text?: string | null } | null;

    // The client fare list may show the masked "FARE ON WHATSAPP" label once the
    // timer hides an amount. The snapshot must always store the real admin fare
    // so booking totals and ledger debits are never zero.
    const realPrice = (fare?.price_text ?? "").trim();
    if (realPrice && /\d/.test(realPrice)) {
      snapshot = { ...snapshot, price_text: realPrice };
    }

    if (fare && (fare.group_type ?? "").toLowerCase() === "self") {
      snapshot = { ...snapshot, group_type: "self", pnr: (fare.pnr ?? "").trim().toUpperCase() };
    }

    const { data: inserted, error } = await context.supabase
      .from("agent_bookings")
      .insert({
        agent_user_id: context.userId,
        fare_id: data.fare_id,
        fare_snapshot: snapshot,

        seats: data.seats,
        passenger_names: data.passenger_names,
        contact_phone: data.contact_phone,
        fare_on_demand: "",
        attachments: data.attachments,
        payment_status: "unpaid",
        ticket_status: "submitted",
        status: "submitted",
      } as never)
      .select("id")
      .single();

    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, bookingId: (inserted as { id: string }).id };
  });
