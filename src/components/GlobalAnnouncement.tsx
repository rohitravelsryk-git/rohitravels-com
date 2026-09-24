import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { getAnnouncement } from "@/lib/fares.functions";
import { AnnouncementToast } from "@/components/AnnouncementToast";
import { supabase } from "@/integrations/supabase/client";

/**
 * Latest Updates notification.
 * Shown to website visitors and to signed-in B2B agents only — never inside the
 * admin panel (admin publishes the announcement, so it should not be notified).
 */
export function GlobalAnnouncement() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/print-format");
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["site-settings", "announcement"],
    queryFn: () => getAnnouncement(),
    // The realtime subscription below already pushes changes the moment they
    // happen, so this only needs to load once per visit.
    staleTime: 5 * 60_000,
    enabled: !isAdminArea,
  });

  // Instant push: any change to the Latest Updates post refreshes the
  // notification and the public feed straight away (website + agent portal).
  useEffect(() => {
    if (isAdminArea) return;
    const channel = supabase
      .channel("latest-updates-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings" },
        () => {
          qc.invalidateQueries({ queryKey: ["site-settings", "announcement"] });
          qc.invalidateQueries({ queryKey: ["site-settings", "announcement-history"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdminArea, qc]);

  if (isAdminArea) return null;
  if (!data?.enabled || (!data.text && !data.imageUrl)) return null;
  return (
    <AnnouncementToast
      enabled={data.enabled}
      text={data.text}
      imageUrl={data.imageUrl}
      updatedAt={data.updatedAt}
      scope="site"
      title="Notifications"
    />
  );
}
