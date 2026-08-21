import { useState, useEffect } from "react";
import { Check, X, Palette, Sun, Moon, Newspaper, Sparkles } from "lucide-react";

type ThemeOption = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
};

const THEMES: ThemeOption[] = [
  { id: "light", name: "Modern Light", icon: Sun, description: "Clean, professional white aesthetic" },
  { id: "dark", name: "Midnight Navy", icon: Moon, description: "Premium dark theme with gold accents" },
  { id: "paper", name: "Paper Ledger", icon: Newspaper, description: "Classic accounting ledger feel" },
];

export function ThemeDialog({ onClose }: { onClose: () => void }) {
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.classList.contains("dark") 
      ? "dark" 
      : window.localStorage.getItem("admin-theme") || "light";
  });

  const applyTheme = (themeId: string) => {
    setActiveTheme(themeId);
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    root.classList.remove("dark");
    
    if (themeId === "dark") {
      root.classList.add("dark");
    }
    
    window.localStorage.setItem("admin-theme", themeId);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-navy px-6 py-4 text-white">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-gold" />
            <p className="font-serif text-xl font-black">Display Themes</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {THEMES.map((t) => {
              const Icon = t.icon;
              const isActive = activeTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => applyTheme(t.id)}
                  className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                    isActive 
                      ? "border-gold bg-gold/5 ring-1 ring-gold" 
                      : "border-border bg-background hover:border-gold/50"
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                    isActive ? "bg-gold text-gold-foreground border-gold" : "bg-secondary text-navy border-border group-hover:border-gold/30"
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold uppercase tracking-wider ${isActive ? "text-navy" : "text-muted-foreground"}`}>
                      {t.name}
                    </p>
                    <p className="text-[10px] font-semibold text-muted-foreground/80">
                      {t.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="rounded-full bg-gold p-1 text-gold-foreground">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl bg-secondary/50 p-4 border border-border/50">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-gold" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-navy">Theme Sync</p>
                <p className="mt-1 text-[10px] font-medium leading-relaxed text-muted-foreground">
                  Theme preferences are saved to your browser and will persist across sessions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-secondary/20 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-navy py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
