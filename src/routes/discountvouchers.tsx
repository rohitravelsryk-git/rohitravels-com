import { createFileRoute, redirect } from "@tanstack/react-router";
import { legacyRedirect } from "@/lib/legacy-redirects";

/** Legacy address — permanently redirects to /discount-vouchers. */
export const Route = createFileRoute("/discountvouchers")({
  server: {
    handlers: {
      GET: ({ request }) => legacyRedirect(request, "/discount-vouchers"),
    },
  },
  beforeLoad: () => {
    throw redirect({ to: "/discount-vouchers", replace: true });
  },
});
