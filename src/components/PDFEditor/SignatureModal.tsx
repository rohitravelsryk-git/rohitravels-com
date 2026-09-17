import React, { useRef, useState } from 'react';
import { X, PenTool, Type, Upload, Check } from 'lucide-react';
import { usePDF } from '@/context/PDFContext';

export const SignatureModal: React.FC = () => {
  const { isSignatureModalOpen, setIsSignatureModalOpen, addAnnotation, currentPageIndex, setActiveTool } = usePDF();
  const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedName, setTypedName] = useState('Rohi Travels Authorized');
  const [selectedFont, setSelectedFont] = useState<'cursive' | 'serif' | 'sans'>('cursive');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  if (!isSignatureModalOpen) return null;

  // Canvas drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1E293B';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleApplySignature = (dataUrl: string) => {
    addAnnotation({
      pageIndex: currentPageIndex,
      type: 'signature',
      imageDataUrl: dataUrl,
      x: 35,
      y: 70,
      width: 30,
      height: 12,
    });
    setIsSignatureModalOpen(false);
    setActiveTool('select');
  };

  const handleSaveDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    handleApplySignature(canvas.toDataURL('image/png'));
  };

  const handleSaveType = () => {
    if (!typedName.trim()) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400;
    tempCanvas.height = 100;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 400, 100);
    ctx.fillStyle = '#1E293B';
    ctx.font = selectedFont === 'cursive' ? 'italic 36px "Brush Script MT", cursive' : selectedFont === 'serif' ? 'bold 30px Georgia, serif' : 'bold 28px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, 200, 50);
    handleApplySignature(tempCanvas.toDataURL('image/png'));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const res = evt.target?.result;
      if (typeof res === 'string') {
        handleApplySignature(res);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-[#FF6600]" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Create Digital Signature</h3>
          </div>
          <button onClick={() => setIsSignatureModalOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/50">
          <button
            onClick={() => setActiveTab('draw')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
              activeTab === 'draw'
                ? 'border-b-2 border-[#FF6600] text-[#FF6600] bg-white dark:bg-gray-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            <PenTool className="h-4 w-4" /> Draw
          </button>
          <button
            onClick={() => setActiveTab('type')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
              activeTab === 'type'
                ? 'border-b-2 border-[#FF6600] text-[#FF6600] bg-white dark:bg-gray-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            <Type className="h-4 w-4" /> Type Cursive
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${
              activeTab === 'upload'
                ? 'border-b-2 border-[#FF6600] text-[#FF6600] bg-white dark:bg-gray-900'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'
            }`}
          >
            <Upload className="h-4 w-4" /> Upload Image
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'draw' && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Draw your signature inside the box below:</p>
              <div className="relative rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                <canvas
                  ref={canvasRef}
                  width={440}
                  height={140}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  className="w-full cursor-crosshair touch-none"
                />
                {!hasDrawn && (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                    Sign here with your mouse or stylus
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button onClick={clearCanvas} className="text-xs font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                  Clear Canvas
                </button>
                <button
                  disabled={!hasDrawn}
                  onClick={handleSaveDraw}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6600] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#e05500] disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Place Signature
                </button>
              </div>
            </div>
          )}

          {activeTab === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">Name / Title</label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#FF6600] focus:ring-1 focus:ring-[#FF6600] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700 dark:text-gray-300">Font Style</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedFont('cursive')}
                    className={`rounded-lg border p-3 text-center text-sm font-serif italic ${
                      selectedFont === 'cursive' ? 'border-[#FF6600] bg-orange-50 text-[#FF6600] dark:bg-orange-950/40' : 'border-gray-200 text-gray-700 dark:border-gray-800 dark:text-gray-300'
                    }`}
                  >
                    Cursive
                  </button>
                  <button
                    onClick={() => setSelectedFont('serif')}
                    className={`rounded-lg border p-3 text-center text-sm font-serif font-bold ${
                      selectedFont === 'serif' ? 'border-[#FF6600] bg-orange-50 text-[#FF6600] dark:bg-orange-950/40' : 'border-gray-200 text-gray-700 dark:border-gray-800 dark:text-gray-300'
                    }`}
                  >
                    Formal Serif
                  </button>
                  <button
                    onClick={() => setSelectedFont('sans')}
                    className={`rounded-lg border p-3 text-center text-sm font-sans font-bold ${
                      selectedFont === 'sans' ? 'border-[#FF6600] bg-orange-50 text-[#FF6600] dark:bg-orange-950/40' : 'border-gray-200 text-gray-700 dark:border-gray-800 dark:text-gray-300'
                    }`}
                  >
                    Sans Clean
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveType}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6600] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#e05500]"
                >
                  <Check className="h-4 w-4" /> Place Signature
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="text-center py-6">
              <label className="flex flex-col items-center justify-center cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50">
                <Upload className="mb-2 h-8 w-8 text-[#FF6600]" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Click to upload signature image file</span>
                <span className="mt-1 text-[10px] text-gray-400">PNG, JPG, SVG up to 5MB</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
