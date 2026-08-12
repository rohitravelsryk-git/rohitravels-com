import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MarketingCopy = {
  status: string;
  broadcast: string;
  community: string;
  hashtags: string;
  imagePrompt: string;
};

const CopyInput = z.object({
  prompt: z.string().min(2).max(2000),
  language: z.enum(["english", "urdu", "roman-urdu", "mixed"]).default("mixed"),
  tone: z.enum(["viral", "premium", "urgent", "friendly"]).default("viral"),
});

const ImageInput = z.object({
  prompt: z.string().min(2).max(2000),
  format: z.enum(["status", "square", "poster"]).default("status"),
  withText: z.boolean().default(true),
});

const ReadImageInput = z.object({
  dataUrl: z.string().min(32).max(12_000_000),
});

const BRAND_PHONE = "0305 6622988";
const BRAND_ADDRESS = "Sardar Market, Shahi Road, Rahim Yar Khan";
const BRAND_NAME = "ROHI INTERNATIONAL TRAVELS";
const BOOK_LINK = "https://rohitravels.com/agent/register";

export const generateMarketingCopy = createServerFn({ method: "POST" })
  .validator((input: unknown) => CopyInput.parse(input))
  .handler(async ({ data }): Promise<MarketingCopy> => {
    const { requireAdminUnlocked, chat } = await import("@/lib/marketing.server");
    await requireAdminUnlocked();

    const system = [
      `You are the senior social-media marketing copywriter for ${BRAND_NAME},`,
      "a Pakistani travel agency (Rahim Yar Khan) selling group air tickets, umrah and visa services.",
      "Reply with STRICT JSON only, no markdown fences, using keys:",
      '{"status":"...","broadcast":"...","community":"...","hashtags":"...","imagePrompt":"..."}',
      "",
      "The `status` value is a WhatsApp Status fare post and MUST follow this EXACT skeleton (blank line between blocks):",
      "🇸🇦 <ORIGIN CITY> <DESTINATION CITY>   ← flag of destination country",
      "",
      "Airline Name",
      "",
      "<DD MMM ORG DST DEPTIME ARRTIME>   ← one line per flight leg, keep every leg given in the brief",
      "",
      "Baggage: 20+10 KG",
      "",
      "Book Now: https://wa.me/923056622988",
      "",
      "Rules for `status`: pick the flag from the DESTINATION country (🇸🇦 Saudi Arabia, 🇦🇪 UAE, 🇴🇲 Oman, 🇶🇦 Qatar, 🇰🇼 Kuwait, 🇧🇭 Bahrain, 🇹🇷 Turkey, 🇵🇰 Pakistan).",
      "Origin and Destination in BOLD UPPERCASE without an arrow. Times in 24h HHMM. Never invent legs or dates that are not in the brief.",
      "If a fare/price is supplied, add a line `Fare: <value>` right before the Book Now line. Do not add any other text to `status`.",
      "",
      "broadcast = personal 1-to-1 WhatsApp broadcast. MUST use this EXACT skeleton:",
      "🔥 *URGENT SEAT ALERT! <ORIGIN FULL NAME> TO <DESTINATION FULL NAME> DIRECT FLIGHTS!* 🔥",
      "",
      "🇸🇦 <ORIGIN CITY> <DESTINATION CITY>",
      "",
      "Airline Name",
      "",
      "<DD MMM ORG DST DEPTIME ARRTIME>   ← one line per flight leg",
      "",
      "Baggage: 20+10 KG",
      "",
      "*ROHI INTERNATIONAL TRAVELS*",
      "Abdul Razzaq",
      "0305 6622988",
      "Sardar Market, Shahi Road, Rahim Yar Khan",
      "Portal Link: https://rohitravels.com/agent/register",
      "",
      "community = community/group announcement. MUST use this EXACT skeleton:",
      "🔥 *URGENT SEAT ALERT! <ORIGIN FULL NAME> TO <DESTINATION FULL NAME> DIRECT FLIGHTS!* 🔥",
      "",
      "🇸🇦 <ORIGIN CITY> <DESTINATION CITY>",
      "",
      "Airline Name",
      "",
      "<DD MMM ORG DST DEPTIME ARRTIME>   ← one line per flight leg",
      "",
      "Baggage: 20+10 KG",
      "",
      "Book Now: *0305 6622988*",
      "Portal Link: *https://rohitravels.com/agent/register*",
      "hashtags = 8-12 space separated hashtags.",
      "imagePrompt = a detailed English prompt for an AI image generator describing a premium travel poster for this exact fare:",
      "name the destination landmark, the airline's aircraft in its real livery flying, and list the EXACT text that must be printed on the poster",
      "(route cities, airline name, each flight leg line, baggage, fare if given, phone, office address, agency name).",
      "",
      "IMPORTANT RULES:",
      "1. Use FULL AIRPORT CITY NAMES for the header (e.g., KARACHI instead of KHI, JEDDAH instead of JED).",
      "2. If NO fare is provided in the brief, DO NOT write a self-invented fare.",
      "3. For broadcast and community, include additional creative/viral text based on the Tone (Viral, Premium, etc.) while keeping the fare skeleton intact. ALWAYS include the 'URGENT SEAT ALERT!' header with full city names regardless of tone.",
      "4. Use green-related words for flight details/contact in the prompt description if applicable, but focus on the exact skeleton requested.",
    ].join("\n");

    const user = [
      `Language style: ${data.language}.`,
      `Tone: ${data.tone}.`,
      "Brief from the marketing manager:",
      data.prompt,
    ].join("\n");

    const raw = await chat(system, user);
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as Partial<MarketingCopy>;
      return {
        status: parsed.status?.trim() || cleaned,
        broadcast: parsed.broadcast?.trim() || parsed.status?.trim() || cleaned,
        community: parsed.community?.trim() || parsed.broadcast?.trim() || cleaned,
        hashtags: parsed.hashtags?.trim() || "",
        imagePrompt: parsed.imagePrompt?.trim() || data.prompt,
      };
    } catch {
      return { status: cleaned, broadcast: cleaned, community: cleaned, hashtags: "", imagePrompt: data.prompt };
    }
  });

