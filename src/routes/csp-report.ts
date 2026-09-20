import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MAX_REPORT_BYTES = 64 * 1024;

const cspReportSchema = z
  .object({
    "document-uri": z.string().max(2048).optional(),
    "violated-directive": z.string().max(256).optional(),
    "effective-directive": z.string().max(256).optional(),
    "blocked-uri": z.string().max(2048).optional(),
    disposition: z.string().max(64).optional(),
    "status-code": z.number().optional(),
  })
  .passthrough();

const reportEnvelopeSchema = z.union([
  z.object({ "csp-report": cspReportSchema }),
  z.array(z.unknown()).max(50),
]);

export const Route = createFileRoute("/csp-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
          return new Response(null, { status: 413 });
        }

        const body = await request.text();
        if (new TextEncoder().encode(body).byteLength > MAX_REPORT_BYTES) {
          return new Response(null, { status: 413 });
        }

        try {
          const report = reportEnvelopeSchema.parse(JSON.parse(body));
          console.warn("[CSP Report Only]", JSON.stringify(report));
        } catch {
          return new Response(null, { status: 400 });
        }

        return new Response(null, { status: 204 });
      },
    },
  },
});