import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; report-uri /csp-report";

const cspReportOnlyMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (new URL(request.url).pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();

  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const errorMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    console.error('[Global Error Middleware]:', errorMsg);
    return new Response(renderErrorPage(errorMsg), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [cspReportOnlyMiddleware, errorMiddleware],
}));
