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
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-navy/60 p-4 font-sans" onMouseDown={onClose}>
      <div
        className="w-full max-w-[360px] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-navy/5">
          <h2 className="text-xl font-medium text-navy/90">Direct Chat</h2>
          <button onClick={onClose} className="rounded-full p-1 text-navy/40 hover:bg-navy/5 transition-colors" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-4">
          <div className="rounded-lg border border-[#25D366]/20 bg-[#25D366]/5 p-5 space-y-6">
            <div>
              <p className="mb-4 text-[13px] font-bold text-[#075E54]/70">Business Messaging Workspace</p>
              
              {/* Country Selector */}
              <div className="relative mb-6 flex justify-center">
                <button 
                  onClick={() => setShowCountryList(!showCountryList)}
                  className="flex items-center gap-2 rounded-md bg-white border border-[#25D366]/30 px-3 py-1.5 transition hover:bg-[#25D366]/10 shadow-sm"
                >
                  <span className="text-xl">{selectedCountry.flag}</span>
                  <span className="text-sm font-semibold text-[#075E54]">{selectedCountry.label} +{selectedCountry.code}</span>
                  <ChevronDown className="h-4 w-4 text-[#075E54]/40" />
                </button>

                {showCountryList && (
                  <div className="absolute top-full z-10 mt-1 max-h-48 w-40 overflow-y-auto rounded-md bg-white py-1 shadow-xl ring-1 ring-black/5">
                    {COUNTRY_CODES.map((c) => (
                      <button
                        key={c.code}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#25D366]/10 text-[#075E54]"
                        onClick={() => {
                          setSelectedCountry(c);
                          setShowCountryList(false);
                        }}
                      >
                        <span>{c.flag}</span>
                        <span className="font-medium">+{c.code}</span>
                        <span className="ml-auto text-[10px] text-[#075E54]/40">{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Number Input */}
              <div className="relative border-b-2 border-[#25D366]/30 pb-1 focus-within:border-[#25D366] transition-colors">
                <input
                  type="text"
                  className="w-full bg-transparent py-2 text-base text-[#075E54] placeholder:text-[#075E54]/30 outline-none"
                  placeholder="Enter Number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send("wa")}
                  inputMode="numeric"
                />
                <User className="absolute right-0 top-2.5 h-5 w-5 text-[#25D366]" />
              </div>
            </div>

            {/* Message Input */}
            <div className="relative border-b-2 border-[#25D366]/30 pb-1 focus-within:border-[#25D366] transition-colors">
              <input
                type="text"
                className="w-full bg-transparent py-2 text-base text-[#075E54] placeholder:text-[#075E54]/30 outline-none pr-20"
                placeholder="Message (optional)"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button 
                onClick={() => setShowTemplates(!showTemplates)}
                className="absolute right-0 top-2.5 text-xs font-bold uppercase tracking-wider text-[#128C7E] hover:text-[#075E54] transition-colors"
              >
                Templates
              </button>
            </div>

            {/* Templates Dropdown */}
            {showTemplates && (
              <div className="rounded-lg border border-[#25D366]/20 bg-white p-2 shadow-inner max-h-40 overflow-y-auto space-y-1">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-bold text-[#075E54]/50 uppercase">Quick Replies</span>
                  <button 
                    onClick={async () => {
                      if (!text.trim()) {
                        toast.error("Type a message to save as template");
                        return;
                      }
                      const title = prompt("Enter template title:");
                      if (!title) return;
                      setIsSaving(true);
                      try {
                        await saveReplyFn({ data: { title, text } });
                        const updated = await fetchReplies();
                        setReplies(updated);
                        toast.success("Template saved");
                      } finally {
                        setIsSaving(false);
                      }
                    }}

                    disabled={isSaving}
                    className="p-1 hover:bg-[#25D366]/10 rounded-full transition-colors"
                  >
                    <Plus className="h-3 w-3 text-[#128C7E]" />
                  </button>
                </div>
                {replies.length === 0 && (
                  <p className="text-[11px] text-[#075E54]/40 text-center py-2 italic">No templates saved</p>
                )}
                {replies.map((r) => (
                  <div key={r.id} className="group flex items-center justify-between p-2 hover:bg-[#25D366]/5 rounded border border-transparent hover:border-[#25D366]/20 transition-all cursor-pointer" onClick={() => {
                    setText(r.text);
                    setShowTemplates(false);
                  }}>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold text-[#075E54]">{r.title}</span>
                      <span className="text-[10px] text-[#075E54]/60 line-clamp-1">{r.text}</span>
                    </div>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this template?")) return;
                        await deleteReplyFn({ data: { id: r.id } });
                        const updated = await fetchReplies();
                        setReplies(updated);
                        toast.success("Template deleted");
                      }}

                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Preview Section */}
            <div className="bg-white rounded-lg p-3 border border-[#25D366]/10 shadow-sm">
              <p className="text-[11px] font-bold text-[#075E54]/50 uppercase tracking-tighter">Message Preview</p>
              <p className="mt-1 text-[13px] text-[#075E54]/80 leading-relaxed min-h-[1.5em] whitespace-pre-wrap">
                {text || <span className="text-[#075E54]/20 italic">No message content yet...</span>}
              </p>
            </div>

            {/* Error Message */}
            {error && <p className="text-xs font-semibold text-red-500 bg-red-50 p-2 rounded border border-red-100">{error}</p>}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => send("wa")}
                className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-[14px] font-black text-white shadow-[0_4px_14px_0_rgba(37,211,102,0.39)] transition hover:brightness-105 active:scale-[0.98] uppercase tracking-wide"
              >
                <Send className="h-4 w-4" />
                Open WA
              </button>
              <button
                onClick={() => send("business")}
                className="flex items-center justify-center gap-2 rounded-full bg-[#128C7E] py-3 text-[14px] font-black text-white shadow-[0_4px_14px_0_rgba(18,140,126,0.39)] transition hover:brightness-105 active:scale-[0.98] uppercase tracking-wide"
              >
                <MessageCircle className="h-4 w-4" />
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


