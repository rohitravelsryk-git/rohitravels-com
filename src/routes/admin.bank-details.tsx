import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Landmark, Plus, Pencil, Trash2, X, Check, Plane, KeyRound, Settings, Sparkles, LogOut } from "lucide-react";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminNotifications } from "@/components/AdminNotifications";
import {
  checkAdminUnlocked,
  adminLogout,
  adminUnlock,
  staffUnlock,
  verifyLoginCode,
  resendLoginCode,
  verifyAdminPassword,
  supabase,
} from "@/lib/fares.functions";
import {
  listBankDetails,
  createBankDetail,
  updateBankDetail,
  deleteBankDetail,
  type BankDetail,
} from "@/lib/bank-details.functions";

export const Route = createFileRoute("/admin/bank-details")({
  component: BankDetailsAdminPage,
});

function BankDetailsAdminPage() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  return status?.unlocked ? (
    <BankDetailsPanel 
      staffTabs={status.staffTabs} 
      staffUsername={status.staffUsername} 
    />
  ) : (
    <UnlockScreen />
  );
}

function BankDetailsPanel({ staffTabs, staffUsername }: { staffTabs?: string[], staffUsername?: string | null }) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("admin-bank-details-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_details" }, () => {
        qc.invalidateQueries({ queryKey: ["bank-details"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const logout = useServerFn(adminLogout);

  const router = useRouter();
  
  const { data: banks = [], isLoading } = useQuery({
    queryKey: ["bank-details"],
    queryFn: () => listBankDetails(),
  });

  const createFn = useServerFn(createBankDetail);
  const updateFn = useServerFn(updateBankDetail);
  const deleteFn = useServerFn(deleteBankDetail);

  const [showAdd, setShowAdd] = useState(false);
  const [editingBank, setEditingBank] = useState<BankDetail | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    await logout();
    await qc.invalidateQueries({ queryKey: ["admin", "status"] });
    await router.invalidate();
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      bank_name: fd.get("bank_name") as string,
      bank_logo_url: fd.get("bank_logo_url") as string || null,
      account_name: fd.get("account_name") as string,
      account_no: fd.get("account_no") as string,
      iban: fd.get("iban") as string,
    };

    setBusy(true);
    try {
      await createFn({ data });
      await qc.invalidateQueries({ queryKey: ["bank-details"] });
      setShowAdd(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingBank) return;
    const fd = new FormData(e.currentTarget);
    const data = {
      id: editingBank.id,
      bank_name: fd.get("bank_name") as string,
      bank_logo_url: fd.get("bank_logo_url") as string || null,
      account_name: fd.get("account_name") as string,
      account_no: fd.get("account_no") as string,
      iban: fd.get("iban") as string,
    };

    setBusy(true);
    try {
      await updateFn({ data });
      await qc.invalidateQueries({ queryKey: ["bank-details"] });
      setEditingBank(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this bank detail?")) return;
    setBusy(true);
    try {
      await deleteFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["bank-details"] });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b border-border bg-navy text-navy-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Plane className="h-5 w-5 -rotate-45 text-gold" />
            <div>
              <p className="font-serif text-lg font-black">Admin Panel</p>
              <p className="text-[10px] tracking-widest text-white/60">Manage Bank Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="rounded-md border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">
              View site
            </a>
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-md bg-gold px-3 py-2 text-xs font-bold text-gold-foreground">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
        </div>
        <AdminTabs staffTabs={staffTabs} panelRole={staffUsername ? "staff" : "admin"} />
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-bold uppercase tracking-wider text-white">
            <Landmark className="h-4 w-4" /> Bank Accounts
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">{banks.length}</span>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-xs font-bold uppercase tracking-widest text-white hover:bg-navy/90"
          >
            <Plus className="h-4 w-4" /> Add Bank
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading bank details...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {banks.map((bank) => (
              <div key={bank.id} className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="h-12 w-24 overflow-hidden rounded bg-white p-1 ring-1 ring-border">
                      {bank.bank_logo_url ? (
                        <img src={bank.bank_logo_url} alt={bank.bank_name} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground uppercase">Logo</div>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingBank(bank)}
                        className="rounded bg-navy p-1.5 text-white hover:bg-navy/80"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(bank.id)}
                        className="rounded bg-destructive p-1.5 text-white hover:bg-destructive/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-black text-navy uppercase leading-tight">{bank.bank_name}</h3>
                      <p className="text-[11px] font-medium text-muted-foreground">{bank.account_name}</p>
                    </div>
                    
                    <div>
                      <p className="text-[10px] font-bold uppercase text-navy/60">Account No:</p>
                      <p className="font-mono text-xs font-bold text-navy">{bank.account_no}</p>
                    </div>
                    
                    <div>
                      <p className="text-[10px] font-bold uppercase text-navy/60">IBAN:</p>
                      <p className="font-mono text-[10px] font-bold text-navy break-all">{bank.iban}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {banks.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-navy/5 p-6 text-navy/20">
              <Landmark className="h-12 w-12" />
            </div>
            <h3 className="text-lg font-bold text-navy">No bank accounts added</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add your official bank details for agents to see.</p>
          </div>
        )}
      </main>

      {(showAdd || editingBank) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-xl ring-1 ring-border overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-navy px-5 py-4 text-white">
              <h2 className="font-serif text-lg font-black">{editingBank ? "Edit Bank Detail" : "Add New Bank"}</h2>
              <button onClick={() => { setShowAdd(false); setEditingBank(null); }} className="rounded p-1 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={editingBank ? handleUpdate : handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Bank Name</label>
                <input
                  name="bank_name"
                  defaultValue={editingBank?.bank_name}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-navy/20 outline-none"
                  placeholder="e.g. Bank Alfalah Ltd"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Bank Logo URL</label>
                <input
                  name="bank_logo_url"
                  defaultValue={editingBank?.bank_logo_url || ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-navy/20 outline-none"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Account Holder Name</label>
                <input
                  name="account_name"
                  defaultValue={editingBank?.account_name}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-navy/20 outline-none"
                  placeholder="e.g. Travel Advisor (Pvt) Ltd"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">Account Number</label>
                <input
                  name="account_no"
                  defaultValue={editingBank?.account_no}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-navy/20 outline-none"
                  placeholder="0140-1007284090"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-navy mb-1">IBAN</label>
                <input
                  name="iban"
                  defaultValue={editingBank?.iban}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-navy/20 outline-none"
                  placeholder="PK65ALFH..."
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-md bg-navy py-2.5 text-sm font-bold uppercase tracking-widest text-white hover:bg-navy/90 disabled:opacity-50"
                >
                  {busy ? "Saving..." : editingBank ? "Update Bank" : "Add Bank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UnlockScreen() {
  const unlock = useServerFn(adminUnlock);
  const staffLogin = useServerFn(staffUnlock);
  const verifyCode = useServerFn(verifyLoginCode);
  const resend = useServerFn(resendLoginCode);
  const qc = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<"admin" | "staff">("admin");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [otpChallenge, setOtpChallenge] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // Two-step verification is disabled: the password alone signs in.
      const res = mode === "admin"
        ? await unlock({ data: { password } })
        : await staffLogin({ data: { username, password } });
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ["admin", "status"] });
        router.invalidate();
      } else {
        setErr(mode === "admin" ? "Incorrect admin password." : "Invalid staff credentials.");
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!otpChallenge) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await verifyCode({ data: { challenge: otpChallenge, code: otp, mode } });
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ["admin", "status"] });
        router.invalidate();
      } else {
        setErr(res.error || "Invalid OTP code.");
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-4">
      <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-2xl ring-1 ring-border">
        <div className="mb-8 text-center">
          <Plane className="mx-auto h-10 w-10 -rotate-45 text-gold" />
          <h1 className="mt-4 font-serif text-2xl font-black text-navy uppercase">Admin Access</h1>
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mt-1">Rohi International Travels</p>
        </div>

        {otpChallenge ? (
          <form onSubmit={onVerifyMfa} className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              A 6-digit code was sent to {maskedEmail}.
            </p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter OTP"
              required
              className="w-full rounded-md border border-input bg-background px-4 py-3 text-center text-lg font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-navy/20"
            />
            {err && <p className="text-center text-xs font-bold text-destructive">{err}</p>}
            <button
              disabled={busy}
              className="w-full rounded-md bg-gold py-3 text-sm font-black uppercase tracking-widest text-gold-foreground shadow-lg transition-all hover:opacity-95 disabled:opacity-50"
            >
              Verify Code
            </button>
            <button
              type="button"
              onClick={() => resend({ data: { challenge: otpChallenge, mode } })}
              className="w-full text-xs font-bold text-navy/60 hover:text-navy"
            >
              Resend OTP
            </button>
          </form>
        ) : (
          <form onSubmit={onUnlock} className="space-y-4">
            <div className="flex rounded-md bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("admin")}
                className={`flex-1 rounded py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  mode === "admin" ? "bg-white text-navy shadow-sm" : "text-muted-foreground hover:text-navy"
                }`}
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => setMode("staff")}
                className={`flex-1 rounded py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                  mode === "staff" ? "bg-white text-navy shadow-sm" : "text-muted-foreground hover:text-navy"
                }`}
              >
                Staff Login
              </button>
            </div>

            {mode === "staff" && (
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
                className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-navy/20"
              />
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Password"
              required
              className="w-full rounded-md border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-navy/20"
            />
            {err && <p className="text-center text-xs font-bold text-destructive">{err}</p>}
            <button
              disabled={busy}
              className="w-full rounded-md bg-navy py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Unlocking…" : "Enter Panel ›"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
