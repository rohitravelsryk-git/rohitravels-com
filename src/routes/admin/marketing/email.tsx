import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Mail, Send, Users, Layout, Eye, Search, Filter, Plus, ChevronRight, BarChart, Settings, MailOpen, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/admin/marketing/email')({
  component: EmailMarketingPage,
})

const TEMPLATES = [
  {
    id: '1',
    name: 'Flash Sale Inventory',
    description: 'Showcase available group seats with countdown timer.',
    subject: 'Flash Sale: Limited seats available for Jeddah/Madina!',
    thumbnail: 'https://images.unsplash.com/photo-1544333346-64547289045e?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: '2',
    name: 'Weekly B2B Newsletter',
    description: 'Roundup of top fares and industry news for agents.',
    subject: 'Your Weekly B2B Roundup from Rohi Travels',
    thumbnail: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: '3',
    name: 'New Destination Alert',
    description: 'High-impact announcement for new flight routes.',
    subject: 'New Routes Added: Now flying to Dammam & Riyadh!',
    thumbnail: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=400&q=80'
  }
]

function EmailMarketingPage() {
  const [step, setStep] = useState<'overview' | 'compose'>('overview')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-navy">Email Marketing</h1>
          <p className="text-muted-foreground">Reach your agents with professional email campaigns.</p>
        </div>
        <button 
          onClick={() => setStep('compose')}
          className="inline-flex items-center gap-2 rounded-full bg-navy px-6 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-all"
        >
          <Plus className="h-4 w-4" /> Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Grid */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Total Subscribers" value="1,284" icon={Users} color="text-blue-600" />
            <StatCard title="Avg. Open Rate" value="32.4%" icon={MailOpen} color="text-emerald-600" />
            <StatCard title="Click-Through" value="12.8%" icon={BarChart} color="text-orange-600" />
          </div>

          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="border-b border-border bg-secondary/30 px-6 py-4 flex items-center justify-between">
              <h2 className="font-bold text-navy flex items-center gap-2">
                <Layout className="h-4 w-4" /> Recommended Templates
              </h2>
              <button className="text-xs font-bold text-gold uppercase tracking-widest hover:underline">View All</button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {TEMPLATES.map((tpl) => (
                <div key={tpl.id} className="group cursor-pointer" onClick={() => { setSelectedTemplate(tpl.id); setStep('compose'); }}>
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border mb-3">
                    <img src={tpl.thumbnail} alt={tpl.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-navy/0 group-hover:bg-navy/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-white text-navy px-4 py-2 rounded-lg font-bold text-sm shadow-xl">Use Template</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-navy text-sm mb-1">{tpl.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="border-b border-border bg-secondary/30 px-6 py-4">
              <h2 className="font-bold text-navy">Recent Campaigns</h2>
            </div>
            <div className="divide-y divide-border">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-navy">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-navy text-sm">March Inventory Update #0{i}</p>
                      <p className="text-xs text-muted-foreground">Sent to 1,200 agents • 2 days ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-navy text-sm">42%</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-black">Open Rate</p>
                    </div>
                    <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-navy rounded-2xl p-6 text-white">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4" /> Quick Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-widest block mb-2">Sender Name</label>
                <input type="text" defaultValue="Rohi Travels B2B" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
              </div>
              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-widest block mb-2">Reply-To Email</label>
                <input type="text" defaultValue="noreply@email.rohitravels.com" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold" />
              </div>
            </div>
          </div>

          <div className="bg-gold/10 border border-gold/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 text-gold-foreground mb-3 font-bold">
              <AlertCircle className="h-4 w-4" />
              <span>Did you know?</span>
            </div>
            <p className="text-sm text-navy/80 leading-relaxed">
              Segmented campaigns have a <span className="font-bold">14% higher</span> open rate. Try sending specific deals to regional agents.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className="text-2xl font-black text-navy">{value}</p>
    </div>
  )
}
