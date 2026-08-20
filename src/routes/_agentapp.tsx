import { createFileRoute, Outlet, useNavigate, redirect, useLocation, Link } from "@tanstack/react-router";
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
  const location = useLocation();
  const [agent, setAgent] = useState<AgentRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const { data: stickyNote, refetch: refetchStickyNote } = useQuery({
    queryKey: ["sticky-note"],
    queryFn: async () => {
      const result = await getStickyNote();
      return result;
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return navigate({ to: "/agent/login" });
      const uid = sess.session.user.id;
      const userEmail = sess.session.user.email;
      const [{ data: a }, { data: roles }] = await Promise.all([
        supabase.from("agents").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin"),
      ]);
      
      let finalAgent = a as AgentRow | null;
      let finalIsAdmin = (roles ?? []).length > 0;

      // Email fallback for agent record
      if (!finalAgent && userEmail) {
        const { data: agentByEmail } = await supabase
          .from("agents")
          .select("*")
          .eq("email", userEmail)
          .maybeSingle();
        if (agentByEmail) {
          finalAgent = agentByEmail as AgentRow;
        }
      }

      // Special hardcoded check for master admin email
      if (userEmail === 'raisabdulrazzaq@gmail.com' || userEmail === 'arsiteslogin@gmail.com') {
        finalIsAdmin = true;
        if (!finalAgent) {
          finalAgent = {
            user_id: uid,
            agency_name: "Rohi International (Admin)",
            contact_person: "Abdul Razzaq",
            email: userEmail,
            city: "Rahim Yar Khan",
            cell_number: "03056622988",
            country_code: "+92",
            status: "approved"
          };
        }
      }

      setAgent(finalAgent);
      setIsAdmin(finalIsAdmin);
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-navy font-bold">
        Loading Portal...
      </div>
    );
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

  const isFaresPage = location.pathname === "/agent/fares";
  const isDashboardPage = location.pathname === "/agent/dashboard";

  return (
    <div className="min-h-screen bg-background">
      <AgentTopBar
        agencyName={agent?.agency_name ?? null}
        contactPerson={agent?.contact_person ?? null}
        onSignOut={signOut}
      />

      <main className="min-w-0">
        <div className="mx-auto max-w-[1400px] px-3 md:px-5 py-4">
          {/* Sticky Notes moved to dedicated tab */}
          <Outlet />
        </div>
      </main>

      {/* IdleSessionGuard removed to ensure agent portal stays logged in */}
    </div>
  );
}
