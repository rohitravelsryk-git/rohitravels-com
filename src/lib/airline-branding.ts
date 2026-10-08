export const AIRLINE_LOGOS: Record<string, string> = {
  PK: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/PK.svg",
  PA: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/PA.svg",
  FZ: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/FZ.svg",
  OV: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/OV.svg",
  "9P": "https://images.kiwi.com/airlines/128/9P.png",
  J9: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/J9.svg",
  XY: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/XY.svg",
  PF: "https://images.kiwi.com/airlines/128/PF.png",
  ER: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/ER.svg",
  F3: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/F3.svg",
  G9: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/G9.svg",
  SV: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/SV.svg",
  EK: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/EK.svg",
  EY: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/EY.svg",
  QR: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/QR.svg",
  GF: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/GF.svg",
  KU: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/KU.svg",
  TK: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/TK.svg",
  WY: "https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/WY.svg",
};

const AIRLINE_IATA_BY_NAME: Record<string, string> = {
  PIA: "PK", PAKISTANINTERNATIONALAIRLINES: "PK", PAKISTANINTERNATIONAL: "PK",
  AIRBLUE: "PA", FLYDUBAI: "FZ", SALAMAIR: "OV", FLYJINNAH: "9P",
  JAZEERA: "J9", JAZEERAAIRWAYS: "J9", FLYNAS: "XY", AIRSIAL: "PF",
  SERENEAIR: "ER", SERENE: "ER", FLYADEAL: "F3", AIRARABIA: "G9",
  ETIHAD: "EY", ETIHADAIRWAYS: "EY", GULFAIR: "GF", GULF: "GF",
  KUWAITAIRWAYS: "KU", OMANAIR: "WY", OMAN: "WY", QATARAIRWAYS: "QR",
  QATAR: "QR", SAUDIA: "SV", SAUDIARABIANAIRLINES: "SV",
  TURKISHAIRLINES: "TK", TURKISH: "TK", EMIRATES: "EK",
};

export function airlineIataCode(name: string | null | undefined, code?: string | null | undefined): string {
  const explicit = String(code ?? "").trim().toUpperCase();
  if (explicit && explicit !== "--") return explicit;
  const normalizedName = String(name ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return AIRLINE_IATA_BY_NAME[normalizedName] ?? "";
}

export function airlineLogoUrl(code: string | null | undefined, name?: string | null | undefined): string | null {
  const normalized = airlineIataCode(name, code);
  return AIRLINE_LOGOS[normalized] ?? (normalized ? `https://images.kiwi.com/airlines/128/${normalized}.png` : null);
}
