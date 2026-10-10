import { createFileRoute } from "@tanstack/react-router";
import { AccountsBookClone } from "./admin.accounts-book";

export const Route = createFileRoute("/admin/cash-counter")({
  head: () => ({ meta: [{ title: "Cash Counter — Rohi Admin" }] }),
  component: CashCounterPage,
});

function CashCounterPage() {
  return <AccountsBookClone initialTab="cashcount" />;
}
