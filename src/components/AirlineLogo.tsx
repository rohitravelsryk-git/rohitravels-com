import { useEffect, useMemo, useState } from "react";
import flyadealOfficial from "@/assets/flyadeal-official.png.asset.json";
import flynasOfficial from "@/assets/flynas-official.png.asset.json";
import salamAirLogo from "@/assets/salam-air-logo.png.asset.json";
import flydubaiLogo from "@/assets/airlines/flydubai-format.png.asset.json";

const AIRLINE_IATA: Record<string, string> = {
  FLYNAS: "XY", FLYADEAL: "F3", SAUDIA: "SV", SAUDIARABIANAIRLINES: "SV",
  PIA: "PK", PAKISTANINTERNATIONAL: "PK", PAKISTANINTERNATIONALAIRLINES: "PK",
  EMIRATES: "EK", ETIHAD: "EY", ETIHADAIRWAYS: "EY", QATAR: "QR", QATARAIRWAYS: "QR",
  AIRARABIA: "G9", FLYDUBAI: "FZ", OMAN: "WY", OMANAIR: "WY", SALAMAIR: "OV",
  GULF: "GF", GULFAIR: "GF", KUWAITAIRWAYS: "KU", TURKISH: "TK", TURKISHAIRLINES: "TK",
  SERENE: "ER", SERENEAIR: "ER", AIRBLUE: "PA", AIRSIAL: "PF",
  JAZEERA: "J9", JAZEERAAIRWAYS: "J9", FLYJINNAH: "9P", JINNAHAIRLINES: "9P",
};

export const DYNAMIC_AIRLINE_IATA: Record<string, string> = {};

const LOCAL_LOGOS: Record<string, string> = {
  XY: flynasOfficial.url,
  F3: flyadealOfficial.url,
  OV: salamAirLogo.url,
  FZ: flydubaiLogo.url,
};

const OFFICIAL_LOGOS: Record<string, string> = {
  XY: "https://upload.wikimedia.org/wikipedia/commons/6/62/Flynas_Logo.svg",
  F3: "https://upload.wikimedia.org/wikipedia/commons/7/73/Flyadeal_Logo.svg",
  OV: "https://upload.wikimedia.org/wikipedia/commons/2/2f/SalamAir.png",
  FZ: "https://upload.wikimedia.org/wikipedia/commons/7/79/Fly_Dubai_logo_2010_03.svg",
  G9: "https://upload.wikimedia.org/wikipedia/commons/8/84/Air_Arabia_logo_2018.svg",
  PA: "https://upload.wikimedia.org/wikipedia/commons/f/fb/Airblue_Logo.svg",
  PF: "https://upload.wikimedia.org/wikipedia/commons/3/30/Fly_Sial_logo.svg",
  J9: "https://upload.wikimedia.org/wikipedia/commons/6/6d/Jazeera_Airways_logo.svg",
  KU: "https://upload.wikimedia.org/wikipedia/commons/f/f5/Kuwait_Airways_wordmark.svg",
  PK: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Pakistan_International_Airlines_Logo.svg",
  QR: "https://upload.wikimedia.org/wikipedia/commons/7/75/Qatar_Airways_logo.svg",
  ER: "https://upload.wikimedia.org/wikipedia/commons/5/53/SereneAir.svg",
  "9P": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Fly_Jinnah_logo2.png",
};

function airlineIata(name: string) {
  const compact = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return DYNAMIC_AIRLINE_IATA[compact] ?? AIRLINE_IATA[compact] ?? null;
}

export function AirlineLogo({ name, height = 40, className = "" }: { name: string; height?: number; className?: string }) {
  const sources = useMemo(() => {
    const code = airlineIata(name);
    if (!code) return [];
    return [
      LOCAL_LOGOS[code],
      OFFICIAL_LOGOS[code],
      `https://daisycon.io/images/airline/?width=900&height=450&color=ffffff00&iata=${code}`,
      `https://images.kiwi.com/airlines/128/${code}.png`,
    ].filter((source, index, all): source is string => Boolean(source) && all.indexOf(source) === index);
  }, [name]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [sources]);

  const src = sources[index];
  if (!src) return <span className={`px-0.5 text-center text-[9px] font-bold uppercase leading-tight ${className}`}>{name || "Airline"}</span>;
  return <img src={src} alt={`${name} logo`} loading="lazy" decoding="async" width={180} height={72} style={{ maxHeight: height }} className={`inline-block h-auto max-w-full object-contain ${className}`} onError={() => setIndex((current) => current + 1)} />;
}