import React from 'react';
import { LayoutGrid, MessageSquare, Search, ChevronLeft } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { ThumbnailPanel } from './ThumbnailPanel';
import { AnnotationsPanel } from './AnnotationsPanel';
import { SearchPanel } from './SearchPanel';

export const SidebarNav: React.FC = () => {
  const { sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab } = usePDF();

  if (!sidebarOpen) return null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-950 transition-all select-none">
      {/* Sidebar Header Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-2 py-1.5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarTab('thumbnails')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
              sidebarTab === 'thumbnails'
                ? 'bg-orange-50 text-[#FF6600] dark:bg-orange-950/40'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Pages
          </button>
          <button
            onClick={() => setSidebarTab('annotations')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
              sidebarTab === 'annotations'
                ? 'bg-orange-50 text-[#FF6600] dark:bg-orange-950/40'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Notes
          </button>
          <button
            onClick={() => setSidebarTab('search')}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
              sidebarTab === 'search'
                ? 'bg-orange-50 text-[#FF6600] dark:bg-orange-950/40'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            <Search className="h-3.5 w-3.5" /> Find
          </button>
        </div>

        <button
          onClick={() => setSidebarOpen(false)}
          className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800"
          title="Collapse Sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === 'thumbnails' && <ThumbnailPanel />}
        {sidebarTab === 'annotations' && <AnnotationsPanel />}
        {sidebarTab === 'search' && <SearchPanel />}
      </div>
    </aside>
  );
};
