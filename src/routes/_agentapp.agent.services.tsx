import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listServicesPublic } from "@/lib/fares.functions";
import { serviceImageFor } from "@/routes/index";

const servicesQuery = queryOptions({
  queryKey: ["inquiry-services-public"],
  queryFn: () => listServicesPublic(),
});

export const Route = createFileRoute("/_agentapp/agent/services")({
  loader: ({ context }) => context.queryClient.ensureQueryData(servicesQuery),
  component: AgentServicesPage,
});

function AgentServicesPage() {
  const { data: services } = useSuspenseQuery(servicesQuery);
  const items = services.length
    ? services
    : [{ id: "placeholder", label: "General Travel Services", sort_order: 0 }];

  return (
    <div className="p-3 md:p-5">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">
            {`'''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
            
            copy these three button s from agent b2b portal and place them on https://rohitravels.com/admin/ledger  admin panel Ledger accounts details  section and remove the already csv and pdf buttons`}
          </h1>
          <p className="text-sm text-gray-500">Explore travel solutions for your agency and clients.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((s: any, i: number) => {
          const img = serviceImageFor(s.label);
          return (
            <div
              key={s.id}
              className="group relative block overflow-hidden rounded-xl border border-navy/10 bg-white shadow-md transition-all duration-500 hover:-translate-y-1 hover:border-gold/60 hover:shadow-xl"
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70 group-hover:text-gold transition-colors">
                    Available for B2B
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-navy text-xs transition-transform group-hover:translate-x-1">
                    ✓
                  </span>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-gold via-gold to-emerald-400 transition-transform duration-500 group-hover:scale-x-100" />
            </div>
          );
        })}
      </div>

      <div className="mt-12 rounded-2xl border border-dashed border-gray-300 p-8 text-center bg-gray-50/50">
        <h2 className="text-lg font-bold text-navy">Need Custom Service?</h2>
        <p className="mt-1 text-sm text-gray-600">
          Contact our support for special arrangements and bespoke packages.
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <a
            href="https://wa.me/923056622988"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-whatsapp px-6 py-2 text-xs font-bold text-white shadow-lg transition-transform hover:scale-105"
          >
            WhatsApp Support
          </a>
        </div>
      </div>
    </div>
  );
}
