import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Barcode from "react-barcode";
import QRCode from "react-qr-code";
import { Copy, Printer, Save, Trash2, QrCode, Barcode as BarcodeIcon } from "lucide-react";

export const Route = createFileRoute("/admin/barcode-generator")({
  component: BarcodeQRGenerator,
});

function BarcodeQRGenerator() {
  const [text, setText] = useState("GROUP TICKET");
  const [nadraData, setNadraData] = useState({
    name: "Ghulam Mustafa",
    certNo: "OB91460592040",
    cnic: "4510106253925",
    vaccineDate: "17-01-2025",
    passportNo: "",
  });

  const qrLink = `https://nims.nadra.gov.pk/nims/certificateinfo?ep= Name: ${nadraData.name} Certificate No: ${nadraData.certNo} CNIC Number ${nadraData.cnic} Vaccine Date: ${nadraData.vaccineDate} Passport No: ${nadraData.passportNo}`;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h1 className="font-serif text-3xl font-black text-navy">Bar & QR Code Generator</h1>
            <p className="text-sm text-navy/60">Generate professional codes for tickets and certificates</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-navy/90"
            >
              <Printer className="h-4 w-4" />
              Print Page
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Section 1: Ticket Barcode */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="bg-[#8cc63f] px-6 py-3 text-center text-white font-bold text-lg">
              Bar & QR Codes Generator
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-navy/60">Barcode Text</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-navy/20"
                  placeholder="Enter text for barcode..."
                />
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 bg-slate-50 min-h-[200px]">
                <div className="bg-white p-4 shadow-sm ring-1 ring-black/5">
                  <Barcode 
                    value={text || " "} 
                    width={2} 
                    height={60} 
                    fontSize={14}
                    textPosition="bottom"
                  />
                </div>
                <div className="mt-4 flex gap-4 text-xs font-medium text-navy/40">
                  <div className="flex items-center gap-1"><BarcodeIcon className="h-3 w-3" /> Barcode</div>
                  <div className="flex items-center gap-1">GROUP TICKET</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: NADRA Style QR */}
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="bg-navy px-6 py-3 text-center text-white font-bold text-lg">
              Nims Nadra Certificate Style
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/60">Name</label>
                  <input
                    type="text"
                    value={nadraData.name}
                    onChange={(e) => setNadraData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded border border-border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-navy/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/60">Certificate No</label>
                  <input
                    type="text"
                    value={nadraData.certNo}
                    onChange={(e) => setNadraData(prev => ({ ...prev, certNo: e.target.value }))}
                    className="w-full rounded border border-border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-navy/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/60">CNIC Number</label>
                  <input
                    type="text"
                    value={nadraData.cnic}
                    onChange={(e) => setNadraData(prev => ({ ...prev, cnic: e.target.value }))}
                    className="w-full rounded border border-border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-navy/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/60">Vaccine Date</label>
                  <input
                    type="text"
                    value={nadraData.vaccineDate}
                    onChange={(e) => setNadraData(prev => ({ ...prev, vaccineDate: e.target.value }))}
                    className="w-full rounded border border-border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-navy/20"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-navy/60">Passport No</label>
                  <input
                    type="text"
                    value={nadraData.passportNo}
                    onChange={(e) => setNadraData(prev => ({ ...prev, passportNo: e.target.value }))}
                    className="w-full rounded border border-border px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-navy/20"
                  />
                </div>
              </div>

              {/* NADRA Table Style Preview */}
              <div className="mt-6 overflow-x-auto rounded border border-navy/20 bg-navy">
                <table className="w-full text-[10px] text-white">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th colSpan={7} className="py-1 font-normal text-white/90 underline">
                        https://nims.nadra.gov.pk/nims/certificateinfo?ep=
                      </th>
                    </tr>
                    <tr className="bg-navy-light/20">
                      <th className="border-r border-white/20 p-1 font-bold">Name:</th>
                      <th className="border-r border-white/20 p-1 font-bold">Certificate No.</th>
                      <th className="border-r border-white/20 p-1 font-bold">CNIC Number</th>
                      <th className="border-r border-white/20 p-1 font-bold">Vaccine Date:</th>
                      <th className="border-r border-white/20 p-1 font-bold">Passport No:</th>
                      <th className="border-r border-white/20 p-1 font-bold">QR LINK</th>
                      <th className="p-1 font-bold">QR Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-white/20 p-1 text-center">{nadraData.name}</td>
                      <td className="border-r border-white/20 p-1 text-center">{nadraData.certNo}</td>
                      <td className="border-r border-white/20 p-1 text-center">{nadraData.cnic}</td>
                      <td className="border-r border-white/20 p-1 text-center">{nadraData.vaccineDate}</td>
                      <td className="border-r border-white/20 p-1 text-center">{nadraData.passportNo || "-"}</td>
                      <td className="border-r border-white/20 p-2 max-w-[120px] break-all text-[8px] leading-tight opacity-80">
                        {qrLink}
                      </td>
                      <td className="p-2 flex justify-center bg-white">
                        <QRCode value={qrLink} size={60} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Print Only Layout */}
        <div className="hidden print:block print:bg-white print:p-0">
          <div className="space-y-20">
             {/* Ticket Barcode Section */}
             <div className="flex items-center justify-between border-2 border-black p-8">
                <div className="text-2xl font-bold border-2 border-black px-6 py-10 w-48 text-center">
                  GROUP TICKET
                </div>
                <div className="flex flex-col items-end gap-10">
                  <Barcode value={text || " "} width={2} height={80} />
                  <div className="flex gap-4">
                    <Barcode value={nadraData.name || "HAMMAD / ARIF"} width={1.5} height={40} fontSize={12} />
                    <Barcode value={nadraData.certNo || "VCZW4Y"} width={1.5} height={40} fontSize={12} />
                  </div>
                </div>
             </div>

             {/* NADRA Section */}
             <div className="mt-20 overflow-hidden border-2 border-navy bg-navy w-full">
                <table className="w-full text-sm text-white border-collapse">
                  <thead>
                    <tr className="border-b-2 border-white">
                      <th colSpan={7} className="py-2 font-normal text-white underline text-base">
                        https://nims.nadra.gov.pk/nims/certificateinfo?ep=
                      </th>
                    </tr>
                    <tr className="bg-navy">
                      <th className="border-r-2 border-white p-2 font-bold">Name:</th>
                      <th className="border-r-2 border-white p-2 font-bold">Certificate No.</th>
                      <th className="border-r-2 border-white p-2 font-bold">CNIC Number</th>
                      <th className="border-r-2 border-white p-2 font-bold">Vaccine Date:</th>
                      <th className="border-r-2 border-white p-2 font-bold">Passport No:</th>
                      <th className="border-r-2 border-white p-2 font-bold">QR LINK</th>
                      <th className="p-2 font-bold">QR Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r-2 border-white p-4 text-center">{nadraData.name}</td>
                      <td className="border-r-2 border-white p-4 text-center">{nadraData.certNo}</td>
                      <td className="border-r-2 border-white p-4 text-center">{nadraData.cnic}</td>
                      <td className="border-r-2 border-white p-4 text-center">{nadraData.vaccineDate}</td>
                      <td className="border-r-2 border-white p-4 text-center">{nadraData.passportNo || "-"}</td>
                      <td className="border-r-2 border-white p-4 max-w-[200px] break-all text-[10px] leading-tight">
                        {qrLink}
                      </td>
                      <td className="p-4 flex justify-center bg-white">
                        <QRCode value={qrLink} size={100} />
                      </td>
                    </tr>
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
