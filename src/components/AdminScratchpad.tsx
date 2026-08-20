import React, { useState, useEffect } from "react";
import { Copy, Trash2, Save, ChevronRight, ChevronLeft, MessageSquare, Flag, List } from "lucide-react";
import { flagFor } from "@/lib/fare-format";
import { Fare } from "@/lib/fares.functions";

interface AdminScratchpadProps {
  fares: Fare[];
}

export function AdminScratchpad({ fares }: AdminScratchpadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [includeFooter, setIncludeFooter] = useState(false);
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

  const copyAllFares = () => {
    const allText = fares
      .map((f) => formatFare(f, false))
      .join("");
    
    if (includeFooter) {
      const footer = "\n*ROHI INTERNATIONAL TRAVELS*\n0305-6622988 ABDUL RAZZAQ\n\n";
      setContent(prev => prev + allText + footer);
    } else {
      setContent(prev => prev + allText);
    }
  };

  const clearContent = () => {
    if (window.confirm("Are you sure you want to clear the scratchpad?")) {
      setContent("");
      localStorage.removeItem("admin_scratchpad_content");
    }
  };

  const formatFare = (f: Fare, useFooterOverride?: boolean) => {
    const flag = flagFor(f.destination_code);
    
    const title = `*${f.origin.toUpperCase()} → ${f.destination.toUpperCase()}*`;
    
    let details = "";
    if (f.flight_details) {
      details = f.flight_details.split('\n')
        .filter(line => line.trim().length > 0)
        .join('\n');
    } else {
      const date = f.flight_date ? f.flight_date.toUpperCase() : "";
      details = `${date} ${f.origin_code} ${f.destination_code} ${f.depart_time || ""} ${f.arrive_time || ""}`.trim();
    }

    const airlineInfo = `${f.airline} - ${f.baggage || "25+7 KG"}`;
    const footer = (useFooterOverride ?? includeFooter) 
      ? "\n\n*ROHI INTERNATIONAL TRAVELS*\n0305-6622988 ABDUL RAZZAQ"
      : "";

    return `${flag} ${title}\n${details}\n${airlineInfo}${footer}\n\n`;
  };

  const appendFare = (f: Fare) => {
    setContent(prev => prev + formatFare(f));
  };

  return (
    <div 
      className={`fixed bottom-6 right-6 z-[100] transition-all duration-300 ease-in-out ${
        isOpen ? "w-80 md:w-96" : "w-14"
      } md:right-auto md:left-6`}
    >
      <div className="relative flex flex-col overflow-hidden rounded-2xl bg-navy shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-2 ring-gold/30">
        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-14 w-full items-center justify-center bg-gold text-navy transition-all hover:bg-gold/90 active:scale-95 ${
            !isOpen && "rounded-2xl shadow-lg"
          }`}
        >
          {isOpen ? <ChevronLeft className="h-5 w-5" /> : (
            <div className="flex flex-col items-center">
              <MessageSquare className="h-5 w-5" />
              <span className="mt-0.5 text-[7px] font-black uppercase tracking-tighter leading-none text-center px-1">All Group Fares Available</span>
            </div>
          )}
        </button>

        {isOpen && (
          <div className="flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">All Group Fares Available</span>
              <div className="flex gap-2">
                <button 
                  onClick={copyAllFares}
                  title="Add all fares"
                  className="rounded-md bg-gold/20 p-1.5 text-gold hover:bg-gold/30"
                >
                  <List className="h-4 w-4" />
                </button>
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
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Quick Add Fare Flag</p>
                <label className="flex cursor-pointer items-center gap-2 group">
                  <span className="text-[9px] font-bold uppercase tracking-tighter text-white/40 group-hover:text-gold transition-colors">Add Footer</span>
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only" 
                      checked={includeFooter}
                      onChange={(e) => setIncludeFooter(e.target.checked)}
                    />
                    <div className="h-4 w-8 rounded-full bg-white/10 ring-1 ring-white/20 transition-all peer-checked:bg-gold/40 peer-checked:ring-gold/50"></div>
                    <div className="absolute left-1 top-1 h-2 w-2 rounded-full bg-white/40 transition-all peer-checked:left-5 peer-checked:bg-gold"></div>
                  </div>
                </label>
              </div>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
                {fares.slice(0, 20).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => appendFare(f)}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] text-white hover:bg-white/10 transition-colors"
                  >
                    <span className="text-[9px] opacity-70">{flagFor(f.destination_code)}</span>
                    <span className="font-bold tracking-tight">{f.origin_code}→{f.destination_code}</span>
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