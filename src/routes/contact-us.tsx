import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { submitQuery } from "@/lib/queries.functions";
import { listServices } from "@/lib/fares.functions";
import {
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Send,
  CheckCircle2,
  AlertCircle,
  Facebook,
  Instagram,
  Users,
  Radio,
  Paperclip,
  X,
} from "lucide-react";

const PHONE_DISPLAY = "0305 6622988";
const PHONE_TEL = "+923056622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;
const LANDLINE_DISPLAY = "068 5871647";
const LANDLINE_TEL = "+92685871647";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

const contactSearchSchema = z.object({ service: z.string().optional() });

export const Route = createFileRoute("/contact-us")({
  validateSearch: contactSearchSchema,
  head: () => ({
    meta: [
      { title: "Contact Us — Rohi International Travels" },
      {
        name: "description",
        content:
          "Get in touch with Rohi International Travels — call, WhatsApp, email or visit us in Rahim Yar Khan. Send a query and we reply fast, every day.",
      },
      { property: "og:title", content: "Contact Us — Rohi International Travels" },
      {
        property: "og:description",
        content: "Reach Rohi International Travels by phone, WhatsApp, email or in person — or send a query directly.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rohitravels.com/contact-us" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/contact-us" }],
  }),
  component: ContactUsPage,
});

function toWaNumber(phone: string) {
  const raw = phone.replace(/[^\d]/g, "");
  if (raw.startsWith("92")) return raw;
  if (raw.startsWith("0")) return "92" + raw.slice(1);
  return raw;
}

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

function ContactUsPage() {
  const submit = useServerFn(submitQuery);
  const { service: preselected } = Route.useSearch();
  const { data: services, isError: servicesFailed } = useQuery({ queryKey: ["services"], queryFn: () => listServices() });
  // An unreadable service list must not leave the enquiry form with no options at
  // all — customers would be unable to send a query.
  const serviceOptions = services?.length ? services : [{ id: "general", label: "General enquiry", sort_order: 0 }];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState(preselected ?? "");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; message?: string }>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [userSelectedService, setUserSelectedService] = useState(false);

  useEffect(() => {
    if (preselected) {
      setService(preselected);
      setUserSelectedService(true);
      return;
    }
    if (userSelectedService) return;
    if (services?.length) {
      // Keep the sent value equal to what the dropdown shows.
      if (!services.some((s) => s.label === service)) setService(services[0].label);
    } else if (servicesFailed && !service) {
      setService(serviceOptions[0].label);
    }
  }, [service, preselected, services, servicesFailed, serviceOptions, userSelectedService]);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const merged = [...files];
    let err: string | null = null;
    for (const f of incoming) {
      if (merged.length >= 2) { err = "You can upload up to 2 files."; break; }
      if (!ALLOWED_TYPES.includes(f.type)) { err = `${f.name}: only JPG, PNG or PDF are allowed.`; continue; }
      if (f.size > MAX_BYTES) { err = `${f.name}: exceeds 8 MB.`; continue; }
      merged.push(f);
    }
    setFileError(err);
    setFiles(merged);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: { name?: string; phone?: string; message?: string } = {};
    if (!name.trim()) nextErrors.name = "Please fill in your name.";
    if (!phone.trim()) nextErrors.phone = "Please fill in your phone / WhatsApp number.";
    if (!message.trim()) nextErrors.message = "Please fill in your message.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitError(null);
    setBusy(true);
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({ name: f.name, mime: f.type as "image/jpeg" | "image/png" | "application/pdf", base64: await fileToBase64(f) })),
      );
      const res = await submit({
        data: {
          user_type: "customer",
          name,
          phone,
          email: "",
          service: service || "General Inquiry",
          message,
          attachments,
        },
      });
      const qNum = res.seq ? String(res.seq).padStart(2, "0") : "—";

      const adminMsg =
        `NEW INQUIRY : ${qNum}\n\n` +
        `ROHI INTERNATIONAL TRAVELS\n\n` +
        `Passenger Name: ${name}\n\n` +
        `WhatsApp: ${phone}\n\n` +
        `Service: ${service || "General Inquiry"}\n\n` +
        `Message:\n\n${message}` +
        (attachments.length ? `\n\nAttachments: ${attachments.length} file(s) uploaded` : "");
      window.open(`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(adminMsg)}`, "_blank", "noopener,noreferrer");

      const customerWa = toWaNumber(phone);
      if (customerWa.length >= 10) {
        const customerMsg =
          `Welcome to ROHI INTERNATIONAL TRAVELS\n\n` +
          `Inquiry # ${qNum}\n\n` +
          `Dear ${name},\n\n` +
          `Thanks for contacting us.\n\n` +
          `Service: ${service || "General Inquiry"}\n\n` +
          `Message:\n${message}\n\n` +
          `Replying you soon. Please wait…`;
        setTimeout(
          () => window.open(`https://wa.me/${customerWa}?text=${encodeURIComponent(customerMsg)}`, "_blank", "noopener,noreferrer"),
          400,
        );
      }

      setDone(true);
      setName(""); setPhone(""); setMessage(""); setFiles([]);
    } catch (err: any) {
      setSubmitError(err.message ?? "Failed to send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-navy animate-premium-fade">
      {/* Hero */}
      <section className="bg-navy text-white mt-[-1px]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-center gap-3 text-gold">
            <MessageCircle className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Get In Touch</span>
          </div>
          <h1 className="mt-3 font-sans text-4xl font-black md:text-5xl">Contact Us</h1>
          <p className="mt-3 max-w-2xl text-white/80">
            Questions about fares, visas, Umrah packages or anything else? Call, WhatsApp, email,
            drop by, or send a query below — we reply fast, every day.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Contact details */}
          <div className="lg:col-span-2">
            <h2 className="font-sans text-xl font-black text-navy">Reach us directly</h2>
            <div className="mt-5 space-y-3">
              <ContactCard
                icon={<MessageCircle className="h-4 w-4" />}
                label="WhatsApp"
                value={PHONE_DISPLAY}
                href={WA_LINK}
                external
              />
              <ContactCard
                icon={<Phone className="h-4 w-4" />}
                label="Call us"
                value={PHONE_DISPLAY}
                href={`tel:${PHONE_TEL}`}
              />
              <ContactCard
                icon={<Phone className="h-4 w-4" />}
                label="Landline"
                value={LANDLINE_DISPLAY}
                href={`tel:${LANDLINE_TEL}`}
              />
              <ContactCard
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                value="rohitravels@gmail.com"
                href="mailto:rohitravels@gmail.com"
              />
              <ContactCard
                icon={<MapPin className="h-4 w-4" />}
                label="Visit us"
                value="Rahim Yar Khan, Pakistan"
                href="https://www.google.com/maps/place/Rohi+International+Travels/@28.4225455,70.3078476,17z"
                external
              />
            </div>

            <div className="mt-6 flex items-center gap-2">
              <a href="https://www.facebook.com/rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold hover:text-navy">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/rohitravels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold hover:text-navy">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://chat.whatsapp.com/K295wuWsea1I5TP026UGqA" target="_blank" rel="noopener noreferrer" aria-label="Join WhatsApp Community" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold hover:text-navy">
                <Users className="h-4 w-4" />
              </a>
              <a href="https://whatsapp.com/channel/0029VaDCohpDuMReHyrIgs1f" target="_blank" rel="noopener noreferrer" aria-label="Follow WhatsApp Channel" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-navy/70 transition hover:border-gold hover:text-navy">
                <Radio className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-6 overflow-hidden rounded-xl border border-border">
              <iframe
                title="Rohi International Travels — Google Maps"
                src="https://www.google.com/maps?q=Rohi+International+Travels,+Rahim+Yar+Khan&output=embed"
                width="100%"
                height="200"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>

          {/* Contact / query form */}
          <div className="lg:col-span-3">
            <h2 className="font-sans text-xl font-black text-navy">Send us a query</h2>
            <p className="mt-1 text-sm text-navy/60">Fill in the form and we'll reply on WhatsApp as soon as possible.</p>

            {done && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-success/40 bg-success-soft p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                <div className="text-sm">
                  <p className="font-bold text-success">Query submitted!</p>
                  <p className="text-success">Thanks for contacting ROHI INTERNATIONAL TRAVELS. Replying you as soon as possible.</p>
                </div>
              </div>
            )}

            {submitError && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-error/40 bg-error-soft p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 text-error" />
                <div className="text-sm">
                  <p className="font-bold text-error">Couldn't send your query</p>
                  <p className="text-error">{submitError}</p>
                </div>
              </div>
            )}

            <form
              onSubmit={onSubmit}
              noValidate
              className="mt-5 space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Full Name *"
                  value={name}
                  onChange={(v) => { setName(v); if (errors.name) setErrors((e) => ({ ...e, name: undefined })); }}
                  placeholder="Your name"
                  error={errors.name}
                />
                <Field
                  label="Phone / WhatsApp *"
                  value={phone}
                  onChange={(v) => { setPhone(v); if (errors.phone) setErrors((e) => ({ ...e, phone: undefined })); }}
                  placeholder="+92 300 1234567"
                  error={errors.phone}
                />
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
                    Service / Product
                  </label>
                  <select
                    value={service}
                    onChange={(e) => { setService(e.target.value); setUserSelectedService(true); }}
                    className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                  >
                    {serviceOptions.map((s) => (
                      <option key={s.id} value={s.label}>{s.label}</option>
                    ))}
                  </select>
                  {servicesFailed && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      The full service list could not be loaded right now. Choose General enquiry and describe
                      what you need — your message still reaches us.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
                  Your Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((er) => ({ ...er, message: undefined })); }}
                  rows={5}
                  placeholder="How can we help you?"
                  dir="ltr"
                  className={`w-full resize-none rounded-md border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold ${errors.message ? "border-error" : "border-border"}`}
                />
                {errors.message && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-error">
                    <AlertCircle className="h-3.5 w-3.5" /> {errors.message}
                  </p>
                )}
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
                {fileError && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-error">
                    <AlertCircle className="h-3.5 w-3.5" /> {fileError}
                  </p>
                )}
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
                <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send Query"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

function ContactCard({
  icon, label, value, href, external,
}: {
  icon: React.ReactNode; label: string; value: string; href: string; external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-navy">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-widest text-navy/50">{label}</span>
        <span className="block truncate text-sm font-semibold text-navy">{value}</span>
      </span>
    </a>
  );
}

function Field({
  label, value, onChange, placeholder, error,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir="ltr"
        className={`w-full rounded-md border bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-gold ${error ? "border-error" : "border-border"}`}
      />
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-error">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
