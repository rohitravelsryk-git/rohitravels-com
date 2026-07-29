export type PreviewFare = {
  group: string;
  airline: string;
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  urdu: string;
  dep: string;
  flight: string;
  bag: string;
  seats: number;
  fare: string;
  tint: string;
};

export const PREVIEW_FARES: PreviewFare[] = [
  {
    group: "UMRAH",
    airline: "Air Arabia",
    from: "KHI",
    fromCity: "Karachi",
    to: "JED",
    toCity: "Jeddah",
    urdu: "کراچی جدہ",
    dep: "07 AUG · 0800 – 1005",
    flight: "G9 501 · Direct",
    bag: "25 + 7 KG",
    seats: 18,
    fare: "PKR 148,500",
    tint: "oklch(0.55 0.13 165)",
  },
  {
    group: "PARTY",
    airline: "Flyadeal",
    from: "KHI",
    fromCity: "Karachi",
    to: "ELQ",
    toCity: "Gassim",
    urdu: "کراچی قصیم",
    dep: "11 AUG · 1045 – 1630",
    flight: "F3 214 · via SHJ",
    bag: "20 + 10 KG",
    seats: 6,
    fare: "FARE ON WHATSAPP",
    tint: "oklch(0.62 0.15 55)",
  },
  {
    group: "LABOUR",
    airline: "Salam Air",
    from: "LHE",
    fromCity: "Lahore",
    to: "RUH",
    toCity: "Riyadh",
    urdu: "لاہور ریاض",
    dep: "19 AUG · 1400 – 1640",
    flight: "OV 514 · Direct",
    bag: "20 + 10 KG",
    seats: 24,
    fare: "PKR 132,000",
    tint: "oklch(0.56 0.14 20)",
  },
  {
    group: "VISIT",
    airline: "Air Arabia",
    from: "KHI",
    fromCity: "Karachi",
    to: "DXB",
    toCity: "Dubai",
    urdu: "کراچی دبئی",
    dep: "14 AUG · 0230 – 0430",
    flight: "G9 552 · Direct",
    bag: "30 KG",
    seats: 11,
    fare: "PKR 92,000",
    tint: "oklch(0.58 0.12 240)",
  },
  {
    group: "UMRAH",
    airline: "Flynas",
    from: "ISB",
    fromCity: "Islamabad",
    to: "JED",
    toCity: "Jeddah",
    urdu: "اسلام آباد جدہ",
    dep: "22 AUG · 1130 – 1450",
    flight: "XY 402 · Direct",
    bag: "25 + 7 KG",
    seats: 9,
    fare: "FARE ON WHATSAPP",
    tint: "oklch(0.6 0.11 300)",
  },
  {
    group: "PARTY",
    airline: "Air Arabia",
    from: "KHI",
    fromCity: "Karachi",
    to: "SHJ",
    toCity: "Sharjah",
    urdu: "کراچی شارجہ",
    dep: "26 AUG · 1045 – 1205",
    flight: "G9 512 · Direct",
    bag: "20 + 10 KG",
    seats: 14,
    fare: "PKR 78,500",
    tint: "oklch(0.6 0.1 210)",
  },
];

export const PREVIEW_TEMPLATES = [
  { slug: "parallax-hero", n: 1, name: "Cinematic Parallax Hero", desc: "Full-bleed aerial backdrop with depth layers that drift on scroll." },
  { slug: "split-flap", n: 2, name: "Split-Flap Board", desc: "Airport departure board with flipping characters and route lines." },
  { slug: "bento", n: 3, name: "Bento Grid + Glass", desc: "Asymmetric frosted tiles with gold hairline borders." },
  { slug: "kinetic-type", n: 4, name: "Kinetic Typography", desc: "Oversized serif headline with infinite route marquee and counting fares." },
  { slug: "route-line", n: 5, name: "Animated Route Line", desc: "SVG flight paths that draw themselves as the plane travels." },
  { slug: "dark-luxe", n: 6, name: "Dark Luxe Editorial", desc: "Magazine whitespace, grain texture, Playfair + Nastaliq pairing." },
  { slug: "tilt-cards", n: 7, name: "3D Tilt Fare Cards", desc: "Cards that tilt toward the cursor with a gold sheen sweep." },
  { slug: "scroll-story", n: 8, name: "Scroll-Snap Story", desc: "Full-height snapping destination panels with cinematic reveals." },
  { slug: "sticky-search", n: 9, name: "Sticky Search Morph", desc: "Search bar shrinks into a floating gold pill on scroll." },
  { slug: "aurora", n: 10, name: "Aurora Gradient Mesh", desc: "Slow-moving gold light blooms behind the navy hero." },
  { slug: "story-search", n: 11, name: "Story + Search Combo", desc: "Scroll-snap destination stories with a search bar that morphs into a gold pill." },
];
