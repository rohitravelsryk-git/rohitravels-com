import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { submitQuery } from "@/lib/queries.functions";
import {
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Send,
  CheckCircle2,
  Facebook,
  Instagram,
  Users,
  Radio,
} from "lucide-react";

const PHONE_DISPLAY = "0305 6622988";
const PHONE_TEL = "+923056622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;
const LANDLINE_DISPLAY = "068 5871647";
const LANDLINE_TEL = "+92685871647";

export const Route = createFileRoute("/contact-us")({
  head: () => ({
    meta: [
      { title: "Contact Us — Rohi International Travels" },
      {
        name: "description",
        content:
          "Get in touch with Rohi International Travels — call, WhatsApp, email or visit us in Rahim Yar Khan. We reply fast, every day.",
      },
      { property: "og:title", content: "Contact Us — Rohi International Travels" },
      {
        property: "og:description",
        content: "Reach Rohi International Travels by phone, WhatsApp, email or in person.",
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

function ContactUsPage() {
  const submit = useServerFn(submitQuery);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      alert("Please fill in name, phone and message.");
      return;
    }
    setBusy(true);
    try {
      const res = await submit({
        data: {
          user_type: "customer",
          name,
          phone,
          email: "",
          service: "General Inquiry",
          message,
          attachments: [],
        },
      });
      const qNum = res.seq ? String(res.seq).padStart(2, "0") : "—";

      const adminMsg =
        `NEW CONTACT MESSAGE : ${qNum}\n\n` +
        `ROHI INTERNATIONAL TRAVELS\n\n` +
        `Name: ${name}\n\n` +
        `WhatsApp: ${phone}\n\n` +
        `Message:\n\n${message}`;
      window.open(`https://wa.me/${WA_PHONE}?text=${encodeURIComponent(adminMsg)}`, "_blank", "noopener,noreferrer");

      const customerWa = toWaNumber(phone);
      if (customerWa.length >= 10) {
        const customerMsg =
          `Welcome to ROHI INTERNATIONAL TRAVELS\n\n` +
          `Reference # ${qNum}\n\n` +
          `Dear ${name},\n\n` +
          `Thanks for reaching out.\n\n` +
          `Message:\n${message}\n\n` +
          `Replying you soon. Please wait…`;
        setTimeout(
          () => window.open(`https://wa.me/${customerWa}?text=${encodeURIComponent(customerMsg)}`, "_blank", "noopener,noreferrer"),
          400,
        );
      }

      setDone(true);
      setName("");
      setPhone("");
      setMessage("");
    } catch (err: any) {
      alert(err.message ?? "Failed to send. Please try again.");
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
            Questions about fares, visas, Umrah packages or anything else? Call, WhatsApp, email
            or drop by — we're here every day.
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

          {/* Contact form */}
          <div className="lg:col-span-3">
            <h2 className="font-sans text-xl font-black text-navy">Send us a message</h2>
            <p className="mt-1 text-sm text-navy/60">We'll reply on WhatsApp as soon as possible.</p>

            {done && (
              <div className="mt-5 flex items-start gap-3 rounded-lg border border-success/40 bg-success-soft p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                <div className="text-sm">
                  <p className="font-bold text-success">Message sent!</p>
                  <p className="text-success">Thanks for contacting ROHI INTERNATIONAL TRAVELS.</p>
                </div>
              </div>
            )}

            <form
              onSubmit={onSubmit}
              className="mt-5 space-y-5 rounded-xl border border-border bg-white p-6 shadow-sm"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name *" value={name} onChange={setName} placeholder="Your name" />
                <Field label="Phone / WhatsApp *" value={phone} onChange={setPhone} placeholder="+92 300 1234567" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-navy/70">
                  Your Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="How can we help you?"
                  dir="ltr"
                  className="w-full resize-none rounded-md border border-border bg-white px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-navy px-4 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-gold hover:text-navy disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send Message"}
              </button>
            </form>

            <p className="mt-6 text-sm text-navy/60">
              Looking for a fare quote instead?{" "}
              <Link to="/inquiry" className="font-semibold text-gold hover:underline">
                Send an inquiry
              </Link>
              .
            </p>
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
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
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
        className="w-full rounded-md border border-border bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
      />
    </div>
  );
}
