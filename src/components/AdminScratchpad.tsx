import React, { useState, useEffect } from "react";
import { Copy, Trash2, Save, ChevronRight, ChevronLeft, MessageSquare, Flag } from "lucide-react";
import { flagFor } from "@/lib/fare-format";
import { Fare } from "@/lib/fares.functions";

interface AdminScratchpadProps {
  fares: Fare[];
}

export function AdminScratchpad({ fares }: AdminScratchpadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("admin_scratchpad_content");
    if (saved) setContent(saved);
  }, []);

  // Auto-save to localStorage
  const handleSave = () => {
    localStorage.setItem("admin_scratchpad_content", content);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const clearContent = () => {
    if (window.confirm("Are you sure you want to clear the scratchpad?")) {
      setContent("");
      localStorage.removeItem("admin_scratchpad_content");
    }
  };

  const appendFare = (f: Fare) => {
    const flag = flagFor(f.destination_code);
    
    // Format:
    // 🇸🇦 *KARACHI → RIYADH GROUP FARE* (Full Route Info)
    // FLYADEAL (Airline Name)
    // 🇸🇦 *KHI RUH GROUP FARE* (IATA Route Info)
    // Timing Line 1
    // Timing Line 2
    
    const title = `*${f.origin.toUpperCase()} → ${f.destination.toUpperCase()} GROUP FARE* (${f.destination.toUpperCase()}, ${f.origin.toUpperCase()} here)`;
    const subTitle = `*${f.origin_code.toUpperCase()} ${f.destination_code.toUpperCase()} GROUP FARE*`;
    
    let details = "";
    if (f.flight_details) {
      details = f.flight_details.split('\n').filter(line => line.trim().length > 0).join('\n');
    } else {
      const date = f.flight_date ? f.flight_date.toUpperCase() : "";
      details = `${date} ${f.origin_code} ${f.destination_code} ${f.depart_time || ""} ${f.arrive_time || ""}`.trim();
    }

    const fareText = `${flag} ${title}\n\n${f.airline.toUpperCase()}(airline name here)\n\n${flag} ${subTitle}\n${details}\n\nnext group here\n\n`;
    setContent(prev => prev + fareText);
  };

  return (
    <div 
      className={`fixed bottom-6 right-6 z-[100] transition-all duration-300 ease-in-out ${
        isOpen ? "w-80 md:w-96" : "w-14"
      }`}
    >
      <div className="relative flex flex-col overflow-hidden rounded-2xl bg-navy shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-2 ring-gold/30">
        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-14 w-full items-center justify-center bg-gold text-navy transition-all hover:bg-gold/90 active:scale-95 ${
            !isOpen && "rounded-2xl shadow-lg"
          }`}
        >
          {isOpen ? <ChevronRight className="h-5 w-5" /> : (
            <div className="flex flex-col items-center">
              <MessageSquare className="h-5 w-5" />
              <span className="mt-0.5 text-[8px] font-black uppercase tracking-tighter">Tools</span>
            </div>
          )}
        </button>

        {isOpen && (
          <div className="flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Admin Scratchpad</span>
              <div className="flex gap-2">
                <button 
                  onClick={handleSave}
                  title="Save changes"
                  className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button 
                  onClick={copyToClipboard}
                  title="Copy all"
                  className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button 
                  onClick={clearContent}
                  title="Clear all"
                  className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Compose message here..."
              className="h-64 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/50"
            />

            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/50">Quick Add Fare Flag</p>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
                {fares.slice(0, 10).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => appendFare(f)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white hover:bg-white/10 transition-colors"
                  >
                    <span>{flagFor(f.destination_code)}</span>
                    <span className="font-bold">{f.destination_code}</span>
                  </button>
                ))}
              </div>
            </div>

            {isSaved && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-bold text-white shadow-lg">
                Success!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
