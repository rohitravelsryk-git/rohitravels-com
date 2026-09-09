import type { ToolContext } from "@lovable.dev/mcp-js";

export const ADMIN_EMAIL = "rohitravelsryk@gmail.com";

export function isAdmin(ctx: ToolContext): boolean {
  if (!ctx.isAuthenticated()) return false;
  const email = ctx.getUserEmail?.();
  return typeof email === "string" && email.toLowerCase() === ADMIN_EMAIL;
}

export function unauthorized(message = "Admin account required") {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
