import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { getAnnouncement } from "@/lib/fares.functions";
import { AnnouncementToast } from "@/components/AnnouncementToast";

/**
 * Latest Updates notification.
 * Shown to website visitors and to signed-in B2B agents only — never inside the
 * admin panel (admin publishes the announcement, so it should not be notified).
 */
export function GlobalAnnouncement() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/print-format");

  const { data } = useQuery({
    queryKey: ["site-settings", "announcement"],
    queryFn: () => getAnnouncement(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: !isAdminArea,
  });
  if (isAdminArea) return null;
  if (!data?.enabled || (!data.text && !data.imageUrl)) return null;
  return (
    <AnnouncementToast
      enabled={data.enabled}
      text={data.text}
      imageUrl={data.imageUrl}
      updatedAt={data.updatedAt}
      scope="site"
      title="Latest Updates"
    />
  );
}
