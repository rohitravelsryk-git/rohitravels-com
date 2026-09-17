import { useRouter } from "@tanstack/react-router";
import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone, Radio, Star, Users } from "lucide-react";

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

  return (
    <footer className="bg-navy text-navy-foreground print:hidden">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Rohi International Travels" className="h-20 w-20 object-contain drop-shadow-lg" />
            <div>
              <p className="font-serif text-lg font-black leading-tight">ROHI INTERNATIONAL TRAVELS</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Trusted Travel Partner delivering live group fares One Way Groups like UAE, Oman, Saudia Arabia also Umrah Groups, System Ticketing also available with fast service. After Sales Support, B2B System and Group Fares. Feel free to contact us 24/7.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <a href="https://www.facebook.com/rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-gold hover:text-navy">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="https://www.instagram.com/rohitravels/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-gold hover:text-navy">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="https://www.tiktok.com/@rohitravelsryk" target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-gold hover:text-navy">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M19.6 6.3a5.6 5.6 0 0 1-3.3-1.1 5.6 5.6 0 0 1-2.2-3.7h-3.3v13.5a2.7 2.7 0 1 1-2.7-2.7c.3 0 .5 0 .8.1V8.9a6 6 0 0 0-.8-.1 6 6 0 1 0 6 6V8.5a8.9 8.9 0 0 0 5.5 1.9V7.1a5.5 5.5 0 0 1-0-.8z"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-gold">Contact</p>
          <a href={`tel:${PHONE_TEL}`} className="mt-3 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
            <Phone className="h-4 w-4" /> {PHONE}
          </a>
          <a href={WA_LINK} onClick={(e) => { e.preventDefault(); openWhatsApp(); }} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
            <MessageCircle className="h-4 w-4 text-whatsapp" /> WhatsApp {PHONE}
          </a>
          <a href="mailto:rohitravels@gmail.com" className="mt-2 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
            <Mail className="h-4 w-4" /> rohitravels@gmail.com
          </a>
          <a href="https://chat.whatsapp.com/HqDEujBmo0pESFjeb7Pikx" target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center gap-2 rounded-lg bg-whatsapp/15 px-3 py-2 text-xs font-medium text-whatsapp hover:bg-whatsapp/25">
            <Users className="h-4 w-4" /> Join WhatsApp Community
          </a>
          <a href="https://whatsapp.com/channel/0029VaDCohpDuMReHyrIgs1f" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 rounded-lg bg-whatsapp/15 px-3 py-2 text-xs font-medium text-whatsapp hover:bg-whatsapp/25">
            <Radio className="h-4 w-4" /> Follow WhatsApp Channel
          </a>
          <a href="https://g.page/r/CU1NtsPDbGPiEAE/review" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 rounded-lg bg-gold/15 px-3 py-2 text-xs font-medium text-gold hover:bg-gold/25">
            <Star className="h-4 w-4" /> Leave a Google Review
          </a>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-gold">Live fares</p>
          <p className="mt-3 text-sm text-white/70">
            Send your query to get best and cheapest rates.
          </p>
          <a href="mailto:rohitravels@gmail.com" className="mt-3 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
            <Mail className="h-4 w-4" /> rohitravels@gmail.com
          </a>
          <a href={WA_LINK} onClick={(e) => { e.preventDefault(); openWhatsApp(); }} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-sm text-white/90 hover:text-gold">
            <MessageCircle className="h-4 w-4 text-whatsapp" /> {PHONE}
          </a>
        </div>

        <div>
          <p className="text-[13px] font-semibold text-gold">Find us</p>
          <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
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
          <a href="https://www.google.com/maps/place/Rohi+International+Travels/@28.4225455,70.3078476,17z" target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-2 text-xs text-white/70 hover:text-gold">
            <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
          </a>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Rohi International Travels. All rights reserved.
      </div>
    </footer>
  );
}
