import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/preview/split-flap")({
  component: SplitFlapPreview,
  head: () => ({
    meta: [
      { title: "Split-Flap Fare Board Preview | Rohi International Travels" },
      {
        name: "description",
        content:
          "Design preview: airport split-flap departure board with animated flight route lines for live group fares at Rohi International Travels.",
      },
      { property: "og:title", content: "Split-Flap Fare Board Preview | Rohi International Travels" },
      {
        property: "og:description",
        content:
          "Airport-style split-flap departure board with animated route lines for live group fares.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,+→";

/* ---------------- split-flap primitives ---------------- */

function Flap({ target, delay = 0, tone = "light" }: { target: string; delay?: number; tone?: "light" | "gold" | "green" }) {
  const [ch, setCh] = useState(" ");
  const upper = target.toUpperCase();

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    let settled = false;
    const startAt = performance.now() + delay;
    const targetIdx = Math.max(CHARS.indexOf(upper), 0);
    let idx = Math.floor(Math.random() * CHARS.length);

    const tick = (now: number) => {
      if (settled) return;
      if (now >= startAt) {
        idx = (idx + 1) % CHARS.length;
        setCh(CHARS[idx]);
        if (idx === targetIdx && now > startAt + 260) {
          settled = true;
          setCh(upper);
          return;
        }
      }
      timer = window.setTimeout(() => {
        raf = requestAnimationFrame(tick);
      }, 45);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      settled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [upper, delay]);

  const color =
    tone === "gold" ? "var(--gold)" : tone === "green" ? "#25D366" : "var(--navy-foreground)";

  return (
    <span
      className="relative inline-flex h-[2.1em] w-[1.25em] items-center justify-center overflow-hidden rounded-[3px] font-mono text-[1em] font-bold tabular-nums"
      style={{
        color,
        background: "linear-gradient(180deg, #1a2438 0%, #0d1422 49%, #060b14 51%, #131c2c 100%)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 2px rgba(0,0,0,0.5)",
      }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-black/70" />
      <span key={ch} className="animate-[flapin_120ms_ease-out]">
        {ch === " " ? "\u00A0" : ch}
      </span>
    </span>
  );
}

function FlapText({
  text,
  pad,
  tone = "light",
  base = 0,
  size = "1rem",
}: {
  text: string;
  pad?: number;
  tone?: "light" | "gold" | "green";
  base?: number;
  size?: string;
}) {
  const chars = useMemo(() => {
    const t = text.toUpperCase();
    return pad ? t.padEnd(pad, " ").slice(0, pad).split("") : t.split("");
  }, [text, pad]);

  return (
    <span className="inline-flex gap-[2px]" style={{ fontSize: size }}>
      {chars.map((c, i) => (
        <Flap key={`${i}-${c}`} target={c} tone={tone} delay={base + i * 70} />
      ))}
    </span>
  );
}

/* ---------------- animated route line ---------------- */

function RouteLine({ from, to, active }: { from: string; to: string; active: boolean }) {
  return (
    <div className="flex min-w-[190px] items-center gap-3">
      <span className="font-mono text-xs font-bold tracking-widest" style={{ color: "var(--gold)" }}>
        {from}
      </span>
      <span className="relative h-[2px] flex-1 rounded-full" style={{ background: "repeating-linear-gradient(90deg, color-mix(in oklab, var(--gold) 45%, transparent) 0 6px, transparent 6px 12px)" }}>
        <span
          className="absolute -top-[7px] text-[13px] transition-none"
          style={{
            color: "var(--gold)",
            animation: active ? "flyacross 3.6s linear infinite" : "none",
            left: 0,
          }}
        >
          ✈
        </span>
      </span>
      <span className="font-mono text-xs font-bold tracking-widest" style={{ color: "var(--gold)" }}>
        {to}
      </span>
    </div>
  );
}

/* ---------------- data ---------------- */

type Row = {
  group: string;
  airline: string;
  from: string;
  to: string;
  dep: string;
  flight: string;
  bag: string;
  seats: string;
  fare: string;
  status: "LIVE" | "FEW SEATS" | "SOLD";
};

const ROWS: Row[] = [
  { group: "UMRAH", airline: "AIRARABIA", from: "KHI", to: "JED", dep: "07 AUG 0800", flight: "G9 501", bag: "25+7", seats: "18", fare: "148500", status: "LIVE" },
  { group: "PARTY", airline: "FLYADEAL", from: "KHI", to: "ELQ", dep: "11 AUG 1045", flight: "F3 214", bag: "20+10", seats: "06", fare: "WHATSAPP", status: "FEW SEATS" },
  { group: "LABOUR", airline: "SALAMAIR", from: "LHE", to: "RUH", dep: "19 AUG 1400", flight: "OV 514", bag: "20+10", seats: "24", fare: "132000", status: "LIVE" },
  { group: "VISIT", airline: "AIRARABIA", from: "KHI", to: "DXB", dep: "14 AUG 0230", flight: "G9 552", bag: "30+0", seats: "11", fare: "92000", status: "LIVE" },
  { group: "UMRAH", airline: "FLYNAS", from: "ISB", to: "JED", dep: "22 AUG 1130", flight: "XY 402", bag: "25+7", seats: "00", fare: "WHATSAPP", status: "SOLD" },
];

const HEADS = ["GROUP", "AIRLINE", "ROUTE", "DEPARTURE", "FLIGHT", "BAG", "SEATS", "FARE PKR", "STATUS"];

function SplitFlapPreview() {
  const [tick, setTick] = useState(0);
  const [clock, setClock] = useState("--:--:--");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setClock(
        new Date().toLocaleTimeString("en-GB", { hour12: false }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen w-full px-4 py-10 md:px-10" style={{ backgroundColor: "var(--navy)" }}>
      <style>{`
        @keyframes flapin { from { transform: translateY(-58%) rotateX(72deg); opacity:.25 } to { transform:none; opacity:1 } }
        @keyframes flyacross { from { left: 0%; opacity:0 } 8% { opacity:1 } 92% { opacity:1 } to { left: 100%; opacity:0 } }
      `}</style>

      <div className="mx-auto max-w-7xl">
        {/* header */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.45em]" style={{ color: "var(--gold)" }}>
              Preview · Split-Flap Board
            </p>
            <h1 className="mt-2 font-serif text-4xl font-black md:text-5xl" style={{ color: "var(--navy-foreground)" }}>
              Live Group Fare Departures
            </h1>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60" style={{ color: "var(--navy-foreground)" }}>
                Board Time
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums" style={{ color: "var(--gold)" }}>{clock}</p>
            </div>
            <button
              onClick={() => setTick((t) => t + 1)}
              className="rounded-xl border px-6 py-3 text-xs font-bold uppercase tracking-[0.25em] transition-transform hover:scale-105"
              style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
            >
              Re-flip Board
            </button>
          </div>
        </div>

        {/* board */}
        <div
          ref={ref}
          className="overflow-hidden rounded-2xl border p-4 md:p-6"
          style={{
            borderColor: "color-mix(in oklab, var(--gold) 30%, transparent)",
            background: "linear-gradient(180deg, #0a1220 0%, #060a12 100%)",
            boxShadow: "0 40px 80px -30px rgba(0,0,0,0.8)",
          }}
        >
          {/* column heads */}
          <div
            className="mb-4 hidden grid-cols-[86px_120px_1fr_128px_84px_66px_58px_130px_92px] gap-3 border-b pb-3 lg:grid"
            style={{ borderColor: "color-mix(in oklab, var(--gold) 22%, transparent)" }}
          >
            {HEADS.map((h) => (
              <span key={h} className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--gold)" }}>
                {h}
              </span>
            ))}
          </div>

          <div key={tick} className="flex flex-col gap-3">
            {ROWS.map((r, ri) => {
              const b = ri * 160;
              const sold = r.status === "SOLD";
              return (
                <div
                  key={r.flight}
                  className="grid grid-cols-2 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.03] lg:grid-cols-[86px_120px_1fr_128px_84px_66px_58px_130px_92px]"
                  style={{ opacity: sold ? 0.55 : 1 }}
                >
                  <FlapText text={r.group} pad={6} tone="gold" base={b} size="0.72rem" />
                  <FlapText text={r.airline} pad={9} base={b + 60} size="0.72rem" />
                  <RouteLine from={r.from} to={r.to} active={!sold} />
                  <FlapText text={r.dep} pad={11} base={b + 120} size="0.72rem" />
                  <FlapText text={r.flight} pad={6} base={b + 200} size="0.72rem" />
                  <FlapText text={r.bag} pad={5} base={b + 260} size="0.72rem" />
                  <FlapText text={r.seats} pad={2} tone={r.seats === "00" ? "light" : "green"} base={b + 300} size="0.9rem" />
                  <FlapText
                    text={r.fare}
                    pad={8}
                    tone="gold"
                    base={b + 340}
                    size={r.fare === "WHATSAPP" ? "0.62rem" : "0.86rem"}
                  />
                  <span
                    className="justify-self-start rounded-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      color: sold ? "var(--navy-foreground)" : "#0a1220",
                      backgroundColor: sold
                        ? "rgba(255,255,255,0.12)"
                        : r.status === "FEW SEATS"
                          ? "var(--gold)"
                          : "#25D366",
                    }}
                  >
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ticker */}
          <div
            className="mt-6 overflow-hidden rounded-lg border-t pt-4"
            style={{ borderColor: "color-mix(in oklab, var(--gold) 18%, transparent)" }}
          >
            <p className="font-mono text-[11px] tracking-[0.2em]" style={{ color: "var(--gold)" }}>
              ● LIVE — 20 GROUP SEATS KHI/MCT/JED SALAM AIR 12 SEP · FARE ON WHATSAPP 0305 6622988 · UPDATED {clock}
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs opacity-60" style={{ color: "var(--navy-foreground)" }}>
          Tap “Re-flip Board” to replay the split-flap animation.
        </p>
      </div>
    </div>
  );
}