export const generateMarketingImage = createServerFn({ method: "POST" })
  .validator((input: unknown) => ImageInput.parse(input))
  .handler(async ({ data }): Promise<{ dataUrl: string }> => {
    const { requireAdminUnlocked, image } = await import("@/lib/marketing.server");
    await requireAdminUnlocked();

    const size = data.format === "status" ? "1024x1536" : data.format === "poster" ? "1536x1024" : "1024x1024";
    const styled = [
      data.prompt,
      "",
      "Render this as an ultra-premium airline / travel-agency marketing poster:",
      "hero photo of the destination landmark (Kaaba & Masjid al-Haram for Makkah, Prophet's Mosque for Madinah, Jeddah corniche for Jeddah,",
      "Burj Khalifa for Dubai, Sultan Qaboos mosque for Muscat), plus the airline's real aircraft livery flying across the sky,",
      "cinematic golden light, rich navy and gold brand palette, sharp modern layout, photo-real, 4k detail, no watermark.",
      data.withText
        ? [
            "IMPORTANT — print crisp, perfectly spelled typography on the poster exactly as listed:",
            "1) huge bold uppercase ORIGIN → DESTINATION headline,",
            "2) the airline name, 3) every flight leg line (date, airport codes, times) in a clean mono/condensed font,",
            "4) the baggage line, 5) the fare if one is given,",
            `6) bottom brand bar with "${BRAND_NAME}", phone ${BRAND_PHONE} and "Office: ${BRAND_ADDRESS}".`,
            "All text must be legible, correctly spelled English/numerals, no gibberish, no duplicated words.",
          ].join(" ")
        : "No text or lettering anywhere in the image.",
    ].join(" ");
    const dataUrl = await image(styled, size);
    return { dataUrl };
  });

// Reads an uploaded poster/screenshot and returns its text so it can be reused as a prompt.
export const readImageText = createServerFn({ method: "POST" })
  .validator((input: unknown) => ReadImageInput.parse(input))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { requireAdminUnlocked, vision } = await import("@/lib/marketing.server");
    await requireAdminUnlocked();

    const text = await vision(
      "You extract fare details from travel posters and screenshots for a Pakistani travel agency.",
      [
        "Read every piece of text in this image and rewrite it as a clean marketing brief.",
        "If the image looks like a group fare table or poster, specifically extract and list the: Origin, Destination, Airline, all Flight Legs (Dates/Times), Baggage, and Fare.",
        "Otherwise, simply get all the text found in the image.",
        "Output plain text only — no commentary, no markdown.",
      ].join(" "),
      data.dataUrl,
    );
    return { text };
  });
