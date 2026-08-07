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
const BOOK_LINK = "https://wa.me/923056622988";

export const generateMarketingCopy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CopyInput.parse(input))
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
      "<destination country flag emoji> ORIGIN CITY → DESTINATION CITY",
      "",
      "Airline Name",
      "",
      "<DD MMM ORG DST DEPTIME ARRTIME>   ← one line per flight leg, keep every leg given in the brief",
      "",
      "Baggage: 20+05 KG",
      "",
      `Book Now: ${BOOK_LINK}`,
      "",
      "Rules for `status`: pick the flag from the DESTINATION country (🇸🇦 Saudi Arabia, 🇦🇪 UAE, 🇴🇲 Oman, 🇶🇦 Qatar, 🇰🇼 Kuwait, 🇧🇭 Bahrain, 🇹🇷 Turkey, 🇵🇰 Pakistan).",
      "City names UPPERCASE with an arrow →. Times in 24h HHMM. Never invent legs, dates, baggage or prices that are not in the brief.",
      "If a fare/price is supplied, add a line `Fare: <value>` right before the Book Now line. Do not add any other text to `status`.",
      "",
      "broadcast = personal 1-to-1 WhatsApp broadcast (max 10 lines), same fare facts, WhatsApp *bold* markers, ends with a call to action.",
      "community = community/group announcement (max 12 lines).",
      `Footer for broadcast and community: ${BRAND_NAME} RYK — Abdul Razzaq — ${BRAND_PHONE} — ${BRAND_ADDRESS}.`,
      "hashtags = 8-12 space separated hashtags.",
      "imagePrompt = a detailed English prompt for an AI image generator describing a premium travel poster for this exact fare:",
      "name the destination landmark, the airline's aircraft in its real livery flying, and list the EXACT text that must be printed on the poster",
      "(route cities, airline name, each flight leg line, baggage, fare if given, phone, office address, agency name).",
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
  .inputValidator((input: unknown) => ImageInput.parse(input))
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
  .inputValidator((input: unknown) => ReadImageInput.parse(input))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { requireAdminUnlocked, vision } = await import("@/lib/marketing.server");
    await requireAdminUnlocked();

    const text = await vision(
      "You extract fare details from travel posters and screenshots for a Pakistani travel agency.",
      [
        "Read every piece of text in this image and rewrite it as a clean marketing brief.",
        "Keep route cities/airport codes, airline, all flight legs with dates and times, baggage, fare and any notes.",
        "Output plain text only — no commentary, no markdown.",
      ].join(" "),
      data.dataUrl,
    );
    return { text };
  });
