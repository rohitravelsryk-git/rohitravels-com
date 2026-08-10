import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Search, Filter, Calendar, Clock, MessageSquare, Image as ImageIcon, Video, Trash2, Edit3, Plus, ChevronRight } from 'lucide-react'

export const Route = createFileRoute('/latest-updates/')({
  component: LatestUpdatesPage,
})

type UpdateType = 'text' | 'image' | 'video'

interface Update {
  id: string
  type: UpdateType
  title: string
  content: string
  date: string
  mediaUrl?: string
}

const MOCK_UPDATES: Update[] = [
  {
    id: '1',
    type: 'text',
    title: 'New Jeddah Routes',
    content: 'We have added 5 new daily flights to Jeddah starting next week. Book now for early bird discounts.',
    date: '2024-03-20',
  },
  {
    id: '2',
    type: 'image',
    title: 'New Office Launch',
    content: 'Glimpses from our new branch opening in Karachi.',
    date: '2024-03-18',
    mediaUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: '3',
    type: 'video',
    title: 'Umrah 2024 Guide',
    content: 'Watch our comprehensive guide for Umrah 2024 travelers.',
    date: '2024-03-15',
    mediaUrl: 'https://example.com/video-thumb.jpg',
  }
]

function LatestUpdatesPage() {
  const [activeTab, setActiveTab] = useState<'all' | UpdateType>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredUpdates = MOCK_UPDATES.filter(update => {
    const matchesTab = activeTab === 'all' || update.type === activeTab
    const matchesSearch = update.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          update.content.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-navy py-12 text-center text-white">
        <h1 className="font-serif text-4xl font-bold md:text-5xl">Latest Updates</h1>
        <p className="mt-4 text-gold/80 font-medium tracking-wide">Stay informed with the latest news and media from Rohi Travels</p>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Controls */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2 p-1 bg-secondary rounded-xl">
            {(['all', 'text', 'image', 'video'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                  activeTab === tab 
                    ? 'bg-white text-navy shadow-sm' 
                    : 'text-muted-foreground hover:text-navy'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search updates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-border rounded-xl w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold"
            />
          </div>
        </div>

        {/* Updates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUpdates.map((update) => (
            <div key={update.id} className="group flex flex-col bg-white rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all duration-300">
              {update.type !== 'text' && (
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={update.mediaUrl} 
                    alt={update.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {update.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center text-navy shadow-lg">
                        <Video className="h-6 w-6 fill-current" />
                      </div>
                    </div>
                  )}
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-white/90 backdrop-blur rounded-full text-[10px] font-black uppercase tracking-widest text-navy shadow-sm">
                      {update.type}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-3">
                  <Calendar className="h-3.5 w-3.5" />
                  {update.date}
                </div>
                <h3 className="font-serif text-xl font-bold text-navy mb-2 group-hover:text-gold transition-colors">
                  {update.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                  {update.content}
                </p>
                <div className="mt-auto pt-4 border-t border-secondary">
                  <button className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy hover:text-gold transition-colors">
                    Read More <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredUpdates.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-navy">No updates found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
