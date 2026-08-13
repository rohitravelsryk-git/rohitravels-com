import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plane, LogOut, Ticket, Stamp, Megaphone, Sparkles, Trash2, ExternalLink } from "lucide-react";
import {
  adminLogout,
  getAnnouncement,
  setAnnouncement,
  getAnnouncementHistory,
  deleteAnnouncementHistoryItem,
} from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";

export const Route = createFileRoute("/admin/latest-updates")({
  head: () => ({ meta: [{ title: "Latest Updates — Rohi Admin" }] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["site-settings", "announcement"],
      queryFn: () => getAnnouncement(),
    });
  },
  component: AdminAnnouncementPage,
});

function AdminAnnouncementPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const logout = useServerFn(adminLogout);
  const { data: annData } = useQuery({
    queryKey: ["site-settings", "announcement"],
    queryFn: () => getAnnouncement(),
  });
  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["site-settings", "announcement-history"],
    queryFn: () => getAnnouncementHistory(),
  });
  const saveAnn = useServerFn(setAnnouncement);
  const deleteItem = useServerFn(deleteAnnouncementHistoryItem);

  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (annData) {
      setEnabled(!!annData.enabled);
      setText(annData.text ?? "");
      setImageUrl(annData.imageUrl ?? "");
      setLinkUrl(annData.linkUrl ?? "");
    }
  }, [annData]);

  function onFilePicked(file: File | null) {
    if (!file) return;
    if (file.size > 800 * 1024) {
      setMsg("Image too large. Please choose an image under 800 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageUrl(typeof reader.result === "string" ? reader.result : "");
      setPreviewKey(new Date().toISOString());
      setMsg(null);
    };
    reader.readAsDataURL(file);
  }

  async function save(nextEnabled?: boolean) {
    setSaving(true); setMsg(null);
    try {
      await saveAnn({
        data: {
          enabled: typeof nextEnabled === "boolean" ? nextEnabled : enabled,
          text: text.trim(),
          imageUrl: imageUrl.trim(),
          linkUrl: linkUrl.trim(),
        },
      });
      if (typeof nextEnabled === "boolean") setEnabled(nextEnabled);
      await qc.invalidateQueries({ queryKey: ["site-settings", "announcement"] });
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

  const tabClass = (active = false) =>
    active
      ? "rounded-t-md border-b-2 border-gold bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold"
      : "rounded-t-md border-b-2 border-transparent px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Latest Updates studio</p>
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

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-amber-500 text-navy shadow">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-black text-navy">Latest Updates</h1>
            <p className="text-xs text-muted-foreground">Manage recent post notifications that appear as a WhatsApp-style popup for agents and on the public Updates page.</p>
          </div>
        </div>


        <div className="rounded-2xl border border-navy/15 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy">
              <span className={`inline-block h-2 w-2 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
              {enabled ? "Live on homepage & agent portal" : "Hidden from homepage & agent portal"}
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
                aria-label="Toggle announcement"
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? "translate-x-5" : "translate-x-1"}`} />
              </button>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-navy/70">Post Caption / Text</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="e.g. Umrah Group departing 15-Aug from LHE — Limited seats!"
                className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-navy/70">Upload Image (optional, max 800 KB)</span>
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
                      onClick={() => { setImageUrl(""); setPreviewKey(new Date().toISOString()); }}
                      className="rounded-md border border-navy/20 px-2 py-1 text-[11px] font-semibold text-navy hover:bg-secondary"
                    >
                      Remove image
                    </button>
                  </>
                )}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Shown inside the WhatsApp-style notification and the Latest Updates feed.
              </p>
            </label>
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-navy/20 bg-secondary/40 p-4 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-navy/60">
              <Sparkles className="h-3 w-3" /> Live Preview
            </div>
            The notification is showing in the top-right corner of this page right now. It auto-shows on the homepage and agent portal whenever you save a new update.
            <AnnouncementToast
              key={previewKey}
              enabled
              text={text}
              imageUrl={imageUrl}
              updatedAt={previewKey}
              autoShowMs={999999}
              scope={`preview-${previewKey}`}
              title="Latest Updates"
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => save()}
              disabled={saving}
              className="rounded-md bg-navy px-5 py-2.5 text-xs font-bold text-navy-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Post"}
            </button>
            {msg && <span className="text-xs font-semibold text-navy">{msg}</span>}
          </div>
        </div>

        {/* History Management */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-black text-navy">Update History</h2>
            <Link
              to="/updates"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gold hover:underline"
            >
              View Public Page <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {history && history.length > 0 ? (
              history.map((item, i) => (
                <div key={item.updatedAt || i} className="group flex items-center gap-4 rounded-xl border border-navy/10 bg-white p-3 transition hover:shadow-md">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-navy/5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-navy">{item.text || "(Media only)"}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(item.updatedAt).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this update from history?")) return;
                      await deleteItem({ data: { updatedAt: item.updatedAt } });
                      refetchHistory();
                    }}
                    className="rounded-lg p-2 text-navy/30 hover:bg-red-50 hover:text-red-500"
                    title="Delete Update"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-navy/20 py-8 text-center text-xs text-muted-foreground">
                No updates in history yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Reuse the toast for the admin live preview
import { AnnouncementToast } from "@/components/AnnouncementToast";
import { AdminTabs } from "@/components/AdminTabs";
