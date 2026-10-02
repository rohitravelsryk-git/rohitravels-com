import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/airline-ledger")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/airline-accounts" });
  },
});
