/**
 * Short-lived, signed "OTP verified" grant for the B2B booking flow.
 *
 * The browser never sees the OTP itself — it only receives this opaque token
 * after the emailed code was verified on the server. The booking insert then
 * requires a valid, unexpired grant bound to the same agent, so the OTP step
 * cannot be skipped by calling the booking endpoint directly.
 *
 * Server-only: import it inside a handler with `await import(...)`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const GRANT_TTL_MS = 15 * 60 * 1000;

function secret() {
  const s = typeof process !== "undefined" ? process.env["SESSION_SECRET"] : undefined;
  if (!s) throw new Error("Verification is not configured");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload, "utf8").digest("hex");
}

export function issueBookingGrant(userId: string) {
  const payload = `${userId}.${Date.now() + GRANT_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyBookingGrant(token: string, userId: string): { ok: true } | { ok: false; error: string } {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) return { ok: false, error: "Email verification required before booking." };
  const [uid, exp, mac] = parts as [string, string, string];
  const expected = sign(`${uid}.${exp}`);
  if (mac.length !== expected.length) return { ok: false, error: "Email verification required before booking." };
  if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))) {
    return { ok: false, error: "Email verification required before booking." };
  }
  if (uid !== userId) return { ok: false, error: "Email verification required before booking." };
  if (Number(exp) < Date.now()) return { ok: false, error: "Verification expired. Please request a new code." };
  return { ok: true };
}
