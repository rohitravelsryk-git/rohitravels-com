import React from "react";
import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Store, Home, LogOut } from "lucide-react";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { checkAdminUnlocked, adminLogout } from "@/lib/fares.functions";
import { VendorsTable } from "@/components/vendors-table";

export const Route = createFileRoute("/admin/vendors")({
  head: () => ({ meta: [{ title: "Vendors & Suppliers — Rohi Admin" }] }),
  component: AdminVendorsPage,
});

function AdminVendorsPage() {
  const check = useServerFn(checkAdminUnlocked);
  const gate = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => check(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const router = useRouter();
  const logout = useServerFn(adminLogout);

  async function onLogout() {
    await logout();
    router.navigate({ to: "/admin" });
  }

  if (gate.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F5] p-10 text-center text-[#78716C]">
        Loading admin session…
      </div>
    );
  }

  if (!gate.data?.unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F5] p-10 text-center animate-premium-fade">
        <div className="max-w-md rounded-2xl border border-[#E7E5E4] bg-white p-8 shadow-sm">
          <Store className="mx-auto mb-3 h-10 w-10 text-[#D97757]" />
          <h2 className="text-lg font-bold text-[#1C1917]">Admin Authentication Required</h2>
          <p className="mt-1 text-xs text-[#78716C]">
            Please sign in or unlock the Rohi admin panel to manage vendors and suppliers.
          </p>
          <Link
            to="/admin"
            className="mt-5 inline-block rounded-lg bg-[#D97757] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#c66849]"
          >
            Go to Admin Login →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4EFEA] animate-premium-fade">
      {/* Top Admin Header Bar */}
      <header className="border-b border-[#E7E5E4] bg-[#141413] text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#D97757] text-white shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="font-sans text-base font-bold text-white tracking-wide">
                Vendors & Suppliers
              </p>
              <p className="text-[11px] font-medium text-white/70">
                Registered suppliers, GDS portals, and live Google Sheets sync
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <AdminHeaderExtras />
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#3d3d3a] bg-[#262624] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-[#55554f] hover:bg-[#34342f]"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </a>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D97757] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#c66849]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Unified Admin Navigation Tabs with Vendors highlighted */}
        <AdminTabs />
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6">
        <VendorsTable />
      </main>
    </div>
  );
}
