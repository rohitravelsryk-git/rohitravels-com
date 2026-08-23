import * as React from 'react';
import { Mail, Smartphone, Globe, CheckCircle2, AlertTriangle, Clock, Printer, Plane, User, Phone, MapPin } from 'lucide-react';

type EmailVariant = 'classic' | 'modern' | 'minimal' | 'luxury';

interface BookingPreviewProps {
  agencyName: string;
  seats: number;
  passengerNames: string;
  flightSummary: string;
  fareOnDemand?: string;
  bookingRef: string;
}

export function BookingEmailPreview({
  agencyName = "ROHI TRAVELS TEST",
  seats = 2,
  passengerNames = "ABDUL RAZZAQ\nRAIS AHMAD",
  flightSummary = "EY 222 KHI-AUH 04:30\nEY 313 AUH-JED 10:15",
  fareOnDemand = "92,500",
  bookingRef = "RT-123456"
}: Partial<BookingPreviewProps>) {
  const [variant, setVariant] = React.useState<EmailVariant>('modern');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2 p-2 bg-navy/5 rounded-lg border border-navy/10 overflow-x-auto no-scrollbar">
        {(['classic', 'modern', 'minimal', 'luxury'] as EmailVariant[]).map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            className={`px-4 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
              variant === v 
                ? 'bg-navy text-white shadow-md' 
                : 'bg-white text-navy hover:bg-navy/5'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="bg-slate-50 p-8 rounded-xl border border-dashed border-navy/20 flex justify-center">
        {variant === 'classic' && (
          <div className="w-full max-w-[600px] bg-white shadow-xl border border-gray-200 font-sans text-[#0b2545]">
            <div className="bg-[#0b2545] p-6 text-white text-center">
              <h2 className="text-2xl font-bold m-0 uppercase tracking-tighter">Booking Request Received</h2>
              <p className="text-white/60 text-xs mt-1 uppercase tracking-widest">Rohi International Travels</p>
            </div>
            <div className="p-8">
              <p className="mb-6 text-gray-600">Dear <strong>{agencyName}</strong>, we have received your booking request for {seats} seats. Our team is processing it.</p>
              
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-lg mb-6">
                <h3 className="text-sm font-black text-navy/40 uppercase mb-4 border-b pb-2">Booking Details</h3>
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="py-2 text-gray-500 w-32">Booking Ref</td><td className="py-2 font-bold">{bookingRef}</td></tr>
                    <tr><td className="py-2 text-gray-500">Passengers</td><td className="py-2 whitespace-pre-line">{passengerNames}</td></tr>
                    <tr><td className="py-2 text-gray-500">Flight Details</td><td className="py-2 font-mono bg-white p-2 rounded border">{flightSummary}</td></tr>
                    {fareOnDemand && <tr><td className="py-2 text-gray-500">Total Fare</td><td className="py-2 font-black text-orange-600 text-lg">PKR {fareOnDemand}</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="text-center">
                <a href="#" className="inline-block bg-[#f59e0b] text-[#0b2545] px-8 py-3 rounded font-black text-sm uppercase tracking-widest no-underline shadow-lg">View in Portal</a>
              </div>
            </div>
            <div className="bg-gray-50 p-6 text-center text-xs text-gray-400 border-t">
              © 2026 Rohi International Travels · Gulshan-e-Iqbal, Karachi
            </div>
          </div>
        )}

        {variant === 'modern' && (
          <div className="w-full max-w-[600px] bg-white shadow-2xl rounded-2xl overflow-hidden font-sans border border-gray-100">
            <div className="h-2 bg-gradient-to-r from-navy via-gold to-navy" />
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="bg-navy/5 text-navy px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Transaction Alert</div>
                  <h2 className="text-3xl font-black text-navy leading-none">We've got your <span className="text-gold">booking.</span></h2>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-navy flex items-center justify-center text-gold">
                  <Plane className="w-6 h-6" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Seats</p>
                  <p className="text-xl font-black text-navy">{seats}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Reference</p>
                  <p className="text-xl font-black text-navy">#{bookingRef.split('-')[1]}</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy uppercase">Flight Itinerary</h4>
                    <p className="text-xs text-slate-500 font-mono mt-1 whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {flightSummary}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy uppercase">Passengers</h4>
                    <p className="text-xs text-slate-600 mt-1 font-semibold">{passengerNames.replace(/\n/g, ', ')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-navy p-6 rounded-2xl text-white flex justify-between items-center mb-8">
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase">Total Amount Due</p>
                  <p className="text-2xl font-black text-gold">PKR {fareOnDemand}</p>
                </div>
                <button className="bg-white text-navy px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gold transition-colors">
                  Submit Payment
                </button>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>Rohi International Travels</span>
                <span>Support: 03056622988</span>
              </div>
            </div>
          </div>
        )}

        {variant === 'minimal' && (
          <div className="w-full max-w-[500px] bg-white p-12 border border-gray-100 shadow-sm font-mono text-xs leading-relaxed">
            <div className="mb-8 border-b-2 border-black pb-4">
              <div className="text-lg font-black tracking-tighter mb-1 uppercase">Rohi Travels · Booking Receipt</div>
              <div className="flex justify-between">
                <span>REF: {bookingRef}</span>
                <span>DATE: {new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <div className="font-black mb-1">[AGENCY]</div>
                <div>{agencyName}</div>
              </div>
              
              <div>
                <div className="font-black mb-1">[FLIGHT_INFO]</div>
                <div className="whitespace-pre-line">{flightSummary}</div>
              </div>

              <div>
                <div className="font-black mb-1">[PASSENGERS] x{seats}</div>
                <div className="whitespace-pre-line">{passengerNames}</div>
              </div>

              <div className="pt-4 border-t border-black flex justify-between text-sm">
                <span className="font-black">TOTAL_PAYABLE</span>
                <span className="font-black">PKR {fareOnDemand}</span>
              </div>
            </div>

            <div className="bg-black text-white p-4 text-center font-black tracking-widest uppercase cursor-pointer hover:bg-gray-800">
              Confirm Booking Details
            </div>
            
            <div className="mt-8 text-[10px] text-gray-400">
              * This is an automated notification. Please do not reply.
            </div>
          </div>
        )}

        {variant === 'luxury' && (
          <div className="w-full max-w-[600px] bg-[#0A0F1A] text-[#C5A059] shadow-2xl rounded-lg overflow-hidden border border-[#C5A059]/20 font-serif">
            <div className="p-12 text-center relative">
              <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle at 50% 50%, #C5A059 0%, transparent 70%)'}} />
              <div className="mb-6 inline-block border border-[#C5A059] p-3 rounded-full">
                <Plane className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-light italic mb-2 tracking-wide">Exquisite Journey Awaits</h1>
              <p className="text-[10px] uppercase tracking-[0.5em] text-white/40 font-sans">Booking Confirmation · Rohi Travels</p>
            </div>

            <div className="px-12 py-8 bg-black/30 border-y border-[#C5A059]/10 font-sans">
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">Agency</h5>
                    <p className="text-sm font-medium text-white">{agencyName}</p>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">Passengers</h5>
                    <p className="text-xs text-white/70 leading-relaxed whitespace-pre-line">{passengerNames}</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <h5 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">Itinerary</h5>
                    <p className="text-[11px] font-mono text-[#C5A059] leading-relaxed whitespace-pre-line">{flightSummary}</p>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">Investment</h5>
                    <p className="text-xl font-light text-white">PKR {fareOnDemand}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-12 text-center">
              <button className="border border-[#C5A059] px-12 py-4 text-xs font-bold uppercase tracking-[0.3em] text-[#C5A059] hover:bg-[#C5A059] hover:text-black transition-all duration-500">
                Manage Reservation
              </button>
              <div className="mt-8 text-[9px] text-white/20 uppercase tracking-[0.2em]">
                Your trusted partner for better fares
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
