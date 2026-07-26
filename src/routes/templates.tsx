import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { ArrowLeft, MessageCircle, Copy as CopyIcon, Check, Plane, Sparkles, Download, Phone } from "lucide-react";
import { listFares, type Fare } from "@/lib/fares.functions";
import rohiLogo from "@/assets/rohi-logo.png.asset.json";
import rohiLogoWide from "@/assets/rohi-logo-wide.png.asset.json";
import { AirlineLogo, urduName, destinationImage, DESTINATION_FALLBACK } from "@/routes/index";

const faresQuery = queryOptions({
  queryKey: ["fares"],
  queryFn: () => listFares(),
});

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Fare Templates — Rohi International Travels" },
      { name: "description", content: "Shareable group fare poster templates — Pakistan to Gulf and beyond. Copy, download, or send on WhatsApp." },
      { property: "og:title", content: "Fare Templates — Rohi International Travels" },
      { property: "og:description", content: "Ready-to-share group fare posters with route, airline, schedule and price. One-click WhatsApp sharing." },
      { property: "og:url", content: "https://rohitravels.lovable.app/templates" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.lovable.app/templates" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(faresQuery),
  component: TemplatesPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">Failed to load: {error.message}</div>
  ),
});

const AGENCY_NAME = "ROHI INTERNATIONAL TRAVELS";
const AGENCY_PHONE = "0305 6622988";
const WA_PHONE = "923056622988";
const WA_GROUP_URL = "https://chat.whatsapp.com/K295wuWsea1I5TP026UGqA";

function openWhatsApp(text?: string, target?: Window | null) {
  const encoded = text ? `?text=${encodeURIComponent(text)}` : "";
  const url = `https://wa.me/${encoded}`;
  if (target && !target.closed) {
    target.opener = null;
    target.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function openBlankTab(): Window | null {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  return tab;
}

function countryBadge(city: string): string {
  const c = city.trim().toUpperCase();
  const pk = ["PK", "KHI", "LHE", "ISB", "PEW", "MUX", "LYP", "SKT", "UET", "KARACHI","LAHORE","ISLAMABAD","PESHAWAR","MULTAN","FAISALABAD","SIALKOT","QUETTA"];
  const sa = ["SA", "JED", "RUH", "DMM", "MED", "ELQ", "RIYADH","JEDDAH","DAMMAM","MEDINA","MADINAH","MAKKAH","GASSIM"];
  const ae = ["AE", "DXB", "AUH", "SHJ", "DUBAI","ABU DHABI","ABUDHABI","SHARJAH"];
  if (pk.includes(c)) return "PK";
  if (sa.includes(c)) return "SA";
  if (ae.includes(c)) return "AE";
  if (["QA", "DOH", "DOHA"].includes(c)) return "QA";
  if (["KW", "KWI", "KUWAIT"].includes(c)) return "KW";
  if (["OM", "MCT", "MUSCAT"].includes(c)) return "OM";
  if (["BH", "BAH", "BAHRAIN"].includes(c)) return "BH";
  if (["TR", "IST", "SAW", "ISTANBUL"].includes(c)) return "TR";
  return "";
}

function whatsappText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/🇵🇰/g, "[PK]")
    .replace(/🇸🇦/g, "[SA]")
    .replace(/🇦🇪/g, "[AE]")
    .replace(/🇶🇦/g, "[QA]")
    .replace(/🇰🇼/g, "[KW]")
    .replace(/🇴🇲/g, "[OM]")
    .replace(/🇧🇭/g, "[BH]")
    .replace(/🇹🇷/g, "[TR]")
    .replace(/✈️|✈/g, "[FLIGHT]")
    .replace(/\uFE0E|\uFE0F/g, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "")
    .replace(/�/g, "");
}

function fmtDate(d: string) {
  return (d || "").replace(/^(\d{1,2})([A-Za-z]{3})$/, "$1 $2").toUpperCase();
}
function flightLinesFor(f: Fare): string[] {
  if (f.flight_details && f.flight_details.trim()) {
    return f.flight_details.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }
  const one = [fmtDate(f.flight_date), f.origin_code?.toUpperCase(), f.destination_code?.toUpperCase(), f.depart_time, f.arrive_time]
    .filter(Boolean)
    .join(" ");
  return one ? [one] : [];
}
function buildShareText(f: Fare): string {
  // Must match admin panel's Broadcast Marketing text exactly.
  const badge = countryBadge(f.destination) || countryBadge(f.origin);
  const line1 = `*${badge ? `[${badge}] ` : ""}${f.origin} ${f.destination} ${f.airline.toUpperCase()}*`;
  const details = (f.flight_details && f.flight_details.trim())
    ? f.flight_details.trim()
    : flightLinesFor(f).join("\n");
  const line3 = `*${(f.baggage ?? "").replace(/KG$/i, " KG").trim()}*`;
  const community = [line1, details, line3].filter(Boolean).join("\n");
  const BRAND_FOOTER = `*${AGENCY_NAME} RYK*\nAbdul Razzaq\n*${AGENCY_PHONE}*`;
  return whatsappText(`${community}\n\n[GROUP] *Join WhatsApp Group:*\n${WA_GROUP_URL}\n\n[LIVE] *Live Group Fares:*\nhttps://rohitravels.lovable.app/\n\n${BRAND_FOOTER}`);
}


