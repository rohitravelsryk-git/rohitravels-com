/**
 * The next step an admin still owes on a booking — used as the task pill in the
 * admin "Agent Group Bookings" list and in the B2B agent portal's Booking column
 * so both surfaces name the same blocker the same way.
 */

export type BookingActionInput = {
  status?: string | null;
  payment_status?: string | null;
  fare_on_demand?: string | null;
  fare_snapshot?: Record<string, any> | null;
  attachments?: any[] | null;
  tickets?: any[] | null;
};

export type BookingAction = { label: string; done: boolean; priority: number };

export function isPaid(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "confirmed" || s === "paid" || s === "ledger";
}

export function bookingAction(b: BookingActionInput): BookingAction {
  const fareText = String(b.fare_on_demand ?? b.fare_snapshot?.price_text ?? "");
  const fareSet = Number(fareText.replace(/[^\d.]/g, "")) > 0;
  const paid = isPaid(b.payment_status);
  const hasPassport = (b.attachments ?? []).some((a: any) => (a.kind ?? "passport") === "passport");
  const hasTicket = ((b.tickets ?? []) as any[]).length > 0;

  if (b.status === "cancelled") return { label: "Cancelled", done: true, priority: 0 };
  if (b.status === "confirmed") return { label: "Complete", done: true, priority: 0 };
  if (!fareSet) return { label: "Set fare", done: false, priority: 5 };
  if (!paid) return { label: "Review payment", done: false, priority: 4 };
  if (!hasPassport) return { label: "Passport needed", done: false, priority: 3 };
  if (!hasTicket) return { label: "Upload ticket", done: false, priority: 2 };
  return { label: "Ready to confirm", done: false, priority: 1 };
}
