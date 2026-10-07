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
};

export function airlineLogoUrl(code: string | null | undefined): string | null {
  const normalized = String(code ?? "").trim().toUpperCase();
  return AIRLINE_LOGOS[normalized] ?? null;
}
