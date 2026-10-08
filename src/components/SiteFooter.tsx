import { useRouter } from "@tanstack/react-router";
import { ArrowUp, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Radio, Star, Users } from "lucide-react";

const PHONE = "0305 6622988";
const PHONE_TEL = "+923056622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;
const WA2_DISPLAY = "0300 9670463";
const WA2_TEL = "+923009670463";
const WA2_LINK = `https://wa.me/${WA2_TEL.replace(/\D/g, "")}`;
const LANDLINE_DISPLAY = "068 5871647";
const LANDLINE_TEL = "+92685871647";

function openWhatsApp(text?: string) {
  const encoded = text ? `?text=${encodeURIComponent(text)}` : "";
  window.open(`${WA_LINK}${encoded}`, "_blank", "noopener,noreferrer");
}

// Same outlined-on-dark style as the Contact/Community icon circles below, so every
// circular icon in the footer reads as one consistent family instead of two.
const iconButton = "flex h-9 w-9 items-center justify-center rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)] text-[var(--rohi-text-muted)] transition-colors hover:border-[var(--rohi-brand)] hover:text-[var(--rohi-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rohi-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--rohi-surface-strong)]";
const linkRow = "flex items-center gap-2.5 text-sm text-[var(--rohi-text-muted)] transition-colors hover:text-[var(--rohi-brand)]";
const colTitle = "text-xs font-semibold uppercase tracking-[0.14em] text-[var(--rohi-text-subtle)]";

