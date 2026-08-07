// Official-ish brand palettes per airline, used to tint marketing fare cards.
export type Brand = { bg: string; bg2: string; accent: string; onAccent: string; ink: string };

const DEFAULT_BRAND: Brand = {
  bg: "#0a1f44",
  bg2: "#123a6b",
  accent: "#e9c46a",
  onAccent: "#0a1f44",
  ink: "#0a1f44",
};

const BRANDS: Array<{ match: RegExp; brand: Brand }> = [
  { match: /fly\s?dubai|flydubai/i, brand: { bg: "#0d1b3e", bg2: "#1b2f63", accent: "#f9a51a", onAccent: "#0d1b3e", ink: "#0d1b3e" } },
  { match: /air\s?arabia/i, brand: { bg: "#7a0021", bg2: "#a8102f", accent: "#e2001a", onAccent: "#ffffff", ink: "#7a0021" } },
  { match: /flyadeal/i, brand: { bg: "#3b0a4a", bg2: "#63157a", accent: "#8dc63f", onAccent: "#22052b", ink: "#3b0a4a" } },
  { match: /flynas/i, brand: { bg: "#0b3d5c", bg2: "#12587f", accent: "#00a9ce", onAccent: "#04283a", ink: "#0b3d5c" } },
  { match: /salam\s?air/i, brand: { bg: "#0b3d3a", bg2: "#12615c", accent: "#00a19a", onAccent: "#04231f", ink: "#0b3d3a" } },
  { match: /oman\s?air/i, brand: { bg: "#0e3c2f", bg2: "#175c48", accent: "#c8a24a", onAccent: "#0e3c2f", ink: "#0e3c2f" } },
  { match: /saudia|saudi\s?arabian/i, brand: { bg: "#053a2b", bg2: "#0a5c43", accent: "#c9b26b", onAccent: "#053a2b", ink: "#053a2b" } },
  { match: /qatar/i, brand: { bg: "#3f0a24", bg2: "#5c0e34", accent: "#8a1538", onAccent: "#ffffff", ink: "#5c0e34" } },
  { match: /emirates/i, brand: { bg: "#3b0710", bg2: "#5c0b18", accent: "#d71921", onAccent: "#ffffff", ink: "#5c0b18" } },
  { match: /etihad/i, brand: { bg: "#3a2b20", bg2: "#57402f", accent: "#bd8b13", onAccent: "#2a1d13", ink: "#57402f" } },
  { match: /jazeera/i, brand: { bg: "#0c2d4a", bg2: "#12456f", accent: "#00a0af", onAccent: "#062033", ink: "#0c2d4a" } },
  { match: /kuwait/i, brand: { bg: "#0a3a5c", bg2: "#0f5480", accent: "#0072bc", onAccent: "#ffffff", ink: "#0a3a5c" } },
  { match: /gulf\s?air/i, brand: { bg: "#3a2412", bg2: "#5c3a1d", accent: "#c9a227", onAccent: "#2a1a0c", ink: "#5c3a1d" } },
  { match: /turkish/i, brand: { bg: "#3b070f", bg2: "#5c0b17", accent: "#c8102e", onAccent: "#ffffff", ink: "#5c0b17" } },
  { match: /air\s?sial/i, brand: { bg: "#0b2f4a", bg2: "#124a72", accent: "#00b0f0", onAccent: "#062033", ink: "#0b2f4a" } },
  { match: /air\s?blue/i, brand: { bg: "#0a1f52", bg2: "#12307d", accent: "#1a6fd4", onAccent: "#ffffff", ink: "#0a1f52" } },
  { match: /serene/i, brand: { bg: "#3a0a2c", bg2: "#5c1046", accent: "#c2185b", onAccent: "#ffffff", ink: "#5c1046" } },
  { match: /\bpia\b|pakistan international/i, brand: { bg: "#043c2b", bg2: "#075a41", accent: "#00954d", onAccent: "#ffffff", ink: "#043c2b" } },
];

export function airlineBrand(airline: string | null | undefined): Brand {
  const name = (airline ?? "").trim();
  if (!name) return DEFAULT_BRAND;
  return BRANDS.find((b) => b.match.test(name))?.brand ?? DEFAULT_BRAND;
}
