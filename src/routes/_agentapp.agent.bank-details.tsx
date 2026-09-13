import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Landmark, Copy, Check } from "lucide-react";
import { listBankDetails } from "@/lib/bank-details.functions";

export const Route = createFileRoute("/_agentapp/agent/bank-details")({
  ssr: false,
  component: AgentBankDetailsPage,
});

function BankLogo({ bankName, logoUrl }: { bankName: string; logoUrl?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = bankName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-16 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white p-2 shadow-sm">
      {logoUrl && !imageFailed ? (
        <img
          src={logoUrl}
          alt={bankName + " logo"}
          className="h-full w-full object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-gold text-white">
          <Landmark className="mb-0.5 h-4 w-4" />
          <span className="text-[11px] font-black tracking-[0.18em]">{initials || "BANK"}</span>
        </div>
      )}
    </div>
  );
}

function AgentBankDetailsPage() {
  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["bank-details"],
    queryFn: () => listBankDetails(),
  });
  const [copiedIban, setCopiedIban] = useState<string | null>(null);
  const copyIban = (iban: string) => {
    navigator.clipboard.writeText(iban).then(() => {
      setCopiedIban(iban);
      setTimeout(() => setCopiedIban((cur) => (cur === iban ? null : cur)), 1600);
    });
  };

  return (
    <div className="p-6 animate-premium-fade">
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
              className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-lg"
            >
              <div className="p-6">
                <div className="mb-6 flex items-start justify-between">
                  <BankLogo bankName={bank.bank_name} logoUrl={bank.bank_logo_url} />
                  <div className="rounded-full border border-gold/20 bg-gold/10 p-2 text-gold">
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

                  <div className="rounded-xl border border-border bg-secondary/60 p-4">
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
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className="font-mono text-[13px] font-black text-navy break-all leading-relaxed tracking-wide">
                          {bank.iban}
                        </p>
                        <button
                          type="button"
                          onClick={() => copyIban(bank.iban)}
                          title="Copy IBAN"
                          className="flex shrink-0 items-center gap-1 rounded-md border border-navy/15 bg-white px-1.5 py-1 text-navy transition-colors hover:bg-navy/10"
                        >
                          {copiedIban === bank.iban ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
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