export function SiteFooter() {
  const router = useRouter();
  const path = router.state.location.pathname;

  if (path === "/print-format" || path === "/testing" || path.startsWith("/admin") || (path.startsWith("/agent") && path !== "/agent/login" && path !== "/agent/register")) return null;

  return (
    <footer className="print:hidden border-t border-[var(--rohi-border)] bg-[var(--rohi-surface-strong)] text-[var(--rohi-text-inverse)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 md:py-14 lg:grid-cols-4 lg:gap-12 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Rohi International Travels" width={512} height={454} loading="lazy" decoding="async" className="h-11 w-11 shrink-0 object-contain" />
            <p className="text-lg font-semibold leading-tight tracking-tight text-[var(--rohi-text-inverse)] sm:text-xl">Rohi International Travels</p>
          </div>
          <button type="button" onClick={() => openWhatsApp("Hello Rohi International Travels! How can you help me today?")} className="mt-7 flex w-full max-w-xs items-center gap-3 rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)] py-2.5 pl-4 pr-2 text-left text-sm text-[var(--rohi-text-muted)] transition-colors hover:border-[var(--rohi-brand)] hover:text-[var(--rohi-text-inverse)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rohi-brand)]">
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">How can I help you today?</span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--rohi-brand)] text-[var(--rohi-brand-contrast)]"><ArrowUp className="h-4 w-4" /></span>
          </button>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--rohi-text-muted)]">Trusted Travel Partner delivering live group fares One Way Groups like UAE, Oman, Saudia Arabia also Umrah Groups, System Ticketing also available with fast service. After Sales Support, B2B System and Group Fares. Feel free to contact us 24/7.</p>
          <div className="mt-5 flex items-center gap-2">
            <a href="https://www.facebook.com/rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={iconButton}><Facebook className="h-4 w-4" /></a>
            <a href="https://www.instagram.com/rohitravels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={iconButton}><Instagram className="h-4 w-4" /></a>
            <a href="https://www.tiktok.com/@rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={iconButton}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M19.6 6.3a5.6 5.6 0 0 1-3.3-1.1 5.6 5.6 0 0 1-2.2-3.7h-3.3v13.5a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V8.9a6 6 0 0 0-.8-.1 6 6 0 1 0 6 6V8.5a8.9 8.9 0 0 0 5.5 1.9V7.1a5.5 5.5 0 0 1-.0-.8z" /></svg></a>
          </div>
        </div>

        <div>
          <p className={colTitle}>Contact</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2.5 text-sm"><div className="flex items-center overflow-hidden rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)]"><a href={WA_LINK} onClick={(e) => { e.preventDefault(); openWhatsApp(); }} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${PHONE}`} className="flex h-7 w-7 items-center justify-center text-emerald-400 hover:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" /></a><span className="h-4 w-px bg-[var(--rohi-border-strong)]" aria-hidden="true" /><a href={`tel:${PHONE_TEL}`} aria-label={`Call ${PHONE}`} className="flex h-7 w-7 items-center justify-center text-[var(--rohi-text-muted)] hover:text-[var(--rohi-brand)]"><Phone className="h-3.5 w-3.5" /></a></div><span className="font-medium text-[var(--rohi-text-inverse)]">{PHONE}</span></div>
            <div className="flex items-center gap-2.5 text-sm"><div className="flex items-center overflow-hidden rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)]"><a href={WA2_LINK} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${WA2_DISPLAY}`} className="flex h-7 w-7 items-center justify-center text-emerald-400 hover:text-emerald-300"><MessageCircle className="h-3.5 w-3.5" /></a><span className="h-4 w-px bg-[var(--rohi-border-strong)]" aria-hidden="true" /><a href={`tel:${WA2_TEL}`} aria-label={`Call ${WA2_DISPLAY}`} className="flex h-7 w-7 items-center justify-center text-[var(--rohi-text-muted)] hover:text-[var(--rohi-brand)]"><Phone className="h-3.5 w-3.5" /></a></div><span className="font-medium text-[var(--rohi-text-inverse)]">{WA2_DISPLAY}</span></div>
            <div className="flex items-center gap-2.5 text-sm"><a href={`tel:${LANDLINE_TEL}`} aria-label={`Call Landline ${LANDLINE_DISPLAY}`} className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)] text-[var(--rohi-text-muted)] hover:border-[var(--rohi-brand)]"><Phone className="h-3.5 w-3.5" /></a><span className="font-medium text-[var(--rohi-text-inverse)]">Landline {LANDLINE_DISPLAY}</span></div>
            <a href="mailto:rohitravels@gmail.com" className={linkRow}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)]"><Mail className="h-3.5 w-3.5" /></span><span className="font-medium text-[var(--rohi-text-inverse)]">rohitravels@gmail.com</span></a>
          </div>
        </div>

        <div>
          <p className={colTitle}>Community</p>
          <div className="mt-4 space-y-3">
            <a href="https://chat.whatsapp.com/K295wuWsea1I5TP026UGqA" target="_blank" rel="noopener noreferrer" className={linkRow}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)]"><Users className="h-3.5 w-3.5" /></span><span>Join WhatsApp Community</span></a>
            <a href="https://whatsapp.com/channel/0029VaDCohpDuMReHyrIgs1f" target="_blank" rel="noopener noreferrer" className={linkRow}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)]"><Radio className="h-3.5 w-3.5" /></span><span>Follow WhatsApp Channel</span></a>
            <a href="https://g.page/r/CU1NtsPDbGPiEAE/review" target="_blank" rel="noopener noreferrer" className={linkRow}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--rohi-border-strong)] bg-[var(--rohi-surface-stronger)]"><Star className="h-3.5 w-3.5" /></span><span>Leave a Google Review</span></a>
          </div>
        </div>

        <div>
          <p className={colTitle}>Find us</p>
          <div className="mt-4 overflow-hidden rounded-[var(--rohi-radius-md)] border border-[var(--rohi-border-strong)]"><iframe title="Rohi International Travels — Google Maps" src="https://www.google.com/maps?q=Rohi+International+Travels,+Rahim+Yar+Khan&output=embed" width="100%" height="180" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /></div>
          <a href="https://www.google.com/maps/place/Rohi+International+Travels/@28.4225455,70.3078476,17z" target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 text-sm text-[var(--rohi-text-muted)] transition-colors hover:text-[var(--rohi-brand)]"><MapPin className="h-3.5 w-3.5" /> Open in Google Maps</a>
        </div>
      </div>
      <div className="border-t border-[var(--rohi-border-strong)]"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-[var(--rohi-text-subtle)] sm:flex-row sm:px-6 lg:px-8"><p>© {new Date().getFullYear()} Rohi International Travels</p><p>All rights reserved.</p></div></div>
    </footer>
  );
}
