export const AIRLINE_LOGOS: Record<string, string> = {
  PK: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Pakistan_International_Airlines_Logo.svg",
  PA: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Airblue_Logo.svg",
  FZ: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Fly_Dubai_logo_2010_05.svg",
  OV: "https://commons.wikimedia.org/wiki/Special:Redirect/file/SalamAir.png",
  "9P": "https://commons.wikimedia.org/wiki/Special:Redirect/file/Fly_Jinnah_logo2.png",
  J9: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Jazeera_Airways_logo.svg",
  XY: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Flynas_Logo.svg",
  PF: "https://commons.wikimedia.org/wiki/Special:Redirect/file/AirSial.png",
  ER: "https://commons.wikimedia.org/wiki/Special:Redirect/file/SereneAir.svg",
  F3: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Flyadeal_Logo.svg",
  G9: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Air_Arabia_Logo.svg",
};

const AIRLINE_IATA_BY_NAME: Record<string, string> = {
  PIA: "PK", PAKISTANINTERNATIONALAIRLINES: "PK", AIRBLUE: "PA", FLYDUBAI: "FZ",
  SALAMAIR: "OV", FLYJINNAH: "9P", JAZEERA: "J9", JAZEERAAIRWAYS: "J9",
  FLYNAS: "XY", AIRSIAL: "PF", SERENEAIR: "ER", FLYADEAL: "F3",
  AIRARABIA: "G9", ETIHAD: "EY", ETIHADAIRWAYS: "EY", GULFAIR: "GF",
  KUWAITAIRWAYS: "KU", OMANAIR: "WY", QATARAIRWAYS: "QR", SAUDIA: "SV",
  TURKISHAIRLINES: "TK", EMIRATES: "EK",
};

export function airlineIataCode(name: string | null | undefined, code?: string | null | undefined): string {
  const explicit = String(code ?? "").trim().toUpperCase();
  if (explicit && explicit !== "--") return explicit;
  const normalizedName = String(name ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return AIRLINE_IATA_BY_NAME[normalizedName] ?? "";
}

export function airlineLogoUrl(code: string | null | undefined, name?: string | null | undefined): string | null {
  const normalized = airlineIataCode(name, code);
  return AIRLINE_LOGOS[normalized] ?? null;
}
