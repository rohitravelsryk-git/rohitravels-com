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
  const [theme, setTheme] = useState<'heritage' | 'futuristic' | 'organic'>('heritage');

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
    futuristic: {
      name: 'Futuristic Glass',
      bg: 'bg-preview-future',
      accent: 'text-preview-future-accent',
      btn: 'bg-preview-future-accent text-preview-future shadow-preview-glow',
      card: 'bg-preview-light/10 backdrop-blur-md border-preview-light/20 text-preview-light',
      font: 'font-sans',
      desc: 'Matte Black, Electric Cyan, Neon Glows'
    },
    organic: {
      name: 'Organic Nomad',
      bg: 'bg-preview-organic',
      accent: 'text-preview-organic-accent',
      btn: 'bg-preview-organic-accent text-preview-light',
      card: 'bg-preview-light border-preview-organic-border text-preview-organic-ink',
      font: 'font-sans',
      desc: 'Warm Sand, Terracotta, Natural Textures'
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
            <span className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${theme === 'organic' ? 'border-preview-organic-accent/20 bg-preview-organic-accent/5' : 'border-preview-light/20 bg-preview-light/5'} ${current.accent}`}>
              <Sparkles className="h-3 w-3" />
              {current.desc}
            </span>
          </div>
          
          <h1 className={`text-5xl md:text-7xl font-black tracking-tight ${theme === 'organic' ? 'text-preview-organic-ink' : 'text-preview-light'}`}>
            Rohi <span className={current.accent}>International</span><br />Travels
          </h1>
          
          <p className={`text-lg max-w-2xl mx-auto ${theme === 'organic' ? 'text-preview-organic-ink/80' : 'text-preview-light/60'}`}>
            Experience the pinnacle of travel luxury with our curated group fares and premium concierge services. Since 1991.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button className={`px-8 py-4 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 ${current.btn}`}>
              Explore Fares <ArrowRight className="h-4 w-4" />
            </button>
            <button className={`px-8 py-4 rounded-full font-bold border flex items-center gap-2 transition-colors ${theme === 'organic' ? 'border-preview-organic-ink/20 text-preview-organic-ink hover:bg-preview-organic-ink/5' : 'border-preview-light/20 text-preview-light hover:bg-preview-light/5'}`}>
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
