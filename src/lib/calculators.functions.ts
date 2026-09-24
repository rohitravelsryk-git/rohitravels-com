import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";

type GateSession = { unlocked?: boolean; staffUsername?: string | null };

function sessionConfig() {
  const password = typeof process !== "undefined" ? process.env.SESSION_SECRET : undefined;
  if (!password) throw new Error("Server misconfigured: SESSION_SECRET is not set");
  return {
    password,
    name: "rohi-admin",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function requireUnlocked() {
  const s = await useSession<GateSession>(sessionConfig());
  if (!s.data.unlocked) throw new Error("Unauthorized");
  return s;
}

export type CalculatorToolId =
  | "add-subtract"
  | "age-duration"
  | "days-between"
  | "hours-between"
  | "discount";
export type CalculatorTool = { id: CalculatorToolId; label: string; visible: boolean; note: string };

export type CalculatorsContent = {
  eyebrow: string;
  title: string;
  intro: string;
  heading: string;
  subheading: string;
  tools: CalculatorTool[];
  updatedAt: string;
};

const SETTING_KEY = "calculators_page";

const TOOL_IDS = ["add-subtract", "age-duration", "days-between", "hours-between", "discount"] as const;

export const CALCULATORS_DEFAULTS: Omit<CalculatorsContent, "updatedAt"> = {
  eyebrow: "Travel Tools",
  title: "Date Calculator",
  intro: "Plan dates, check durations, and calculate group fare discounts in one place.",
  heading: "Quick calculations",
  subheading: "Useful tools for everyday travel planning.",
  tools: [
    { id: "add-subtract", label: "Add / Subtract Days", visible: true, note: "" },
    { id: "age-duration", label: "Age / Duration", visible: true, note: "" },
    { id: "days-between", label: "No. of Days", visible: true, note: "" },
    { id: "hours-between", label: "Hours Between (From / To)", visible: true, note: "" },
    { id: "discount", label: "Discount Calculator", visible: true, note: "" },
  ],
};

/** Repairs stored content: drops unknown tools and appends any tool added in code later. */
function normalize(raw: unknown, updatedAt: string): CalculatorsContent {
  const stored = (raw ?? {}) as Partial<CalculatorsContent>;
  const text = (value: string | undefined, fallback: string, max: number) =>
    typeof value === "string" && value.trim() ? value.slice(0, max) : fallback;

  const storedTools = Array.isArray(stored.tools) ? stored.tools : [];
  const byId = new Map<CalculatorToolId, CalculatorTool>();
  for (const tool of storedTools) {
    if (!tool || !TOOL_IDS.includes(tool.id) || byId.has(tool.id)) continue;
    byId.set(tool.id, {
      id: tool.id,
      label: text(tool.label, defaultTool(tool.id).label, 60),
      visible: tool.visible !== false,
      note: typeof tool.note === "string" ? tool.note.slice(0, 600) : "",
    });
  }
  const tools = [...byId.values()];
  for (const id of TOOL_IDS) if (!byId.has(id)) tools.push(defaultTool(id));

  return {
    eyebrow: text(stored.eyebrow, CALCULATORS_DEFAULTS.eyebrow, 60),
    title: text(stored.title, CALCULATORS_DEFAULTS.title, 80),
    intro: text(stored.intro, CALCULATORS_DEFAULTS.intro, 400),
    heading: text(stored.heading, CALCULATORS_DEFAULTS.heading, 80),
    subheading: text(stored.subheading, CALCULATORS_DEFAULTS.subheading, 200),
    tools,
    updatedAt,
  };
}

function defaultTool(id: CalculatorToolId): CalculatorTool {
  return CALCULATORS_DEFAULTS.tools.find((t) => t.id === id)!;
}

/** Public: the live Calculators content for the website and the agent portal. */
export const getCalculatorsContent = createServerFn({ method: "GET" }).handler(async (): Promise<CalculatorsContent> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("site_settings")
    .select("value, updated_at")
    .eq("key", SETTING_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return normalize(null, "");
  try {
    return normalize(JSON.parse(data.value), data.updated_at ?? "");
  } catch {
    return normalize(null, "");
  }
});

const toolSchema = z.object({
  id: z.enum(TOOL_IDS),
  label: z.string().min(1).max(60),
  visible: z.boolean(),
  note: z.string().max(600).default(""),
});

export const saveCalculatorsContent = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        eyebrow: z.string().max(60).default(""),
        title: z.string().min(1).max(80),
        intro: z.string().max(400).default(""),
        heading: z.string().max(80).default(""),
        subheading: z.string().max(200).default(""),
        tools: z.array(toolSchema).min(1).max(TOOL_IDS.length),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert(
        { key: SETTING_KEY, value: JSON.stringify(data), updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
