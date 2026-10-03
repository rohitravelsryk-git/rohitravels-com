import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { allowedStaffPaths } from "@/lib/admin-tabs";

export type PortalRole = "guest" | "staff" | "admin";
export type AdminPortalContext = {
  portalRole: PortalRole;
  staffTabs: string[];
  staffUsername: string | null;
};

/**
 * Role-based layout gate for the whole /admin subtree.
 * Resolves session and role on client navigation with resilience against transient errors.
 */
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }): Promise<AdminPortalContext> => {
    let s = { unlocked: false, staffUsername: null as string | null, staffTabs: [] as string[] };
    try {
      s = await checkAdminUnlocked();
    } catch (err) {
      console.warn("checkAdminUnlocked error in beforeLoad:", err);
      if (typeof window !== "undefined" && window.sessionStorage.getItem("rohi_admin_unlocked") === "true") {
        return { portalRole: "admin", staffTabs: [], staffUsername: null };
      }
    }

    if (s.unlocked && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("rohi_admin_unlocked", "true");
      } catch {}
    }

    const role: PortalRole = !s.unlocked
      ? ((typeof window !== "undefined" && window.sessionStorage.getItem("rohi_admin_unlocked") === "true") ? "admin" : "guest")
      : s.staffUsername ? "staff" : "admin";
    const staffTabs = s.staffTabs ?? [];

    // Not signed in: only the unlock screen at /admin may render.
    if (role === "guest") {
      if (location.pathname !== "/admin") throw redirect({ to: "/admin" });
      return { portalRole: role, staffTabs: [], staffUsername: null };
    }

    // Staff: block every admin route that is not in their permission list.
    if (role === "staff" && location.pathname !== "/admin") {
      const allowed = allowedStaffPaths(staffTabs);
      const ok = allowed.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));
      if (!ok) throw redirect({ to: "/admin" });
    }

    return { portalRole: role, staffTabs, staffUsername: s.staffUsername ?? null };
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <div className="admin-portal min-w-0"><Outlet /></div>;
}
