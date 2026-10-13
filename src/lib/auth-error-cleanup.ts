/**
 * Normalizes caught errors and Supabase Auth error objects into clean,
 * user-friendly strings. Intercepts empty JSON stringifications like "{}"
 * and unhandled "[object Object]" artifacts.
 */
export function cleanAuthErrorMessage(
  err: unknown,
  fallback = "Unable to sign in. Please verify your credentials and try again."
): string {
  if (!err) return fallback;

  if (typeof err === "string") {
    const trimmed = err.trim();
    if (
      !trimmed ||
      trimmed === "{}" ||
      trimmed === "null" ||
      trimmed === "undefined" ||
      trimmed === "[object Object]"
    ) {
      return fallback;
    }
    return trimmed;
  }

  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (
      !msg ||
      msg === "{}" ||
      msg === "null" ||
      msg === "undefined" ||
      msg === "[object Object]"
    ) {
      return fallback;
    }
    return msg;
  }

  if (typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    const candidate =
      anyErr.message || anyErr.error_description || anyErr.error || anyErr.msg;
    if (typeof candidate === "string" && candidate.trim()) {
      const trimmed = candidate.trim();
      if (
        trimmed !== "{}" &&
        trimmed !== "null" &&
        trimmed !== "undefined" &&
        trimmed !== "[object Object]"
      ) {
        return trimmed;
      }
    }
    const code = (anyErr.code || anyErr.error_code) as string | undefined;
    if (code === "invalid_credentials") return "Invalid email or password.";
    if (code === "email_not_confirmed") return "Please confirm your email address before signing in.";
    if (code === "user_banned") return "This account has been suspended. Please contact support.";
  }

  return fallback;
}
