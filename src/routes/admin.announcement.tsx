import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plane, LogOut, Ticket, Stamp, Megaphone, Sparkles } from "lucide-react";
import {
  adminLogout,
  getAnnouncement,
  setAnnouncement,
} from "@/lib/fares.functions";
import { AdminHeaderExtras } from "@/components/AdminHeaderExtras";

export const Route = createFileRoute("/admin/announcement")({
  head: () => ({ meta: [{ title: "Flash Announcement — Rohi Admin" }] }),
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
  const saveAnn = useServerFn(setAnnouncement);

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
        <div className="mx-auto flex max-w-[1600px] flex-wrap gap-1 px-4">
          <Link to="/admin" className={tabClass(false)}>
            <Plane className="mr-1.5 inline h-3.5 w-3.5" /> Group Fares
          </Link>
          <Link to="/admin/tickets" className={tabClass(false)}>
            <Ticket className="mr-1.5 inline h-3.5 w-3.5" /> Group Tickets
          </Link>
          <Link to="/admin/group-ticket-format" className={tabClass(false)}>Group Ticket Format</Link>
          <Link to="/admin/vouchers" className={tabClass(false)}>
            <Ticket className="mr-1.5 inline h-3.5 w-3.5" /> Vouchers
          </Link>
          <Link to="/admin/ok-to-board" className={tabClass(false)}>
            <Stamp className="mr-1.5 inline h-3.5 w-3.5" /> OK to Board
          </Link>
          <Link to="/admin/visa-links" className={tabClass(false)}>Visa Links</Link>
          <Link to="/admin/queries" className={tabClass(false)}>Queries</Link>
          <Link to="/admin/announcement" className={tabClass(true)}>
            <Megaphone className="mr-1.5 inline h-3.5 w-3.5" /> Latest Updates
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-amber-500 text-navy shadow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-black text-navy">Latest Updates Notification</h1>
            <p className="text-xs text-muted-foreground">Pushes a WhatsApp-style notification to the homepage and agent B2B portal. Auto-shows for ~8s, then collapses into a "Latest Updates" pill on the right.</p>
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
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-navy/70">Announcement Text</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="e.g. Umrah Group departing 15-Aug from LHE — Limited seats!"
                className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-navy/70">Image URL (optional)</span>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-navy/70">Click-through URL (optional)</span>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md border border-navy/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
              />
            </label>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-navy/60">
              <Sparkles className="h-3 w-3" /> Live Preview
            </div>
            <AnnouncementBanner enabled text={text} imageUrl={imageUrl} linkUrl="" />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => save()}
              disabled={saving}
              className="rounded-md bg-navy px-5 py-2.5 text-xs font-bold text-navy-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Announcement"}
            </button>
            {msg && <span className="text-xs font-semibold text-navy">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Local import to reuse the banner in preview
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
