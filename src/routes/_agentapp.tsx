import { createFileRoute, Outlet, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IdleSessionGuard } from "@/components/IdleSessionGuard";
import { AgentTopBar } from "@/components/AgentTopBar";
import { useQuery } from "@tanstack/react-query";
import { getStickyNote } from "@/lib/sticky-notes.functions";
import { Info } from "lucide-react";

type AgentRow = {
  user_id: string;
  agency_name: string;
  contact_person: string;
  email: string;
  city: string;
  cell_number: string;
  country_code: string;
  status: "pending" | "approved" | "rejected";
};

export const Route = createFileRoute("/_agentapp")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/agent/login" });
  },
  component: AgentLayout,
});

function AgentLayout() {
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const { data: stickyNote, refetch: refetchStickyNote } = useQuery({
    queryKey: ["sticky-note"],
    queryFn: () => getStickyNote(),
    refetchInterval: 5000, // Frequent polling for "real-time" updates
  });

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return navigate({ to: "/agent/login" });
      const uid = sess.session.user.id;
      const [{ data: a }, { data: roles }] = await Promise.all([
        supabase.from("agents").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin"),
      ]);
      setAgent(a as AgentRow | null);
      setIsAdmin((roles ?? []).length > 0);
      setLoading(false);
    })();

    // Listen for real-time changes to the sticky note table
    const channel = supabase
      .channel("sticky-note-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "b2b_sticky_notes" },
        () => {
          refetchStickyNote();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate, refetchStickyNote]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/agent/login" });
  }

  if (loading) {
    return null;
  }

  if (agent && agent.status !== "approved" && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
        <div className="max-w-md rounded-lg border bg-white p-8 text-center shadow">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">⏳</div>
          <h1 className="text-xl font-bold text-gray-800">Awaiting Admin Approval</h1>
          <p className="mt-2 text-sm text-gray-600">
            Thanks for registering <b>{agent.agency_name}</b>. Your account is pending approval. You'll be able to sign in and access the portal once an admin approves your agency.
          </p>
          <button onClick={signOut} className="mt-6 rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AgentTopBar
        agencyName={agent?.agency_name ?? null}
        contactPerson={agent?.contact_person ?? null}
        onSignOut={signOut}
      />

      <main className="min-w-0">
        <div className="mx-auto max-w-[1400px] px-3 md:px-5 py-4">
          {/* The Sticky Note display has been moved to a dedicated dashboard or specific pages to prevent overlap during navigation. */}
          <Outlet />
        </div>
      </main>



      <IdleSessionGuard portalName="Agent B2B Portal" onLogout={signOut} />

      {/* Latest Updates notification is mounted globally in __root via <GlobalAnnouncement /> */}
    </div>
  );
}
