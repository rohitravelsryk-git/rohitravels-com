import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/manage-lists")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/addons" });
  },
  component: RedirectToAddons,
});

function RedirectToAddons() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.replace("/admin/addons");
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF9F5] p-6 text-center">
      <p className="text-sm font-semibold text-[#1C1917]">Redirecting to Addons…</p>
    </div>
  );
}
