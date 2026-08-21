import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plane, LogOut, Megaphone, Sparkles } from "lucide-react";
import {
  adminLogout,
  getBannerSettings,
  setBannerSettings,
} from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminNotifications } from "@/components/AdminNotifications";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

export const Route = createFileRoute("/admin/announcement-banner")({
  head: () => ({ meta: [{ title: "Announcement Banner — Rohi Admin" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["site-settings", "banner_settings"],
      queryFn: () => getBannerSettings(),
    });
  },
  component: AdminAnnouncementBannerPage,
});

function AdminAnnouncementBannerPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const { data: bannerData } = useQuery({
    queryKey: ["site-settings", "banner_settings"],
    queryFn: () => getBannerSettings(),
  });
  const saveBanner = useServerFn(setBannerSettings);

  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (bannerData) {
      setEnabled(!!bannerData.enabled);
      setText(bannerData.text ?? "");
      setImageUrl(bannerData.imageUrl ?? "");
      setLinkUrl(bannerData.linkUrl ?? "");
    }
  }, [bannerData]);

  function onFilePicked(file: File | null) {
    if (!file) return;
    if (file.size > 800 * 1024) {
      setMsg("Image too large. Please choose an image under 800 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(typeof reader.result === "string" ? reader.result : "");
      setMsg(null);
    };
    reader.readAsDataURL(file);
  }

  async function save(nextEnabled?: boolean) {
    setSaving(true); setMsg(null);
    try {
      await saveBanner({
        data: {
          enabled: typeof nextEnabled === "boolean" ? nextEnabled : enabled,
          text: text.trim(),
          imageUrl: imageUrl.trim(),
          linkUrl: linkUrl.trim(),
        },
      });
      if (typeof nextEnabled === "boolean") setEnabled(nextEnabled);
      await qc.invalidateQueries({ queryKey: ["site-settings", "banner_settings"] });
      setMsg("Saved ✓");
      setTimeout(() => setMsg(null), 1500);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    router.invalidate();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Global Banner Studio</p>
            </div>
          </div>
          <div className="flex gap-2">
            <AdminHeaderExtras />
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">View site</a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs />
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
        {/* AdminNotifications is now globally mounted in __root */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-amber-500 text-navy shadow">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-black text-navy">Announcement Banner</h1>
            <p className="text-xs text-navy/60">Manage the persistent top-of-page announcement strip shown under the site menus.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-navy/15 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy">
              <span className={`inline-block h-2 w-2 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {enabled ? "Live on site" : "Hidden from site"}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-3 py-1.5 ring-1 ring-navy/10">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${enabled ? "text-emerald-700" : "text-muted-foreground"}`}>
                {enabled ? "Visible" : "Hidden"}
              </span>
              <button
                type="button"
                onClick={() => save(!enabled)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${enabled ? "bg-emerald-500" : "bg-gray-300"}`}
                aria-label="Toggle banner"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-navy/70">Banner Text</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                placeholder="e.g. Special Discount: Use code ROHI20 for 20% off!"
                className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-navy/70">Upload Banner Image (optional, max 800 KB)</span>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
                  className="block text-xs file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-2 file:text-xs file:font-bold file:text-navy-foreground hover:file:opacity-90"
                />
                {imageUrl && (
                  <>
                    <img
                      src={imageUrl}
                      alt="preview"
                      className="h-14 w-14 rounded-md object-cover ring-1 ring-navy/15"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="rounded-md border border-navy/20 px-2 py-1 text-[11px] font-semibold text-navy hover:bg-secondary"
                    >
                      Remove image
                    </button>
                  </>
                )}
              </div>
            </label>
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-navy/20 bg-secondary/40 p-0 overflow-hidden text-xs text-navy/60">
            <div className="p-4 pb-0">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-navy/60">
                <Sparkles className="h-3 w-3" /> Live Preview
              </div>
              This is how the banner looks at the top of the homepage:
            </div>
            <div className="mt-4 border-t border-navy/10 bg-background/50 py-8 px-4 flex justify-center">
              <div className="w-full max-w-4xl">
                 <AnnouncementBanner
                  enabled={true}
                  text={text || "Sample Announcement Text"}
                  imageUrl={imageUrl}
                  linkUrl={linkUrl}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => save()}
              disabled={saving}
              className="rounded-md bg-navy px-5 py-2.5 text-xs font-bold text-navy-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Banner"}
            </button>
            {msg && <span className="text-xs font-semibold text-navy">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
