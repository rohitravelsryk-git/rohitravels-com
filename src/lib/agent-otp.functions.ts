import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cleanAuthErrorMessage } from "./auth-error-cleanup";

/**
 * Two-step sign-in for the B2B agent portal.
 *
 * Step 1 verifies the email + password on the server and checks the agency status.
 * If MFA is not required, it returns the verified session tokens so the browser can
 * establish the session directly via setSession without redundant password round-trips.
 * If MFA is enabled, a 6-digit code is generated and emailed to the agency.
 */

export const requestAgentLoginCode = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();

    // Verify the password with a throwaway, non-persisting Supabase client.
    // The URL and publishable key are not secrets (see client.ts), so they
    // fall back to Rohi's known project values if the env vars are unset.
    const { createClient } = await import("@supabase/supabase-js");
    const KNOWN_SUPABASE_URL = "https://zxcenmkxxshnlawnwans.supabase.co";
    const KNOWN_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_X6BMOYisMY_WPOwdW_g4uA_idu3Gmit";
    // Keep server-side credential verification aligned with the browser client.
    // If the server and browser use different Supabase projects/keys, the browser
    // receives an access token whose JWT signing-key ID is unknown to its API.
    const env = typeof process !== "undefined" ? process.env : undefined;
    // Use the key verified against Rohi's production Supabase project first.
    // Stale deployment environment variables can otherwise override it and
    // cause "Invalid API key" during the initial password sign-in request.
    const rawKey =
      KNOWN_SUPABASE_PUBLISHABLE_KEY ||
      env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      env?.VITE_SUPABASE_ANON_KEY ||
      env?.SUPABASE_PUBLISHABLE_KEY ||
      env?.SUPABASE_ANON_KEY;
    const key = rawKey.split(".").length === 3 || rawKey.startsWith("sb_publishable_")
      ? rawKey
      : KNOWN_SUPABASE_PUBLISHABLE_KEY;
    // Keep auth requests on the same verified project as the public key.
    const url = KNOWN_SUPABASE_URL;
    const client = createClient(url, key, {
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
    if (error || !signIn.user) {
      return { ok: false as const, error: cleanAuthErrorMessage(error, "Invalid email or password.") };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let { data: agent } = await supabaseAdmin
      .from("agents")
      .select("user_id, agency_name, email, status, mfa_enabled")
      .eq("user_id", signIn.user.id)
      .maybeSingle();

    if (!agent) {
      const { data: agentByEmail } = await supabaseAdmin
        .from("agents")
        .select("user_id, agency_name, email, status, mfa_enabled")
        .ilike("email", email)
        .maybeSingle();

      if (agentByEmail) {
        agent = agentByEmail;
        if (!agentByEmail.user_id || agentByEmail.user_id !== signIn.user.id) {
          await supabaseAdmin
            .from("agents")
            .update({ user_id: signIn.user.id })
            .eq("email", agentByEmail.email);
        }
      }
    }

    const isMasterAdmin = email === "rohitravelsryk@gmail.com" || email === "arsiteslogin@gmail.com";
    if (agent && agent.status !== "approved" && !isMasterAdmin) {
      return {
        ok: false as const,
        error:
          agent.status === "rejected"
            ? "Your agency application was not approved. Contact priority desk."
            : "Your agency account is awaiting admin approval.",
      };
    }

    // Optional MFA for login: only proceed to OTP step if explicitly enabled
    if (!agent || agent.mfa_enabled !== true) {
      return {
        ok: true as const,
        skipMfa: true,
        session: signIn.session
          ? {
              access_token: signIn.session.access_token,
              refresh_token: signIn.session.refresh_token,
            }
          : undefined,
      };
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let tokenHash: string | undefined;
    try {
      const linkRes = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: res.email,
      });
      if (linkRes.data?.properties?.hashed_token) {
        tokenHash = linkRes.data.properties.hashed_token;
      }
    } catch {
      // Fallback in case generateLink is not allowed
    }

    return { ok: true as const, tokenHash };
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

export const requestBookingMfa = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: { user } } = await supabaseAdmin.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: agent } = await supabaseAdmin
      .from("agents")
      .select("agency_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!agent?.email) throw new Error("Agent email not found");

    const { createLoginOtp } = await import("./login-otp.server");
    const otp = await createLoginOtp({
      purpose: "agent",
      subject: user.id,
      email: agent.email,
      who: agent.agency_name ?? agent.email,
      kind: "booking",
    });
    return { ok: true as const, challenge: otp.challenge, maskedEmail: otp.maskedEmail, sent: otp.sent, error: otp.error };
  });

export const verifyBookingMfa = createServerFn({ method: "POST" })
  .validator((d: { challenge: string; code: string }) =>
    z.object({ challenge: z.string().uuid(), code: z.string().min(4).max(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { consumeLoginOtp } = await import("./login-otp.server");
    const res = await consumeLoginOtp({ challenge: data.challenge, code: data.code, purpose: "agent" });
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const };
  });

export const syncAgentProfile = createServerFn({ method: "POST" })
  .validator((d: { email: string; userId: string }) =>
    z.object({ email: z.string().email(), userId: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const email = data.email.trim().toLowerCase();
      let { data: agent } = await supabaseAdmin
        .from("agents")
        .select("user_id, agency_name, email, status, mfa_enabled")
        .eq("user_id", data.userId)
        .maybeSingle();

      if (!agent) {
        const { data: byEmail } = await supabaseAdmin
          .from("agents")
          .select("user_id, agency_name, email, status, mfa_enabled")
          .ilike("email", email)
          .maybeSingle();

        if (byEmail) {
          agent = byEmail;
          if (byEmail.user_id !== data.userId) {
            await supabaseAdmin
              .from("agents")
              .update({ user_id: data.userId })
              .eq("email", byEmail.email);
            agent.user_id = data.userId;
          }
        }
      }

      return { ok: true as const, agent };
    } catch {
      return { ok: false as const, agent: null };
    }
  });
