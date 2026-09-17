import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { searchPDFText, SearchResult } from '@/utils/pdfHelpers';

export const SearchPanel: React.FC = () => {
  const { pdfDoc, setCurrentPageIndex } = usePDF();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfDoc || !query.trim()) return;
    setSearching(true);
    try {
      const res = await searchPDFText(pdfDoc, query);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <form onSubmit={handleSearch} className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text in document..."
            className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-xs text-gray-900 outline-none focus:border-[#FF6600] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="rounded-lg bg-[#FF6600] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#e05500] disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Find'}
        </button>
      </form>

      <div className="flex flex-col gap-2 max-h-[calc(100vh-230px)] overflow-y-auto">
        {results.map((res, i) => (
          <div
            key={i}
            onClick={() => setCurrentPageIndex(res.pageIndex)}
            className="flex flex-col rounded-lg border border-gray-200 bg-white p-2.5 cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <span className="text-[10px] font-bold text-[#FF6600]">Page {res.pageIndex + 1}</span>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 font-mono text-[11px] leading-relaxed">
              ...{res.text}...
            </p>
          </div>
        ))}

        {!searching && query && results.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-400">No matches found for "{query}"</div>
        )}
      </div>
    </div>
  );
};
