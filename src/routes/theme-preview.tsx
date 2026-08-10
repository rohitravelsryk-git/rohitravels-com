import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ShieldCheck, Phone, Zap, Globe, Sparkles, ArrowRight } from 'lucide-react';

export const Route = createFileRoute('/theme-preview')({
  component: ThemePreview,
});

function ThemePreview() {
  const [theme, setTheme] = useState<'heritage' | 'futuristic' | 'organic'>('heritage');

  const themes = {
    heritage: {
      name: 'Elite Heritage',
      bg: 'bg-[#0f172a]',
      accent: 'text-[#b8860b]',
      btn: 'bg-[#b8860b] text-[#0f172a]',
      card: 'bg-white/5 border-white/10 text-white',
      font: 'font-serif',
      desc: 'Classic Luxury, Gold Accents, Serif Typography'
    },
    futuristic: {
      name: 'Futuristic Glass',
      bg: 'bg-black',
      accent: 'text-cyan-400',
      btn: 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.5)]',
      card: 'bg-white/10 backdrop-blur-md border-white/20 text-white',
      font: 'font-sans',
      desc: 'Matte Black, Electric Cyan, Neon Glows'
    },
    organic: {
      name: 'Organic Nomad',
      bg: 'bg-[#fdfcf0]',
      accent: 'text-[#c2410c]',
      btn: 'bg-[#c2410c] text-white',
      card: 'bg-white border-[#e7e5d1] text-[#78350f]',
      font: 'font-sans',
      desc: 'Warm Sand, Terracotta, Natural Textures'
    }
  };

  const current = themes[theme];

  return (
    <div className={`min-h-screen transition-colors duration-700 ${current.bg} p-8 flex flex-col items-center justify-center`}>
      <div className="max-w-4xl w-full space-y-12">
        {/* Theme Switcher */}
        <div className="flex justify-center gap-4 bg-white/5 p-2 rounded-full backdrop-blur-xl border border-white/10 w-fit mx-auto">
          {(Object.keys(themes) as Array<keyof typeof themes>).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                theme === t ? 'bg-white text-black shadow-lg' : 'text-white/60 hover:text-white'
              }`}
            >
              {themes[t].name}
            </button>
          ))}
        </div>

        {/* Preview Content */}
        <div className={`text-center space-y-6 ${current.font}`}>
          <div className="flex justify-center">
            <span className={`inline-flex items-center gap-2 px-4 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${theme === 'organic' ? 'border-[#c2410c]/20 bg-[#c2410c]/5' : 'border-white/20 bg-white/5'} ${current.accent}`}>
              <Sparkles className="h-3 w-3" />
              {current.desc}
            </span>
          </div>
          
          <h1 className={`text-5xl md:text-7xl font-black tracking-tight ${theme === 'organic' ? 'text-[#78350f]' : 'text-white'}`}>
            Rohi <span className={current.accent}>International</span><br />Travels
          </h1>
          
          <p className={`text-lg max-w-2xl mx-auto ${theme === 'organic' ? 'text-[#78350f]/80' : 'text-white/60'}`}>
            Experience the pinnacle of travel luxury with our curated group fares and premium concierge services. Since 1991.
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button className={`px-8 py-4 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 ${current.btn}`}>
              Explore Fares <ArrowRight className="h-4 w-4" />
            </button>
            <button className={`px-8 py-4 rounded-full font-bold border flex items-center gap-2 transition-colors ${theme === 'organic' ? 'border-[#78350f]/20 text-[#78350f] hover:bg-[#78350f]/5' : 'border-white/20 text-white hover:bg-white/5'}`}>
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
