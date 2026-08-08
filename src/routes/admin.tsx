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
 *
 * The role is resolved in `beforeLoad` — BEFORE any admin page or admin
 * navigation mounts — so a staff user never sees admin-only chrome, not even
 * for a frame. Staff hitting an admin-only URL are redirected to /admin.
 * `ssr: false` keeps the session cookie check on the client only, which avoids
 * a server render of admin chrome for an unresolved role.
 */
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }): Promise<AdminPortalContext> => {
    const s = await checkAdminUnlocked();
    const role: PortalRole = !s.unlocked ? "guest" : s.staffUsername ? "staff" : "admin";
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
  component: () => <Outlet />,
});
