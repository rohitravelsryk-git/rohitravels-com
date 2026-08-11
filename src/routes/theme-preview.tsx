import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ShieldCheck, Zap, Globe, Sparkles, ArrowRight } from 'lucide-react';

export const Route = createFileRoute('/theme-preview')({
  head: () => ({
    meta: [
      { title: 'Premium Theme Previews — Rohi Travels' },
      { name: 'description', content: 'Compare premium website themes for Rohi International Travels.' },
      { property: 'og:title', content: 'Premium Theme Previews — Rohi Travels' },
      { property: 'og:description', content: 'Compare premium website themes for Rohi International Travels.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: ThemePreview,
});

function ThemePreview() {
  const [theme, setTheme] = useState<'heritage' | 'skyline' | 'terminal' | 'monarch' | 'glass'>('heritage');

  const themes = {
    heritage: {
      name: 'Elite Heritage',
      bg: 'bg-preview-heritage',
      accent: 'text-preview-heritage-accent',
      btn: 'bg-preview-heritage-accent text-preview-heritage',
      card: 'bg-preview-light/5 border-preview-light/10 text-preview-light',
      font: 'font-serif',
      desc: 'Classic Luxury, Gold Accents, Serif Typography'
    },
    skyline: {
      name: 'Cloud Nine',
      bg: 'bg-gradient-to-br from-blue-500 via-sky-400 to-indigo-500',
      accent: 'text-white shadow-[0_0_15px_rgba(255,255,255,0.5)]',
      btn: 'bg-white text-blue-600 shadow-xl',
      card: 'bg-white/20 backdrop-blur-lg border-white/30 text-white',
      font: 'font-sans',
      desc: 'Aerial Views, High Altitude, Bright & Airy'
    },
    terminal: {
      name: 'First Class Lounge',
      bg: 'bg-[#1a1c2c]',
      accent: 'text-[#ff79c6]',
      btn: 'bg-[#ff79c6] text-white shadow-[0_0_20px_rgba(255,121,198,0.4)]',
      card: 'bg-[#282a36]/50 border-[#44475a] text-[#f8f8f2]',
      font: 'font-mono',
      desc: 'Night Flights, Cyber-Luxe, High Contrast'
    },
    monarch: {
      name: 'Monarch Velvet',
      bg: 'bg-[oklch(0.18_0.03_260)]',
      accent: 'text-[oklch(0.82_0.09_30)]',
      btn: 'bg-[oklch(0.82_0.09_30)] text-white shadow-xl',
      card: 'bg-white/5 border-white/10 text-white',
      font: 'font-serif',
      desc: 'Deep Royal Blue, Crimson Accents, Majestic Feel'
    },
    glass: {
      name: 'Jetstream',
      bg: 'bg-white',
      accent: 'text-blue-700',
      btn: 'bg-blue-700 text-white shadow-lg',
      card: 'bg-slate-50 border-slate-200 text-slate-900',
      font: 'font-sans',
      desc: 'Precision, Clarity, Commercial Aviation Standard'
    }
  };

  const current = themes[theme];

  return (
    <div className={`min-h-screen transition-colors duration-700 ${current.bg} p-8 flex flex-col items-center justify-center`}>
      <div className="max-w-4xl w-full space-y-12">
        {/* Theme Switcher */}
        <div className="mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-full border border-preview-light/10 bg-preview-light/5 p-2 backdrop-blur-xl">
          {(Object.keys(themes) as Array<keyof typeof themes>).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                theme === t ? 'bg-preview-light text-preview-future shadow-lg' : 'text-preview-light/60 hover:text-preview-light'
              }`}
            >
              {themes[t].name}
            </button>
          ))}
        </div>

        {/* Preview Content */}
        <div className={`text-center space-y-6 ${current.font}`}>
          <div className="flex justify-center">
            <span className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${['organic', 'glass'].includes(theme) ? 'border-black/10 bg-black/5' : 'border-preview-light/20 bg-preview-light/5'} ${current.accent}`}>
              <Sparkles className="h-3 w-3" />
              {current.desc}
            </span>
          </div>
          
          <h1 className={`text-5xl md:text-7xl font-black tracking-tight ${['organic', 'glass'].includes(theme) ? 'text-slate-900' : 'text-preview-light'}`}>
            Rohi <span className={current.accent}>International</span><br />Travels
          </h1>
          
          <p className={`text-lg max-w-2xl mx-auto ${['organic', 'glass'].includes(theme) ? 'text-slate-600' : 'text-preview-light/60'}`}>
            Experience the pinnacle of travel luxury with our curated group fares and premium concierge services. Since 1991.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button className={`px-8 py-4 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 ${current.btn}`}>
              Explore Fares <ArrowRight className="h-4 w-4" />
            </button>
            <button className={`px-8 py-4 rounded-full font-bold border flex items-center gap-2 transition-colors ${['organic', 'glass'].includes(theme) ? 'border-slate-900/20 text-slate-900 hover:bg-slate-900/5' : 'border-preview-light/20 text-preview-light hover:bg-preview-light/5'}`}>
              Partner With Us
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, title: 'Secure Booking', text: 'Verified since 1991 with 100% safety record.' },
            { icon: Zap, title: 'Instant Sync', text: 'Real-time fare updates across all agent portals.' },
            { icon: Globe, title: 'Global Reach', text: 'Connecting you to the worlds most elite destinations.' }
          ].map((f, i) => (
            <div key={i} className={`p-6 rounded-3xl border transition-all hover:scale-[1.02] ${current.card}`}>
              <f.icon className={`h-8 w-8 mb-4 ${current.accent}`} />
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className="opacity-70 text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
