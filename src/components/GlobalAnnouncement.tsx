import { useQuery } from "@tanstack/react-query";
import { getAnnouncement } from "@/lib/fares.functions";
import { AnnouncementToast } from "@/components/AnnouncementToast";

export function GlobalAnnouncement() {
  const { data } = useQuery({
    queryKey: ["site-settings", "announcement"],
    queryFn: () => getAnnouncement(),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  if (!data?.enabled || (!data.text && !data.imageUrl)) return null;
  return (
    <AnnouncementToast
      enabled={data.enabled}
      text={data.text}
      imageUrl={data.imageUrl}
      updatedAt={data.updatedAt}
      scope="site"
    />
  );
}
