import { useRouter } from "@tanstack/react-router";
import { ArrowUp, Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Radio, Star, Users } from "lucide-react";

const PHONE = "0305 6622988";
const PHONE_TEL = "+923056622988";
const WA_PHONE = "923056622988";
const WA_LINK = `https://wa.me/${WA_PHONE}`;

function openWhatsApp(text?: string) {
  const encoded = text ? `?text=${encodeURIComponent(text)}` : "";
  const url = `${WA_LINK}${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Shared footer shown on every public page (homepage and beyond), so
 * contact info, socials, and the map aren't only reachable from "/".
 * Hidden on admin/agent app routes and the print view, same rule as
 * SiteHeader.
 *
 * Styling follows the Claude.com footer: near-black background, serif
 * wordmark, a rounded "How can I help you today?" prompt box with a
 * terracotta arrow button, muted column headings, and light link rows.
 */
export function SiteFooter() {
  const router = useRouter();
  const path = router.state.location.pathname;

  if (
    path === "/print-format" ||
    path === "/testing" ||
    path.startsWith("/admin") ||
    (path.startsWith("/agent") && path !== "/agent/login" && path !== "/agent/register")
  ) {
    return null;
  }

  const linkRow =
    "mt-2.5 flex items-center gap-2 text-[15px] text-[#e8e6e3] transition-colors hover:text-[#d97757]";
  const colTitle = "text-[13px] font-medium tracking-wide text-[#6b6862]";

  return (
    <footer className="bg-[#141413] text-[#e8e6e3] print:hidden">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Rohi International Travels" className="h-11 w-11 shrink-0 object-contain" />
            <p className="whitespace-nowrap font-serif text-[20px] font-semibold leading-tight tracking-tight text-[#f5f4f2] sm:text-[22px]">
              Rohi International Travels
            </p>
          </div>
          <button
            type="button"
            onClick={() => openWhatsApp("Hello Rohi International Travels! How can you help me today?")}
            className="mt-8 flex w-full max-w-xs items-center justify-between gap-3 rounded-full border border-[#3d3a36] bg-[#1f1e1c] py-3 pl-5 pr-2 text-left text-[14px] text-[#9c9891] transition-colors hover:border-[#d97757] hover:text-[#e8e6e3]"
          >
            How can I help you today?
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d97757] text-[#141413]">
              <ArrowUp className="h-4 w-4" />
            </span>
          </button>
          <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-[#9c9891]">
            Trusted Travel Partner delivering live group fares One Way Groups like UAE, Oman, Saudia Arabia also Umrah Groups, System Ticketing also available with fast service. After Sales Support, B2B System and Group Fares. Feel free to contact us 24/7.
          </p>
          <p className="mt-6 text-[13px] font-medium text-[#e8e6e3]">
            Rohi International Travels © {new Date().getFullYear()}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <a href="https://www.facebook.com/rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3d3a36] text-[#e8e6e3] transition hover:border-[#d97757] hover:text-[#d97757]">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="https://www.instagram.com/rohitravels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3d3a36] text-[#e8e6e3] transition hover:border-[#d97757] hover:text-[#d97757]">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="https://www.tiktok.com/@rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#3d3a36] text-[#e8e6e3] transition hover:border-[#d97757] hover:text-[#d97757]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M19.6 6.3a5.6 5.6 0 0 1-3.3-1.1 5.6 5.6 0 0 1-2.2-3.7h-3.3v13.5a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V8.9a6 6 0 0 0-.8-.1 6 6 0 1 0 6 6V8.5a8.9 8.9 0 0 0 5.5 1.9V7.1a5.5 5.5 0 0 1-0-.8z"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <p className={colTitle}>Contact</p>
          <a href={`tel:${PHONE_TEL}`} className={linkRow}>
            <Phone className="h-4 w-4 text-[#6b6862]" /> {PHONE}
          </a>
          <a href={WA_LINK} onClick={(e) => { e.preventDefault(); openWhatsApp(); }} target="_blank" rel="noopener noreferrer" className={linkRow}>
            <MessageCircle className="h-4 w-4 text-[#6b6862]" /> WhatsApp {PHONE}
          </a>
          <a href="mailto:rohitravels@gmail.com" className={linkRow}>
            <Mail className="h-4 w-4 text-[#6b6862]" /> rohitravels@gmail.com
          </a>
        </div>

        <div>
          <p className={colTitle}>Community</p>
          <a href="https://chat.whatsapp.com/HqDEujBmo0pESFjeb7Pikx" target="_blank" rel="noopener noreferrer" className={linkRow}>
            <Users className="h-4 w-4 text-[#6b6862]" /> Join WhatsApp Community
          </a>
          <a href="https://whatsapp.com/channel/0029VaDCohpDuMReHyrIgs1f" target="_blank" rel="noopener noreferrer" className={linkRow}>
            <Radio className="h-4 w-4 text-[#6b6862]" /> Follow WhatsApp Channel
          </a>
          <a href="https://g.page/r/CU1NtsPDbGPiEAE/review" target="_blank" rel="noopener noreferrer" className={linkRow}>
            <Star className="h-4 w-4 text-[#6b6862]" /> Leave a Google Review
          </a>
        </div>

        <div>
          <p className={colTitle}>Find us</p>
          <div className="mt-3 overflow-hidden rounded-xl border border-[#3d3a36]">
            <iframe
              title="Rohi International Travels — Google Maps"
              src="https://www.google.com/maps?q=Rohi+International+Travels,+Rahim+Yar+Khan&output=embed"
              width="100%"
              height="180"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <a href="https://www.google.com/maps/place/Rohi+International+Travels/@28.4225455,70.3078476,17z" target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 text-[14px] text-[#9c9891] transition-colors hover:text-[#d97757]">
            <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
          </a>
        </div>
      </div>

      <div className="border-t border-[#2b2a28]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-[13px] text-[#6b6862] sm:flex-row">
          <p>© {new Date().getFullYear()} Rohi International Travels</p>
          <p>All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