function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function TemplatesPage() {
  const { data: fares } = useSuspenseQuery(faresQuery);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1">
              <img src={rohiLogo.url} alt="Rohi" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="font-serif text-lg font-black leading-none">{AGENCY_NAME}</p>
              <p className="text-[10px] tracking-[0.25em] text-white/60">FARE TEMPLATES</p>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white/90 hover:border-gold/60 hover:text-gold"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-black text-navy">
              <Sparkles className="mr-2 inline h-6 w-6 text-gold" />
              Fare Templates
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ready-to-share posters for every live group fare. Copy, download, share, or send on WhatsApp with the poster image attached.
            </p>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            {fares.length} {fares.length === 1 ? "template" : "templates"}
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {fares.map((f) => (
            <PosterCard key={f.id} f={f} />
          ))}
          {fares.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
              No fares yet. Add some from the admin panel.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function PosterCard({ f }: { f: Fare }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | "wa" | "download">(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const shareText = buildShareText(f);
  const img = destinationImage(f.destination);
  const fileName = `rohi-${slugify(f.origin)}-${slugify(f.destination)}-${slugify(f.flight_date || "fare")}.png`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Inline any cross-origin <img> as data URLs so the canvas isn't tainted.
  const inlineImages = async (root: HTMLElement): Promise<() => void> => {
    const imgs = Array.from(root.querySelectorAll("img"));
    const restores: Array<() => void> = [];
    await Promise.all(
      imgs.map(async (el) => {
        const src = el.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        try {
          const res = await fetch(src, { mode: "cors", cache: "no-cache" });
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => reject(r.error);
            r.readAsDataURL(blob);
          });
          const original = el.src;
          el.setAttribute("src", dataUrl);
          restores.push(() => el.setAttribute("src", original));
        } catch (e) {
          console.warn("inline image failed", src, e);
        }
      }),
    );
    return () => restores.forEach((r) => r());
  };

  const capture = async (): Promise<Blob | null> => {
    if (!posterRef.current) return null;
    const restore = await inlineImages(posterRef.current);
    try {
      return await toBlob(posterRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
    } catch (err) {
      console.error("capture failed", err);
      return null;
    } finally {
      restore();
    }
  };

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  const escapeHtml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const copyPosterForWhatsApp = async (blob: Blob) => {
    try {
      const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (!CI || !navigator.clipboard || !("write" in navigator.clipboard)) return false;
      const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });

      // Keep the clipboard focused on the poster image only. WhatsApp gets the
      // caption from the wa.me URL; adding text/html here makes some browsers
      // paste only text, or fail the image write completely.
      try {
        await navigator.clipboard.write([new CI({ "image/png": pngBlob })]);
      } catch {
        const dataUrl = await blobToDataUrl(pngBlob);
        const html = `<img src="${dataUrl}" alt="Rohi fare poster">`;
        await navigator.clipboard.write([new CI({ "text/html": new Blob([html], { type: "text/html" }) })]);
      }
      return true;
    } catch (e) {
      console.warn("poster clipboard failed", e);
      return false;
    }
  };

  const copyPosterText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      return true;
    } catch (e) {
      console.warn("caption clipboard failed", e);
      return false;
    }
  };

  const download = async () => {
    setBusy("download");
    try {
      const blob = await capture();
      if (!blob) {
        alert("Could not generate the poster image. Please try again.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setBusy(null);
    }
  };


  const sendWhatsApp = async () => {
    setBusy("wa");
    const whatsappWindow = openBlankTab();
    try {
      const blob = await capture();
      if (!blob) {
        if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close();
        alert("Could not generate the poster image. Please try again.");
        return;
      }
      const pngBlob = blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });

      // wa.me reliably prefills the caption; the generated poster is copied as
      // image/png so WhatsApp Web/Desktop can attach it with paste.
      const imageCopied = await copyPosterForWhatsApp(pngBlob);
      if (!imageCopied) {
        await copyPosterText();
      }
      openWhatsApp(shareText, whatsappWindow);
      alert(imageCopied
        ? "WhatsApp opened with the caption. Press Ctrl+V (⌘+V on Mac) in the chat box to paste the poster image if it is not already attached."
        : "WhatsApp opened with the caption. Your browser blocked image sharing, so use Save if you need the poster file."
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-hero)]">
      {/* CAPTURE AREA — everything inside this ref becomes the shared image */}
      <div ref={posterRef} className="flex flex-1 flex-col bg-card">
        <div className="flex flex-col items-center gap-2 px-5 pt-5 text-center">
          <AirlineLogo name={f.airline} height={28} />
          <h3 className="font-serif text-lg font-black tracking-tight text-navy">
            {f.origin.toUpperCase()} <span className="text-gold">—</span> {f.destination.toUpperCase()}
          </h3>
          <span className="rounded-full bg-gold px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold-foreground">
            {f.origin_code} · {f.destination_code}
          </span>
          <p dir="rtl" lang="ur" className="font-urdu text-2xl leading-tight text-navy">
            {urduName(f.origin)} {urduName(f.destination)}
          </p>
        </div>

        <div className="relative mt-3 h-56 w-full overflow-hidden bg-navy">
          <img
            src={img}
            alt={f.destination}
            loading="lazy"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            onError={(e) => {
              const t = e.currentTarget;
              if (t.src !== DESTINATION_FALLBACK) t.src = DESTINATION_FALLBACK;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/25 to-transparent" />
          <div className="absolute bottom-2 left-3 text-[11px] font-bold uppercase tracking-[0.3em] text-white">
            {f.destination}
          </div>
        </div>

        <div className="space-y-2 px-5 py-4">
          <div className="space-y-1 font-mono text-[11px] font-semibold text-navy">
            {flightLinesFor(f).map((line, i) => {
              const parts = line.split(/\s+/);
              const first = parts[0] ?? "";
              const rest = parts.slice(1).join(" ");
              const isDate = /^\d{1,2}[A-Z]{3}$/i.test(first);
              return (
                <p key={i}>
                  {isDate ? (
                    <>
                      <span className="rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy">
                        {fmtDate(first)}
                      </span>
                      <span className="ml-2">{rest}</span>
                    </>
                  ) : (
                    <span>{line}</span>
                  )}
                </p>
              );
            })}
          </div>

          {f.baggage && (
            <p className="text-[11px] text-muted-foreground">
              Luggage: <span className="font-bold text-navy">{f.baggage}</span>
            </p>
          )}
          <div className="flex items-baseline justify-between border-t border-dashed border-border pt-3">
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground">GROUP FARE</span>
            <span className="font-serif text-lg font-black text-navy">{f.price_text}</span>
          </div>
        </div>

        {/* Agency branding footer — part of the captured image */}
        <div
          className="mt-auto flex items-center justify-between gap-3 border-t-2 border-gold px-4 py-4 text-white"
          style={{ background: "linear-gradient(90deg, #0a1f44 0%, #0a1f44 55%, #16a34a 100%)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img src={rohiLogo.url} alt="Rohi" className="h-16 w-16 shrink-0 object-contain" crossOrigin="anonymous" />
            <div className="leading-none">
              <p className="font-serif text-2xl font-black tracking-wide text-gold">ROHI</p>
              <p className="mt-0.5 font-serif text-[10px] font-bold tracking-[0.22em] text-white">INTERNATIONAL TRAVELS</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gold px-3 py-1.5 text-[12px] font-black leading-none text-navy">
            <Phone className="h-3.5 w-3.5" />
            {AGENCY_PHONE}
          </div>
        </div>


      </div>

      {/* ACTIONS — not captured */}
      <div className="grid grid-cols-[1fr_1fr_2fr] border-t border-border">
        <button
          onClick={onCopy}
          className="inline-flex items-center justify-center gap-1.5 py-3 text-[11px] font-bold uppercase tracking-wide text-navy transition hover:bg-secondary"
          title="Copy caption"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <CopyIcon className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={download}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 border-l border-border py-3 text-[11px] font-bold uppercase tracking-wide text-navy transition hover:bg-secondary disabled:opacity-60"
          title="Download poster image"
        >
          <Download className="h-3.5 w-3.5" />
          {busy === "download" ? "…" : "Save"}
        </button>
        <button
          onClick={sendWhatsApp}
          disabled={busy !== null}
          className="relative -ml-3 inline-flex items-center justify-center gap-1.5 whitespace-nowrap bg-whatsapp py-3 pl-5 pr-3 text-[11px] font-bold uppercase tracking-wide text-whatsapp-foreground transition hover:brightness-95 disabled:opacity-60"
          style={{ clipPath: "polygon(12px 0, 100% 0, 100% 100%, 0 100%)" }}
          title="Send poster + caption on WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {busy === "wa" ? "Preparing…" : "Share on WhatsApp"}
        </button>

      </div>

    </article>
  );
}
