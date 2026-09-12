import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listServices } from "@/lib/fares.functions";
import { serviceImageFor } from "./index";

const servicesQuery = queryOptions({
  queryKey: ["inquiry-services"],
  queryFn: () => listServices(),
});

export const Route = createFileRoute("/services")({
  loader: ({ context }) => context.queryClient.ensureQueryData(servicesQuery),
  head: () => ({
    meta: [
      { title: "Our Services — Rohi International Travels" },
      {
        name: "description",
        content:
          "Explore all travel services offered by Rohi International Travels — flights, Umrah & Hajj, visas, hotels, transfers, discount vouchers and more.",
      },
      { property: "og:title", content: "Our Services — Rohi International Travels" },
      {
        property: "og:description",
        content:
          "A complete catalogue of travel solutions — tickets, Umrah, Hajj, visa, hotel, transport, insurance and group fares.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rohitravels.com/services" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/services" }],
  }),

  component: ServicesPage,
});

function ServicesPage() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const items = services.length
    ? services
    : [{ id: "placeholder", label: "General Travel Services", sort_order: 0 }];

  return (
    <div className="min-h-screen bg-background text-navy animate-premium-fade">
      {/* Hero */}
      <section className="bg-navy text-white mt-[-1px]">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-center gap-3 text-gold">
            <span className="text-xs font-bold uppercase tracking-[0.3em]">Our Services</span>
          </div>
          <h1 className="mt-3 font-serif text-4xl font-black md:text-5xl">
            Everything You Need to <span className="text-gold">Travel</span>
          </h1>
          <p className="mt-3 max-w-2xl text-white/80">
            From your first inquiry to touchdown — one trusted partner for tickets, group fares,
            travel insurance, appointments, Umrah packages, visit visas, hotels, transfers and more.
          </p>
        </div>
      </section>


      {/* Catalogue grid */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((s, i) => {
            const img = serviceImageFor(s.label);
            return (
              <Link
                key={s.id}
                to="/inquiry"
                search={{ service: s.label }}
                className="group relative block overflow-hidden rounded-xl border border-navy/10 bg-white shadow-md transition-all duration-500 hover:-translate-y-1 hover:border-gold/60 hover:shadow-xl animate-fade-in"
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={img}
                    alt={`Travel service: ${s.label}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy/85 via-navy/30 to-transparent" />
                  <div className="absolute left-2 top-2 rounded-full bg-gold/95 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-navy">
                    0{i + 1}
                  </div>
                </div>
                <div className="relative -mt-12 p-3">
                  <h3 className="font-serif text-sm font-black leading-tight text-white drop-shadow-lg line-clamp-2 min-h-[2.5rem]">
                    {s.label}
                  </h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-navy/60">
                      Inquire now
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-navy text-xs transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-gold via-gold to-emerald-400 transition-transform duration-500 group-hover:scale-x-100" />
              </Link>
            );
          })}
        </div>

        {/* CTA band */}
        <div className="relative mt-14 overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-r from-gold/10 via-navy/5 to-emerald-500/10 p-8 text-center md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.15),transparent_60%)]" />
          <div className="relative">
            <h2 className="font-serif text-2xl font-black text-navy md:text-3xl">
              Don't see what you need?
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-navy/70">
              Send us a query — we respond in minutes.
            </p>
            <Link
              to="/inquiry"
              className="mt-6 inline-flex rounded-full bg-gold px-8 py-3 text-sm font-bold uppercase tracking-wide text-navy shadow-lg shadow-gold/30 transition hover:scale-105"
            >
              Send Your Query
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

