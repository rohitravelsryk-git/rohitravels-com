// '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
// 
// still showing in admin panel`}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 rounded-2xl border border-navy/10 bg-white p-2 shadow-sm">
          <span className="pl-4 text-[10px] font-black uppercase tracking-widest text-navy/40">Portal Status</span>
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
              isEnabled 
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" 
                : "bg-gray-100 text-gray-400 shadow-none"
            }`}
          >
            {isEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {isEnabled ? "Publicly Visible" : "Hidden"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-navy/10 bg-white p-8 shadow-2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy">
              Note Content
            </label>
            <span className="text-[10px] font-bold text-navy italic">
              Supports multi-line text and credentials
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-64 w-full rounded-xl border border-navy/20 bg-white p-5 font-mono text-sm leading-relaxed text-navy outline-none focus:border-gold focus:ring-4 focus:ring-gold/10"
            placeholder="Enter login IDs, passwords, and special instructions here..."
          />
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-4 text-xs font-bold text-navy">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                {isEnabled ? "Live in Agent Portal" : "Hidden from Agents"}
              </div>
              <span>Last updated: {note?.updated_at ? new Date(note.updated_at).toLocaleString() : "Never"}</span>
            </div>
            <button
              onClick={handleSave}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-navy px-8 py-3 text-sm font-bold text-white shadow-lg shadow-navy/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-gold/20 bg-gold/5 p-6">
        <Info className="mt-1 h-5 w-5 text-gold" />
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-navy">Quick Usage Guide</h4>
          <p className="mt-1 text-xs font-bold text-navy leading-relaxed">
            1. Use the toggle above to instantly show or hide this section in all B2B portals.<br />
            2. When enabled, this content appears in a dedicated "Sticky Notes" tab in all B2B agent portals.<br />
            3. Changes are synced in real-time. Use it for sharing high-priority airline updates or rotating passwords.
          </p>
        </div>
      </div>
    </div>
  );
}
