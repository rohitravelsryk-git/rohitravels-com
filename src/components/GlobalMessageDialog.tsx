import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type MessageKind = "info" | "error" | "success";
type MessagePayload = { message: string; kind?: MessageKind };

export function GlobalMessageDialog() {
  const [payload, setPayload] = useState<MessagePayload | null>(null);

  useEffect(() => {
    const originalAlert = window.alert;
    const handleMessage = (event: Event) => {
      const detail = (event as CustomEvent<MessagePayload>).detail;
      if (detail?.message) setPayload(detail);
    };
    const customAlert = (message?: string) => {
      setPayload({ message: String(message ?? ""), kind: "error" });
    };
    window.addEventListener("rohi:message", handleMessage);
    window.alert = customAlert;
    return () => {
      window.removeEventListener("rohi:message", handleMessage);
      window.alert = originalAlert;
    };
  }, []);

  if (!payload) return null;

  const isSuccess = payload.kind === "success";
  const isInfo = payload.kind === "info";
  const Icon = isSuccess ? CheckCircle2 : isInfo ? Info : AlertCircle;
  const accent = isSuccess ? "#15803d" : isInfo ? "#2563eb" : "#b42318";

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ color: accent, background: `${accent}14` }}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-[#141413]">{isSuccess ? "Success" : isInfo ? "Notice" : "Please check"}</h2>
            <p className="mt-1 text-sm leading-6 text-black/65">{payload.message}</p>
          </div>
          <button type="button" onClick={() => setPayload(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-black/45 hover:bg-black/5 hover:text-black" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end border-t border-black/10 bg-[#faf9f7] px-5 py-3">
          <button type="button" onClick={() => setPayload(null)} className="rounded-lg px-5 py-2 text-xs font-black text-white" style={{ background: accent }}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
