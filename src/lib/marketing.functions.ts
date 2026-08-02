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
});

export const generateMarketingCopy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CopyInput.parse(input))
  .handler(async ({ data }): Promise<MarketingCopy> => {
    const { requireAdminUnlocked, chat } = await import("@/lib/marketing.server");
    await requireAdminUnlocked();

    const system = [
      "You are the senior social-media marketing copywriter for ROHI INTERNATIONAL TRAVELS,",
      "a Pakistani travel agency (Rahim Yar Khan) selling group air tickets, umrah and visa services.",
      "You write high-converting WhatsApp marketing content that looks professional and goes viral.",
      "Rules: use short punchy lines, line breaks, WhatsApp *bold* markers, 2-6 tasteful emojis,",
      "never invent prices or dates that are not supplied, always end with a clear call to action.",
      "Reply with STRICT JSON only, no markdown fences, using keys:",
      '{"status":"...","broadcast":"...","community":"...","hashtags":"...","imagePrompt":"..."}',
      "status = max 4 short lines for a WhatsApp Status post.",
      "broadcast = a personal 1-to-1 broadcast message (max 8 lines).",
      "community = a community/group announcement (max 10 lines).",
      "hashtags = 8-12 space separated hashtags.",
      "imagePrompt = a detailed English prompt for an AI image generator to create a matching poster (no text in image instructions besides brand name ROHI INTERNATIONAL TRAVELS).",
    ].join(" ");

    const user = [
      `Language style: ${data.language}.`,
      `Tone: ${data.tone}.`,
      "Brand footer to include at the end of broadcast and community: ROHI INTERNATIONAL TRAVELS RYK — Abdul Razzaq — 0305 6622988.",
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
      "Ultra premium travel-agency marketing poster, cinematic lighting, rich navy and gold colour palette,",
      "crisp modern layout with generous empty space for caption text, photo-real, high detail, no watermark,",
      "no gibberish text, brand feel of ROHI INTERNATIONAL TRAVELS.",
    ].join(" ");
    const dataUrl = await image(styled, size);
    return { dataUrl };
  });
