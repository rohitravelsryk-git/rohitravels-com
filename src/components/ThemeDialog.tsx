import { useState, useEffect } from "react";
2: import { Check, X, Palette, Sun, Moon, Newspaper, Sparkles } from "lucide-react";
3: 
4: type ThemeOption = {
5:   id: string;
6:   name: string;
7:   icon: React.ComponentType<{ className?: string }>;
8:   description: string;
9: };
10: 
11: const THEMES: ThemeOption[] = [
12:   { id: "light", name: "Modern Light", icon: Sun, description: "Clean, professional white aesthetic" },
13:   { id: "dark", name: "Midnight Navy", icon: Moon, description: "Premium dark theme with gold accents" },
14:   { id: "paper", name: "Paper Ledger", icon: Newspaper, description: "Classic accounting ledger feel" },
15: ];
16: 
17: export function ThemeDialog({ onClose }: { onClose: () => void }) {
18:   const [activeTheme, setActiveTheme] = useState<string>(() => {
19:     if (typeof window === "undefined") return "light";
20:     return document.documentElement.classList.contains("dark") 
21:       ? "dark" 
22:       : window.localStorage.getItem("admin-theme") || "light";
23:   });
24: 
25:   const applyTheme = (themeId: string) => {
26:     setActiveTheme(themeId);
27:     if (typeof window === "undefined") return;
28: 
29:     const root = document.documentElement;
30:     root.classList.remove("dark");
31:     // Remove any paper-ledger specific classes if they exist in global CSS
32:     // For now we primarily handle dark/light via Tailwind's .dark class
33:     
34:     if (themeId === "dark") {
35:       root.classList.add("dark");
36:     }
37:     
38:     window.localStorage.setItem("admin-theme", themeId);
39:   };
40: 
41:   return (
42:     <div className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm" onClick={onClose}>
43:       <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-border animate-fade-up" onClick={(e) => e.stopPropagation()}>
44:         <div className="flex items-center justify-between bg-navy px-6 py-4 text-white">
45:           <div className="flex items-center gap-2">
46:             <Palette className="h-5 w-5 text-gold" />
47:             <p className="font-serif text-xl font-black">Display Themes</p>
48:           </div>
49:           <button onClick={onClose} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
50:             <X className="h-4 w-4" />
51:           </button>
52:         </div>
53: 
54:         <div className="p-6">
55:           <div className="space-y-3">
56:             {THEMES.map((t) => {
57:               const Icon = t.icon;
58:               const isActive = activeTheme === t.id;
59:               return (
60:                 <button
61:                   key={t.id}
62:                   onClick={() => applyTheme(t.id)}
63:                   className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
64:                     isActive 
65:                       ? "border-gold bg-gold/5 ring-1 ring-gold" 
66:                       : "border-border bg-background hover:border-gold/50"
67:                   }`}
68:                 >
69:                   <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
70:                     isActive ? "bg-gold text-gold-foreground border-gold" : "bg-secondary text-navy border-border group-hover:border-gold/30"
71:                   }`}>
72:                     <Icon className="h-5 w-5" />
73:                   </div>
74:                   <div className="flex-1">
75:                     <p className={`text-sm font-bold uppercase tracking-wider ${isActive ? "text-navy" : "text-muted-foreground"}`}>
76:                       {t.name}
77:                     </p>
78:                     <p className="text-[10px] font-semibold text-muted-foreground/80">
79:                       {t.description}
80:                     </p>
81:                   </div>
82:                   {isActive && (
83:                     <div className="rounded-full bg-gold p-1 text-gold-foreground">
84:                       <Check className="h-3 w-3" />
85:                     </div>
86:                   )}
87:                 </button>
88:               );
89:             })}
90:           </div>
91: 
92:           <div className="mt-6 rounded-xl bg-secondary/50 p-4 border border-border/50">
93:             <div className="flex items-start gap-3">
94:               <Sparkles className="mt-0.5 h-4 w-4 text-gold" />
95:               <div>
96:                 <p className="text-[11px] font-bold uppercase tracking-widest text-navy">Theme Sync</p>
97:                 <p className="mt-1 text-[10px] font-medium leading-relaxed text-muted-foreground">
98:                   Theme preferences are saved to your browser and will persist across sessions.
99:                 </p>
100:               </div>
101:             </div>
102:           </div>
103:         </div>
104: 
105:         <div className="border-t border-border bg-secondary/20 px-6 py-4">
106:           <button
107:             onClick={onClose}
108:             className="w-full rounded-lg bg-navy py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90"
109:           >
110:             Done
111:           </button>
112:         </div>
113:       </div>
114:     </div>
115:   );
116: }
