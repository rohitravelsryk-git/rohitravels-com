import { createFileRoute, useRouter } from "@tanstack/react-router";
// FILE_TOO_LARGE_FOR_INLINE — loading from artifact via alternative
export const Route = createFileRoute("/admin/accounts-book")({
  head: () => ({ meta: [{ title: "Accounts Book — Rohi Admin" }] }),
  component: () => null,
});
