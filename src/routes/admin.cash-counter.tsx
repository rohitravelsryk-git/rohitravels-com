import { createFileRoute } from "@tanstack/react-router";
import { AccountsBookClone } from "./admin.accounts-book";

export const Route = createFileRoute("/admin/cash-counter")({
  head: () => ({ meta: [{ title: "Cash Counter — Rohi Admin" }] }),
  component: CashCounterPage,
});

function CashCounterPage() {
  // Accounts Book owns the cash-counter tab when present; open the full book
  // and let the user switch to Cash Counter from the sidebar.
  return <AccountsBookClone />;
}
