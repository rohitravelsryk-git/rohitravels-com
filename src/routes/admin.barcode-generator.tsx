import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { Copy, Save, Trash2, QrCode, Barcode as BarcodeIcon, ShieldCheck, Download } from "lucide-react";
import { AdminTabs } from "@/components/AdminTabs";
import { useQuery } from "@tanstack/react-query";
import { checkAdminUnlocked } from "@/lib/fares.functions";
import { toast } from "sonner";
import { toPng } from 'html-to-image';

export const Route = createFileRoute("/admin/barcode-generator")({
  component: BarcodeQRGenerator,
});

function BarcodeQRGenerator() {
  const { data: status, isLoading } = useQuery({
    queryKey: ["admin", "status"],
    queryFn: () => checkAdminUnlocked(),
  });
  
  const [text, setText] = useState("GROUP TICKET");
  const [nadraData, setNadraData] = useState({
    name: "Ghulam Mustafa",
    certNo: "OB91460592040",
    cnic: "4510106253925",
    vaccineDate: "17-01-2025",
    passportNo: "",
  });

  const barcodeRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const qrRef = useRef<HTMLDivElement>(null);

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  if (!status?.unlocked) return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-4">
      <div className="text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-navy/20" />
        <h2 className="mt-4 font-serif text-xl font-bold text-navy">Access Restricted</h2>
        <p className="mt-2 text-sm text-navy/60">Please login to the admin panel first.</p>
      </div>
    </div>
  );

  const qrLink = `https://nims.nadra.gov.pk/nims/certificateinfo?ep= Name: ${nadraData.name} Certificate No: ${nadraData.certNo} CNIC Number ${nadraData.cnic} Vaccine Date: ${nadraData.vaccineDate} Passport No: ${nadraData.passportNo}`;

  const copyImage = async (ref: React.RefObject<HTMLDivElement | null>, label: string) => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, { quality: 1.0, pixelRatio: 3, backgroundColor: 'white' });
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      toast.success(`${label} copied to clipboard as HD image!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy image");
    }
  };

  const downloadImage = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, { quality: 1.0, pixelRatio: 3, backgroundColor: 'white' });
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(`${filename} saved!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save image");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <div className="bg-navy pt-6 shadow-lg">
        <AdminTabs staffTabs={status.staffTabs} panelRole={status.staffUsername ? "staff" : "admin"} />
      </div>
      <div className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-serif text-3xl font-black text-navy uppercase tracking-tighter">HD Code Studio</h1>
            <p className="text-sm text-navy/60 font-medium">Generate professional HD QR & Barcodes with instant copy</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Section 1: Ticket Barcode Variations */}
          <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="bg-[#8cc63f] px-6 py-4 text-center text-white font-bold text-xl uppercase tracking-widest">
              Multi-Format Barcodes
            </div>
            <div className="p-6 space-y-6 flex-1">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/40">Reference Text</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-xl border border-border bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#8cc63f]/20 transition-all"
                  placeholder="Enter text..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                {[
                  { label: "Standard Code128", props: { format: "CODE128" as const, width: 2, height: 60 } },
                  { label: "Compact EAN-8", props: { format: "EAN8" as const, width: 2, height: 60 } },
                  { label: "High Density", props: { format: "CODE128" as const, width: 1.2, height: 80, fontSize: 10 } },
                  { label: "Wide Display", props: { format: "CODE128" as const, width: 3, height: 50 } }
                ].map((type, idx) => (
                  <div key={idx} className="group relative rounded-xl border border-slate-100 bg-slate-50/50 p-6 transition-all hover:border-[#8cc63f]/30 hover:bg-white hover:shadow-md">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-navy/40 uppercase tracking-wider">{type.label}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => copyImage(barcodeRefs[idx], type.label)}
                          className="p-1.5 rounded-md bg-white border border-border hover:bg-[#8cc63f] hover:text-white transition-colors"
                          title="Copy as HD Image"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => downloadImage(barcodeRefs[idx], `barcode-${idx}`)}
                          className="p-1.5 rounded-md bg-white border border-border hover:bg-navy hover:text-white transition-colors"
                          title="Download HD"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-center bg-white p-4 ring-1 ring-slate-100 rounded-lg">
                      <div ref={barcodeRefs[idx]} className="bg-white p-2 min-w-[200px] flex justify-center items-center">
                        <Barcode 
                          value={
                            type.label.includes("EAN-8") 
                              ? (text.length === 8 && /^\d+$/.test(text) ? text : "12345670")
                              : (text || "12345678")
                          } 
                          {...type.props}
                          textPosition="bottom"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Professional HD QR */}
          <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
            <div className="bg-navy px-6 py-4 text-center text-white font-bold text-xl uppercase tracking-widest">
              Standard HD QR Code
            </div>
            <div className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/40 tracking-wider">Name</label>
                  <input
                    type="text"
                    value={nadraData.name}
                    onChange={(e) => setNadraData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-navy/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/40 tracking-wider">Certificate No</label>
                  <input
                    type="text"
                    value={nadraData.certNo}
                    onChange={(e) => setNadraData(prev => ({ ...prev, certNo: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-navy/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/40 tracking-wider">CNIC Number</label>
                  <input
                    type="text"
                    value={nadraData.cnic}
                    onChange={(e) => setNadraData(prev => ({ ...prev, cnic: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-navy/10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/40 tracking-wider">Vaccine Date</label>
                  <input
                    type="text"
                    value={nadraData.vaccineDate}
                    onChange={(e) => setNadraData(prev => ({ ...prev, vaccineDate: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-navy/10"
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center space-y-6 py-8 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                <div ref={qrRef} className="bg-white p-6 shadow-2xl ring-1 ring-black/5 rounded-2xl">
                  <QRCode 
                    value={qrLink} 
                    size={200}
                    level="H" 
                  />
                </div>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => copyImage(qrRef, "QR Code")}
                    className="flex items-center gap-2 rounded-xl bg-[#8cc63f] px-6 py-3 text-sm font-black text-white shadow-lg shadow-[#8cc63f]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Copy className="h-4 w-4" />
                    COPY HD QR
                  </button>
                  <button 
                    onClick={() => downloadImage(qrRef, "standard-qr")}
                    className="flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-sm font-black text-white shadow-lg shadow-navy/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Download className="h-4 w-4" />
                    SAVE PNG
                  </button>
                </div>
              </div>

              {/* Data Preview */}
              <div className="rounded-xl bg-navy p-4 text-[10px] text-white/50 font-mono break-all leading-relaxed border border-white/10">
                <span className="text-[#8cc63f] font-bold">LINK:</span> {qrLink}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
