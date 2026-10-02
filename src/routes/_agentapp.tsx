import { createFileRoute, Outlet, useNavigate, redirect, useLocation, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IdleSessionGuard } from "@/components/IdleSessionGuard";
import { AgentTopBar } from "@/components/AgentTopBar";
import { AgentLoadNotice, describeAgentLoadFailure } from "@/components/AgentLoadNotice";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const { data: stickyNote, refetch: refetchStickyNote } = useQuery({
    queryKey: ["sticky-note"],
    queryFn: async () => {
      const result = await getStickyNote();
      return result;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    (async () => {
      const { data: sess, error: sessErr } = await supabase.auth.getSession();
      if (!sess.session) {
        if (sessErr) setLoadError(describeAgentLoadFailure({ errors: [sessErr.message] }));
        return navigate({ to: "/agent/login" });
      }
      const uid = sess.session.user.id;
      const userEmail = sess.session.user.email;
      const readErrors: (string | undefined)[] = [];
      const [{ data: a, error: agentErr }, { data: roles, error: rolesErr }] = await Promise.all([
        supabase.from("agents").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin"),
      ]);
      readErrors.push(agentErr?.message, rolesErr?.message);
      
      let finalAgent = a as AgentRow | null;
      let finalIsAdmin = (roles ?? []).length > 0;

      // Email fallback for agent record
      if (!finalAgent && userEmail) {
        const { data: agentByEmail, error: emailErr } = await supabase
          .from("agents")
          .select("*")
          .eq("email", userEmail)
          .maybeSingle();
        if (emailErr) readErrors.push(emailErr.message);
        if (agentByEmail) {
          finalAgent = agentByEmail as AgentRow;
        }
      }

      // Special hardcoded check for master admin email
      if (userEmail === 'rohitravelsryk@gmail.com' || userEmail === 'arsiteslogin@gmail.com') {
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
      // Without this the portal opens with a blank agency name and no records,
      // which reads as "my account was deleted" rather than "the read failed".
      setLoadError(describeAgentLoadFailure({ errors: readErrors }));
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
  }, [navigate, refetchStickyNote, reloadKey]);

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
      <div className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 animate-premium-fade">
        <div className="max-w-md rounded-2xl border border-border/70 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-3xl">⏳</div>
          <h1 className="text-xl font-semibold text-foreground">Awaiting Admin Approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thanks for registering <b>{agent.agency_name}</b>. Your account is pending approval. You'll be able to sign in and access the portal once an admin approves your agency.
          </p>
          <button onClick={signOut} className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90">Sign out</button>
        </div>
      </div>
    );
  }

  const isFaresPage = location.pathname === "/agent/fares";
  const isDashboardPage = location.pathname === "/agent/dashboard";

  return (
    <div className="agent-portal min-h-screen bg-background animate-premium-fade">
      <AgentTopBar
        agencyName={agent?.agency_name ?? null}
        contactPerson={agent?.contact_person ?? null}
        onSignOut={signOut}
      />

      <main className="min-w-0">
        <div className="mx-auto max-w-[1400px] px-3 md:px-5 py-4">
          {/* Sticky Notes moved to dedicated tab */}
          {loadError && (
            <AgentLoadNotice
              message={loadError}
              onRetry={() => {
                setLoading(true);
                setReloadKey((k) => k + 1);
              }}
            />
          )}
          <Outlet />
        </div>
      </main>

      {/* IdleSessionGuard removed to ensure agent portal stays logged in */}
    </div>
  );
}
