import { useState, useEffect } from "react";
import { MessageCircle, X, Send, User, ChevronDown, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getQuickReplies, saveQuickReply, deleteQuickReply } from "@/lib/whatsapp-direct.functions";
import { toast } from "sonner";

const COUNTRY_CODES = [
  { code: "92", label: "PK", flag: "🇵🇰" },
  { code: "966", label: "SA", flag: "🇸🇦" },
  { code: "971", label: "AE", flag: "🇦🇪" },
  { code: "968", label: "OM", flag: "🇴🇲" },
  { code: "974", label: "QA", flag: "🇶🇦" },
  { code: "965", label: "KW", flag: "🇰🇼" },
  { code: "973", label: "BH", flag: "🇧🇭" },
  { code: "90", label: "TR", flag: "🇹🇷" },
  { code: "44", label: "UK", flag: "🇬🇧" },
  { code: "1", label: "US", flag: "🇺🇸" },
];

function buildUrl(code: string, number: string, text: string, type: "wa" | "business") {
  const phone = `${code}${number}`.replace(/\D/g, "");
  const query = text.trim() ? `&text=${encodeURIComponent(text.trim())}` : "";
  
  if (type === "business") {
    return `https://api.whatsapp.com/send?phone=${phone}${query}`;
  }
  return `https://wa.me/${phone}?text=${encodeURIComponent(text.trim())}`;
}

export function WhatsAppDirectDialog({ onClose }: { onClose: () => void }) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [replies, setReplies] = useState<any[]>([]);

  const fetchReplies = useServerFn(getQuickReplies);
  const saveReplyFn = useServerFn(saveQuickReply);
  const deleteReplyFn = useServerFn(deleteQuickReply);

  useEffect(() => {
    fetchReplies().then(setReplies);
  }, []);


  const send = (type: "wa" | "business") => {
    const digits = number.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length < 6 || digits.length > 15) {
      setError("Enter a valid phone number.");
      return;
    }
    setError("");
    const url = buildUrl(selectedCountry.code, digits, text, type);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-navy/60 p-4 font-sans" onClick={onClose}>
      <div
        className="w-full max-w-[360px] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-xl font-medium text-navy/90">Direct Chat</h2>
          <button onClick={onClose} className="rounded-full p-1 text-navy/40 hover:bg-navy/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-2">
          <div className="rounded-lg border border-navy/10 p-5 space-y-6">
            <div>
              <p className="mb-4 text-[13px] font-bold text-navy/60">Business Messaging Workspace</p>
              
              {/* Country Selector */}
              <div className="relative mb-6 flex justify-center">
                <button 
                  onClick={() => setShowCountryList(!showCountryList)}
                  className="flex items-center gap-2 rounded-md bg-navy/5 px-3 py-1.5 transition hover:bg-navy/10"
                >
                  <span className="text-xl">{selectedCountry.flag}</span>
                  <span className="text-sm font-semibold text-navy/80">{selectedCountry.label} +{selectedCountry.code}</span>
                  <ChevronDown className="h-4 w-4 text-navy/40" />
                </button>

                {showCountryList && (
                  <div className="absolute top-full z-10 mt-1 max-h-48 w-40 overflow-y-auto rounded-md bg-white py-1 shadow-xl ring-1 ring-black/5">
                    {COUNTRY_CODES.map((c) => (
                      <button
                        key={c.code}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-navy/5"
                        onClick={() => {
                          setSelectedCountry(c);
                          setShowCountryList(false);
                        }}
                      >
                        <span>{c.flag}</span>
                        <span className="font-medium">+{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Number Input */}
              <div className="relative border-b border-navy/30 pb-1 focus-within:border-blue-500">
                <input
                  type="text"
                  className="w-full bg-transparent py-2 text-base text-navy/80 placeholder:text-navy/30 outline-none"
                  placeholder="Enter Number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send("wa")}
                  inputMode="numeric"
                />
                <User className="absolute right-0 top-2.5 h-5 w-5 text-blue-500" />
              </div>
            </div>

            {/* Message Input */}
            <div className="relative border-b border-navy/30 pb-1 focus-within:border-blue-500">
              <input
                type="text"
                className="w-full bg-transparent py-2 text-base text-navy/80 placeholder:text-navy/30 outline-none"
                placeholder="Message (optional)"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="absolute right-0 top-2.5 text-sm font-medium text-blue-500 hover:text-blue-600">
                Templates
              </button>
            </div>

            {/* Preview Section */}
            <div>
              <p className="text-[13px] font-bold text-navy/80">Message Preview</p>
              <p className="mt-1 text-[13px] text-navy/30">
                {text || "No message content yet."}
              </p>
            </div>

            {/* Error Message */}
            {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => send("wa")}
                className="flex items-center justify-center rounded-full bg-[#25D366] py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98]"
              >
                Open WA
              </button>
              <button
                onClick={() => send("business")}
                className="flex items-center justify-center rounded-full bg-[#25D366] py-3 text-[14px] font-bold text-white shadow-sm transition hover:brightness-105 active:scale-[0.98]"
              >
                WA Business
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppDirectGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.type === 'open-whatsapp-direct') setOpen(true);
    };
    window.addEventListener('app:whatsapp-direct', handler);
    return () => window.removeEventListener('app:whatsapp-direct', handler);
  }, []);

  if (!open) return null;
  return <WhatsAppDirectDialog onClose={() => setOpen(false)} />;
}


