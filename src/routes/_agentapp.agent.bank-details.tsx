import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { listBankDetails } from "@/lib/bank-details.functions";

export const Route = createFileRoute("/_agentapp/agent/bank-details")({
  ssr: false,
  component: AgentBankDetailsPage,
});

function AgentBankDetailsPage() {
  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["bank-details"],
    queryFn: () => listBankDetails(),
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-navy/10 pb-4">
        <div>
          <h1 className="text-2xl font-black text-navy uppercase tracking-tight">
            Bank Account Details
          </h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
            Official Payment Methods
          </p>
        </div>
        <nav className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Accounts / <span className="text-gold">Bank Details</span>
        </nav>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading bank details...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {banks.map((bank) => (
            <div
              key={bank.id}
              className="group relative overflow-hidden rounded-xl border border-navy/10 bg-white shadow-sm transition-all hover:shadow-md hover:border-gold/30"
            >
              <div className="p-6">
                <div className="mb-6 flex items-start justify-between">
                  <div className="h-14 w-28 overflow-hidden rounded bg-white p-1.5 ring-1 ring-navy/5 shadow-inner flex items-center justify-center">
                    {bank.bank_logo_url ? (
                      <img
                        src={bank.bank_logo_url}
                        alt={bank.bank_name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground uppercase bg-navy/5">
                        Logo
                      </div>
                    )}
                  </div>
                  <div className="rounded-full bg-gold/10 p-2 text-gold">
                    <Landmark className="h-5 w-5" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-black text-navy uppercase leading-tight tracking-tight">
                      {bank.bank_name}
                    </h3>
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                      {bank.account_name}
                    </p>
                  </div>

                  <div className="rounded-lg bg-navy/5 p-3 ring-1 ring-navy/5">
                    <div className="mb-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-navy/40">
                        Account No:
                      </p>
                      <p className="font-mono text-sm font-black text-navy tracking-wider">
                        {bank.account_no}
                      </p>
                    </div>

                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-navy/40">
                        IBAN:
                      </p>
                      <p className="font-mono text-[10px] font-black text-navy break-all leading-relaxed">
                        {bank.iban}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-navy via-gold to-navy opacity-30"></div>
            </div>
          ))}

          {banks.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center rounded-xl border-2 border-dashed border-navy/10 bg-navy/5">
              <div className="mb-4 rounded-full bg-white p-6 shadow-sm text-navy/20">
                <Landmark className="h-12 w-12" />
              </div>
              <h3 className="text-lg font-bold text-navy uppercase tracking-tight">
                No bank accounts available
              </h3>
              <p className="mt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Please contact support for payment information
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
