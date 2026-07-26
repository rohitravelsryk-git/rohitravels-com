import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Send, MessageCircle, ShieldCheck, CheckCircle2, Paperclip, X } from "lucide-react";
import { submitQuery } from "@/lib/queries.functions";
import { listServices } from "@/lib/fares.functions";

const ADMIN_WA = "923056622988";

const inquirySearchSchema = z.object({ service: z.string().optional() });

export const Route = createFileRoute("/inquiry")({
  validateSearch: inquirySearchSchema,
  head: () => ({
    meta: [
      { title: "Send an Inquiry — Rohi International Travels" },
      {
        name: "description",
        content:
          "Send your travel inquiry to Rohi International Travels. Reach us instantly on WhatsApp.",
      },
      { property: "og:title", content: "Send an Inquiry — Rohi International Travels" },
      { property: "og:description", content: "Customer inquiry form — reaches WhatsApp instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { rel: "canonical", href: "https://rohitravels.lovable.app/inquiry" },
    ],
  }),
  component: InquiryPage,
});

function toWaNumber(phone: string) {
  const raw = phone.replace(/[^\d]/g, "");
  if (raw.startsWith("92")) return raw;
  if (raw.startsWith("0")) return "92" + raw.slice(1);
  return raw;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function InquiryPage() {
  const submit = useServerFn(submitQuery);
  const { service: preselected } = Route.useSearch();
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: () => listServices() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState(preselected ?? "");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (preselected) { setService(preselected); return; }
    if (!service && services.length) setService(services[0].label);
  }, [services, service, preselected]);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const merged = [...files];
    for (const f of incoming) {
      if (merged.length >= 2) { alert("You can upload up to 2 files."); break; }
      if (!ALLOWED_TYPES.includes(f.type)) { alert(`${f.name}: only JPG, PNG or PDF are allowed.`); continue; }
      if (f.size > MAX_BYTES) { alert(`${f.name}: exceeds 8 MB.`); continue; }
      merged.push(f);
    }
    setFiles(merged);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      alert("Please fill in name, phone and message.");
      return;
    }
    setBusy(true);
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({ name: f.name, mime: f.type as "image/jpeg" | "image/png" | "application/pdf", base64: await fileToBase64(f) })),
      );
      const res = await submit({
        data: { user_type: "customer", name, phone, email: "", service, message, attachments },
      });
      const qNum = res.seq ? String(res.seq).padStart(2, "0") : "—";

      // 1) Admin notification
      const adminMsg =
        `NEW INQUIRY : ${qNum}\n\n` +
        `ROHI INTERNATIONAL TRAVELS\n\n` +
        `Passenger Name: ${name}\n\n` +
        `WhatsApp: ${phone}\n\n` +
        `Service: ${service}\n\n` +
        `Message:\n\n${message}` +
        (attachments.length ? `\n\nAttachments: ${attachments.length} file(s) uploaded` : "");
      const adminUrl = `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(adminMsg)}`;
      window.open(adminUrl, "_blank", "noopener,noreferrer");

      // 2) Auto welcome to customer's own WhatsApp
      const customerWa = toWaNumber(phone);
      if (customerWa.length >= 10) {
        const customerMsg =
          `Welcome to ROHI INTERNATIONAL TRAVELS\n\n` +
          `Inquiry # ${qNum}\n\n` +
          `Dear ${name},\n\n` +
          `Thanks for contacting us.\n\n` +
          `Service: ${service}\n\n` +
          `Message:\n${message}\n\n` +
          `Replying you soon. Please wait…`;
        const customerUrl = `https://wa.me/${customerWa}?text=${encodeURIComponent(customerMsg)}`;
        setTimeout(() => window.open(customerUrl, "_blank", "noopener,noreferrer"), 400);
      }

      setDone(true);
      setName(""); setPhone(""); setMessage(""); setFiles([]);
    } catch (err: any) {
      alert(err.message ?? "Failed to submit. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/30 text-navy">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-sm font-semibold text-navy hover:underline">
            ← Back to fares
          </Link>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Rohi International Travels
          </span>
        </div>
      </header>

      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-center gap-3 text-gold">
            <ShieldCheck className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Send an Inquiry</span>
          </div>
          <h1 className="mt-3 font-serif text-4xl font-black md:text-5xl">
            Tell us what you <span className="text-gold">need</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Fill in the form and we will reply on WhatsApp as soon as possible.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {done && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-green-500/40 bg-green-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            <div className="text-sm">
              <p className="font-bold text-green-800">Inquiry submitted!</p>
              <p className="text-green-700">
                Thanks for contacting ROHI INTERNATIONAL TRAVELS. Reply you as soon as possible.
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Full Name *"
              value={name}
              onChange={setName}
              placeholder="Your name"
            />
            <Field
              label="Phone / WhatsApp *"
              value={phone}
              onChange={setPhone}
              placeholder="+92 300 1234567"
            />
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
                Service / Product
              </label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.label}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
              Your Message / Query *
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="e.g. Karachi to Jeddah, 3 pax, travelling on 15 Aug — need best fare"
              dir="ltr"
              className="w-full resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
              Files Upload <span className="font-normal normal-case tracking-normal text-muted-foreground">(optional — up to 2, JPG / PNG / PDF, max 8 MB each)</span>
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-navy/30 bg-secondary/40 px-3 py-3 text-sm text-navy/70 hover:border-gold hover:text-navy">
              <Paperclip className="h-4 w-4" />
              {files.length >= 2 ? "Maximum 2 files selected" : "Click to attach files"}
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                multiple
                className="hidden"
                disabled={files.length >= 2}
                onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded border border-border bg-white px-3 py-1.5 text-xs">
                    <span className="truncate text-navy">{f.name} <span className="text-muted-foreground">({Math.round(f.size / 1024)} KB)</span></span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-navy/50 hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-gold hover:text-navy disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> {busy ? "Sending…" : "Submit Inquiry"}
          </button>

          <p className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> WhatsApp: +92 305 6622988</span>
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
      />
    </div>
  );
}
