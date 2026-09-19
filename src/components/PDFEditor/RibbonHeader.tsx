import React from 'react';
import {
  FileText, Undo, Redo, ZoomIn, ZoomOut, Hand, MousePointer, Sun, Moon, Printer, Download,
  Type, Eraser, ShieldAlert, Highlighter, Underline, Strikethrough, PenTool, Square, Circle,
  Minus, ArrowRight, Stamp, CheckSquare, Layers, Eye, RotateCw, RotateCcw, Trash2, Plus, StickyNote, Lock, Search,
  ChevronDown, HelpCircle, SlidersHorizontal, Copy
} from 'lucide-react';
import { usePDF } from '@/context/PDFContext';
import { RibbonTab, StampType } from '@/types/pdf';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';

interface RibbonHeaderProps {
  onUploadPDF?: (file: File) => void;
  onPrint?: () => void;
  onSave?: () => void;
  bookingRef?: string;
}

export const RibbonHeader: React.FC<RibbonHeaderProps> = ({
  onUploadPDF,
  onPrint,
  onSave,
  bookingRef,
}) => {
  const {
    activeTab, setActiveTab,
    activeTool, setActiveTool,
    canUndo, canRedo, undo, redo,
    zoomScale, setZoomScale,
    isDarkMode, setIsDarkMode,
    sidebarOpen, setSidebarOpen,
    propertyPanelOpen, setPropertyPanelOpen,
    userRole,
    setIsSignatureModalOpen,
    activeStampType, setActiveStampType,
    rotatePage, currentPageIndex, deletePage,
    selectedAnnotationId, deleteAnnotation, annotations, addAnnotation,
  } = usePDF();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadPDF) onUploadPDF(file);
  };

  const handleDuplicateSelected = () => {
    const sel = annotations.find((a) => a.id === selectedAnnotationId);
    if (!sel) return;
    const { id, createdAt, ...rest } = sel;
    const clone = { ...rest } as typeof rest & { x?: number; y?: number };
    if ('x' in clone) clone.x = Math.min(90, clone.x + 3);
    if ('y' in clone) clone.y = Math.min(90, clone.y + 3);
    addAnnotation(clone);
  };

  const menuBtnCls =
    'rounded px-2.5 py-1 text-xs font-semibold text-gray-200 hover:bg-white/10 focus:outline-none data-[state=open]:bg-white/15';

  const tabs: { id: RibbonTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'edit', label: 'Edit' },
    { id: 'comment', label: 'Comment' },
    { id: 'organize', label: 'Organize' },
    { id: 'protect', label: 'Protect & Sign' },
    { id: 'view', label: 'View' },
    { id: 'form', label: 'Form' },
  ];

  const stamps: { type: StampType; label: string; colorCls: string }[] = [
    { type: 'APPROVED', label: 'APPROVED', colorCls: 'bg-emerald-600 text-white' },
    { type: 'CONFIDENTIAL', label: 'CONFIDENTIAL', colorCls: 'bg-rose-600 text-white' },
    { type: 'SIGN_HERE', label: 'SIGN HERE', colorCls: 'bg-[#FF6600] text-white' },
    { type: 'DRAFT', label: 'DRAFT', colorCls: 'bg-gray-600 text-white' },
    { type: 'ISSUED', label: 'ISSUED TICKET', colorCls: 'bg-blue-600 text-white' },
  ];

  return (
    <header className="select-none border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 transition-colors">
      {/* Classic Windows Menu Bar */}
      <div className="flex h-7 items-center gap-0.5 bg-gray-950 px-2">
        <DropdownMenu>
          <DropdownMenuTrigger className={menuBtnCls}>File</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            <DropdownMenuItem asChild>
              <label className="flex w-full cursor-pointer items-center justify-between">
                Open… <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
                <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
              </label>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {onSave && (
              <DropdownMenuItem onClick={onSave}>
                Save PDF <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
            {onPrint && (
              <DropdownMenuItem onClick={onPrint}>
                Print… <DropdownMenuShortcut>Ctrl+P</DropdownMenuShortcut>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={menuBtnCls}>Edit</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            <DropdownMenuItem onClick={undo} disabled={!canUndo}>
              Undo <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={redo} disabled={!canRedo}>
              Redo <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => selectedAnnotationId && deleteAnnotation(selectedAnnotationId)} disabled={!selectedAnnotationId}>
              Delete Selected <DropdownMenuShortcut>Del</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={menuBtnCls}>View</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[220px]">
            <DropdownMenuItem onClick={() => setSidebarOpen((s) => !s)}>
              {sidebarOpen ? 'Hide' : 'Show'} Navigation Panel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPropertyPanelOpen((s) => !s)}>
              {propertyPanelOpen ? 'Hide' : 'Show'} Property List
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setZoomScale((s) => Math.min(3, s + 0.15))}>
              Zoom In <DropdownMenuShortcut>Ctrl++</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.15))}>
              Zoom Out <DropdownMenuShortcut>Ctrl+-</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setZoomScale(1.0)}>Fit Width (100%)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsDarkMode((d) => !d)}>
              {isDarkMode ? 'Disable' : 'Enable'} Dark Mode
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={menuBtnCls}>Document</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            <DropdownMenuItem onClick={() => rotatePage(currentPageIndex, 'cw')}>Rotate Page 90° CW</DropdownMenuItem>
            <DropdownMenuItem onClick={() => rotatePage(currentPageIndex, 'ccw')}>Rotate Page 90° CCW</DropdownMenuItem>
            {userRole === 'admin' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => deletePage(currentPageIndex)} className="text-rose-600 focus:text-rose-600">
                  Delete Current Page
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={menuBtnCls}>Object</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            <DropdownMenuItem onClick={handleDuplicateSelected} disabled={!selectedAnnotationId}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => selectedAnnotationId && deleteAnnotation(selectedAnnotationId)} disabled={!selectedAnnotationId}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={menuBtnCls}>Tool</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[180px]">
            <DropdownMenuItem onClick={() => setActiveTool('select')}><MousePointer className="h-3.5 w-3.5" /> Select Object</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTool('hand')}><Hand className="h-3.5 w-3.5" /> Hand (Pan)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTool('text')}><Type className="h-3.5 w-3.5" /> Add Text</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTool('whiteout')}><Eraser className="h-3.5 w-3.5" /> Whiteout / Erase</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsSignatureModalOpen(true)}><PenTool className="h-3.5 w-3.5" /> Digital Signature</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={menuBtnCls}>Help</DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[220px]">
            <div className="px-2 py-1.5 text-[11px] leading-relaxed text-gray-500">
              Select original PDF text by dragging. Press Delete to cover selected text cleanly, or delete a selected added object. Drag handles resize objects.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Top Application Bar */}
      <div className="flex h-11 items-center justify-between border-b border-gray-200/80 bg-gray-900 px-4 text-white dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF6600] font-black text-white text-xs">R</span>
            <span className="font-serif text-sm font-black tracking-wide text-white">ROHI TICKET EDITOR</span>
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF6600]">DESKTOP</span>
          </div>
          {bookingRef && (
            <span className="border-l border-gray-700 pl-3 font-mono text-xs text-gray-300">
              Ticket Ref: <strong className="text-orange-400">{bookingRef}</strong>
            </span>
          )}
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="rounded p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-40"
          >
            <Redo className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-gray-700 mx-1" />
          <button
            onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.15))}
            title="Zoom Out"
            className="rounded p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center font-mono text-xs text-gray-300">{Math.round(zoomScale * 100)}%</span>
          <button
            onClick={() => setZoomScale((s) => Math.min(3, s + 0.15))}
            title="Zoom In"
            className="rounded p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-gray-700 mx-1" />
          <button
            onClick={() => setIsDarkMode((d) => !d)}
            title="Toggle Dark Mode"
            className="rounded p-1.5 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {onPrint && (
            <button
              onClick={onPrint}
              className="ml-2 inline-flex items-center gap-1.5 rounded bg-gray-800 px-3 py-1 text-xs font-bold text-white hover:bg-gray-700"
            >
              <Printer className="h-3.5 w-3.5 text-orange-400" /> Print Ticket
            </button>
          )}

          {onSave && (
            <button
              onClick={onSave}
              className="inline-flex items-center gap-1.5 rounded bg-[#FF6600] px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#e05500]"
            >
              <Download className="h-3.5 w-3.5" /> Save PDF
            </button>
          )}
        </div>
      </div>

      {/* Ribbon Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-100/80 px-2 dark:border-gray-800 dark:bg-gray-950">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold transition-colors ${
              activeTab === tab.id
                ? 'border-b-2 border-[#FF6600] text-[#FF6600] bg-white dark:bg-gray-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar Controls Ribbon Panel */}
      <div className="flex flex-wrap items-center gap-2 bg-white px-4 py-2 dark:bg-gray-900 min-h-[52px]">
        {activeTab === 'home' && (
          <>
            <div className="flex items-center gap-1 border-r border-gray-200 pr-3 dark:border-gray-800">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <FileText className="h-3.5 w-3.5 text-[#FF6600]" /> Open PDF
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            <div className="flex items-center gap-1 border-r border-gray-200 pr-3 dark:border-gray-800">
              <button
                onClick={() => setActiveTool('select')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  activeTool === 'select' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <MousePointer className="h-3.5 w-3.5" /> Select
              </button>
              <button
                onClick={() => setActiveTool('hand')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  activeTool === 'hand' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <Hand className="h-3.5 w-3.5" /> Hand
              </button>
            </div>

            <div className="flex items-center gap-1 border-r border-gray-200 pr-3 dark:border-gray-800">
              <button
                onClick={() => setActiveTool('text')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  activeTool === 'text' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <Type className="h-3.5 w-3.5" /> Add Text
              </button>
              <button
                onClick={() => setActiveTool('whiteout')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  activeTool === 'whiteout' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <Eraser className="h-3.5 w-3.5" /> Whiteout / Erase
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSignatureModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-1.5 text-xs font-bold text-[#FF6600] border border-orange-500/30 hover:bg-orange-500/20"
              >
                <PenTool className="h-3.5 w-3.5" /> Digital Signature
              </button>
            </div>
          </>
        )}

        {activeTab === 'edit' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTool('text')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'text' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Type className="h-3.5 w-3.5" /> Add Text Box
            </button>
            <button
              onClick={() => setActiveTool('whiteout')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'whiteout' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Eraser className="h-3.5 w-3.5 text-rose-500" /> Whiteout Area
            </button>

            {userRole === 'admin' && (
              <button
                onClick={() => setActiveTool('redact')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  activeTool === 'redact' ? 'bg-black text-white' : 'bg-gray-900 text-gray-200 hover:bg-black'
                }`}
              >
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> Blackout Redact
              </button>
            )}
          </div>
        )}

        {activeTab === 'comment' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTool('highlight')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'highlight' ? 'bg-[#FF6600] text-white' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
              }`}
            >
              <Highlighter className="h-3.5 w-3.5" /> Highlight
            </button>
            <button
              onClick={() => setActiveTool('underline')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'underline' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Underline className="h-3.5 w-3.5" /> Underline
            </button>
            <button
              onClick={() => setActiveTool('strikethrough')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'strikethrough' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Strikethrough className="h-3.5 w-3.5" /> Strikethrough
            </button>
            <button
              onClick={() => setActiveTool('pen')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'pen' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <PenTool className="h-3.5 w-3.5" /> Freehand Pen
            </button>
            <button
              onClick={() => setActiveTool('rectangle')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'rectangle' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Square className="h-3.5 w-3.5" /> Rectangle
            </button>
            <button
              onClick={() => setActiveTool('circle')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'circle' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Circle className="h-3.5 w-3.5" /> Circle
            </button>
            <button onClick={() => setActiveTool('line')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${activeTool === 'line' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>
              <Minus className="h-3.5 w-3.5" /> Line
            </button>
            <button onClick={() => setActiveTool('arrow')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${activeTool === 'arrow' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>
              <ArrowRight className="h-3.5 w-3.5" /> Arrow
            </button>
            <button onClick={() => setActiveTool('sticky')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${activeTool === 'sticky' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>
              <StickyNote className="h-3.5 w-3.5" /> Note
            </button>

            {/* Stamps Selection */}
            <div className="flex items-center gap-1 border-l border-gray-200 pl-2 dark:border-gray-800">
              <span className="text-[10px] font-bold text-gray-400">STAMP:</span>
              {stamps.map((st) => (
                <button
                  key={st.type}
                  onClick={() => {
                    setActiveStampType(st.type);
                    setActiveTool('stamp');
                  }}
                  className={`rounded px-2 py-1 text-[10px] font-black uppercase ${st.colorCls} ${
                    activeTool === 'stamp' && activeStampType === st.type ? 'ring-2 ring-orange-500 scale-105' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'organize' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => rotatePage(currentPageIndex, 'cw')}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#FF6600]" /> Rotate 90° CW
            </button>
            <button
              onClick={() => rotatePage(currentPageIndex, 'ccw')}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#FF6600]" /> Rotate 90° CCW
            </button>

            {userRole === 'admin' && (
              <button
                onClick={() => deletePage(currentPageIndex)}
                className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Current Page
              </button>
            )}
          </div>
        )}

        {activeTab === 'protect' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSignatureModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-[#FF6600] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs"
            >
              <PenTool className="h-3.5 w-3.5" /> Add Signature
            </button>
            {userRole === 'admin' && (
              <button
                onClick={() => setActiveTool('redact')}
                className="flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-bold text-white shadow-xs"
              >
                <Lock className="h-3.5 w-3.5 text-rose-400" /> Redact Sensitive Prices
              </button>
            )}
          </div>
        )}

        {activeTab === 'view' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <Layers className="h-3.5 w-3.5" /> Toggle Sidebar
            </button>
            <button
              onClick={() => setZoomScale(1.0)}
              className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              Fit Width (100%)
            </button>
          </div>
        )}

        {activeTab === 'form' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTool('form_text')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'form_text' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <Type className="h-3.5 w-3.5" /> Form Text Input
            </button>
            <button
              onClick={() => setActiveTool('form_checkbox')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                activeTool === 'form_checkbox' ? 'bg-[#FF6600] text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" /> Form Checkbox
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
