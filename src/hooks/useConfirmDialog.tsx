import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type ConfirmOptions = {
  title: string;
  message?: string;
  /** Optional list of key/value rows shown as a small summary card (e.g. fare breakdown). */
  details?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "default" = neutral/gold accent, "success" = green accent (e.g. Payment Received). */
  tone?: "default" | "success" | "danger";
};

/**
 * Renders a styled confirmation modal in place of window.confirm(), so every
 * "are you sure?" moment across the admin panel looks and feels the same.
 * Usage:
 *   const { confirm, dialog } = useConfirmDialog();
 *   ...
 *   const ok = await confirm({ title: "Verify fare", details: [...] });
 *   return <>{dialog}{...rest of page}</>;
 */
export function useConfirmDialog() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  };

  const toneCls = opts?.tone === "success"
    ? { ring: "ring-success/30", icon: "text-success bg-success-soft", btn: "bg-success hover:bg-success-strong" }
    : opts?.tone === "danger"
    ? { ring: "ring-error/30", icon: "text-error bg-error-soft", btn: "bg-error hover:bg-error-strong" }
    : { ring: "ring-gold/30", icon: "text-gold bg-gold/10", btn: "bg-gold hover:brightness-95 text-gold-foreground" };

  const dialog = opts ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm animate-premium-fade"
      onClick={() => close(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm animate-premium-scale rounded-2xl bg-card p-6 shadow-2xl ring-1 ${toneCls.ring}`}
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${toneCls.icon}`}>
            {opts.tone === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wide text-navy">{opts.title}</h3>
            {opts.message && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{opts.message}</p>}
          </div>
        </div>

        {opts.details && opts.details.length > 0 && (
          <div className="mt-4 space-y-1.5 rounded-lg border border-border bg-secondary/40 p-3">
            {opts.details.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-bold text-navy">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-md border border-border bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-secondary"
          >
            {opts.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-all ${toneCls.btn}`}
          >
            {opts.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
