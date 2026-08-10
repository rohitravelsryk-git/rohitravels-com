import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Two-step sign-in for the B2B agent portal.
 *
 * Step 1 verifies the email + password on the server and emails a 6-digit code
 * to the registered agency address. Step 2 verifies the code. Only after step 2
 * does the browser create its actual portal session, so a leaked password on
 * its own cannot open the portal.
 */

export const requestAgentLoginCode = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    // Verify the password with a throwaway, non-persisting Supabase client.
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: signIn, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !signIn.user) return { ok: false as const, error: "Invalid email or password." };
    await client.auth.signOut().catch(() => {});

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("agency_name, email, status")
      .eq("user_id", signIn.user.id)
      .maybeSingle();
    if (agent && agent.status !== "approved") {
      return { ok: false as const, error: "Your agency account is awaiting admin approval." };
    }

    const { createLoginOtp } = await import("./login-otp.server");
    const otp = await createLoginOtp({
      purpose: "agent",
      subject: signIn.user.id,
      email: agent?.email ?? email,
      who: agent?.agency_name ?? email,
    });
    return { ok: true as const, challenge: otp.challenge, maskedEmail: otp.maskedEmail, sent: otp.sent };
  });

export const verifyAgentLoginCode = createServerFn({ method: "POST" })
  .validator((d: { challenge: string; code: string }) =>
    z.object({ challenge: z.string().uuid(), code: z.string().min(4).max(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { consumeLoginOtp } = await import("./login-otp.server");
    const res = await consumeLoginOtp({ challenge: data.challenge, code: data.code, purpose: "agent" });
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const };
  });

export const resendAgentLoginCode = createServerFn({ method: "POST" })
  .validator((d: { challenge: string }) => z.object({ challenge: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("login_otps")
      .select("purpose, subject, email")
      .eq("id", data.challenge)
      .maybeSingle();
    if (!row || row.purpose !== "agent") return { ok: false as const, error: "Please sign in again." };
    const { createLoginOtp } = await import("./login-otp.server");
    const otp = await createLoginOtp({
      purpose: "agent",
      subject: row.subject as string,
      email: row.email as string,
      who: row.email as string,
    });
    return { ok: true as const, challenge: otp.challenge, maskedEmail: otp.maskedEmail };
  });
