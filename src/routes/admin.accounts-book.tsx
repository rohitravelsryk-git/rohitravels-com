import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/accounts-book")({
  head: () => ({ meta: [{ title: "Accounts Book — Rohi Admin" }] }),
  component: AccountsBookRestoring,
});

function AccountsBookRestoring() {
  useEffect(() => {
    // Placeholder while full page is restored via GitHub Action
  }, []);
  return (
    <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Accounts Book</h1>
      <p style={{ marginTop: 12, lineHeight: 1.5, color: "#444" }}>
        Restoring the full Accounts Book page with draggable sidebar. This takes about a minute after the restore workflow runs. Refresh shortly.
      </p>
    </div>
  );
}

// Re-export name expected by cash-counter route (temporary)
export function AccountsBookClone() {
  return <AccountsBookRestoring />;
}
