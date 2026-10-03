import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac, randomBytes } from "node:crypto";

export type SocialPlatform = "facebook" | "instagram" | "twitter" | "linkedin" | "whatsapp";

export type SocialAccount = {
  id: string;
  platform: SocialPlatform;
  label: string;
  credentials: Record<string, string>;
  is_active: boolean;
  last_status: string | null;
  last_error: string | null;
  last_posted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialPostResult = {
  account_id: string;
  platform: SocialPlatform;
  label: string;
  status: "success" | "failed" | "manual";
  message: string;
  post_url?: string;
};

export type SocialPost = {
  id: string;
  content: string;
  image_url: string | null;
  source: "manual" | "group_fares" | "saved_campaign" | "email_marketing";
  results: SocialPostResult[];
  created_at: string;
};

// Credential fields expected per platform — surfaced to the admin UI so the
// "Add Platform" form only asks for what that platform actually needs.
export const PLATFORM_FIELDS: Record<SocialPlatform, { key: string; label: string; placeholder?: string }[]> = {
  facebook: [
    { key: "page_id", label: "Facebook Page ID" },
    { key: "access_token", label: "Page Access Token (long-lived)" },
  ],
  instagram: [
    { key: "ig_user_id", label: "Instagram Business Account ID" },
    { key: "access_token", label: "Access Token (from the linked Facebook app)" },
  ],
  twitter: [
    { key: "api_key", label: "API Key (Consumer Key)" },
    { key: "api_secret", label: "API Secret (Consumer Secret)" },
    { key: "access_token", label: "Access Token" },
    { key: "access_token_secret", label: "Access Token Secret" },
  ],
  linkedin: [
    { key: "access_token", label: "Access Token (w_member_social scope)" },
    { key: "person_urn", label: "Person URN", placeholder: "urn:li:person:xxxxxxxx" },
  ],
  whatsapp: [
    { key: "channel_or_group_link", label: "WhatsApp Channel / Community link", placeholder: "https://whatsapp.com/channel/..." },
  ],
};

async function requireAdminUnlocked() {
  const { requireAdminUnlocked: gate } = await import("@/lib/marketing.server");
  await gate();
}

/* ---------------------------- ACCOUNT CRUD ---------------------------- */

export const listSocialAccounts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireAdminUnlocked();
  } catch (e) {
    return [] as SocialAccount[];
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("social_accounts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[listSocialAccounts] notice:", error.message);
      return [] as SocialAccount[];
    }
    return (data ?? []) as SocialAccount[];
  } catch (err) {
    console.warn("[listSocialAccounts] error:", err);
    return [] as SocialAccount[];
  }
});

const CredentialsSchema = z.record(z.string(), z.string());

export const createSocialAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      platform: z.enum(["facebook", "instagram", "twitter", "linkedin", "whatsapp"]),
      label: z.string().min(1),
      credentials: CredentialsSchema,
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("social_accounts")
      .insert({ platform: data.platform, label: data.label, credentials: data.credentials })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as SocialAccount;
  });

export const updateSocialAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      label: z.string().min(1).optional(),
      credentials: CredentialsSchema.optional(),
      is_active: z.boolean().optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.label !== undefined) patch.label = data.label;
    if (data.credentials !== undefined) patch.credentials = data.credentials;
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    const { data: row, error } = await (supabaseAdmin as any)
      .from("social_accounts")
      .update(patch)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as SocialAccount;
  });

export const deleteSocialAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("social_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ POST LOG ------------------------------ */

export const listSocialPosts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    await requireAdminUnlocked();
  } catch (e) {
    return [] as SocialPost[];
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("social_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.warn("[listSocialPosts] notice:", error.message);
      return [] as SocialPost[];
    }
    return (data ?? []) as SocialPost[];
  } catch (err) {
    console.warn("[listSocialPosts] error:", err);
    return [] as SocialPost[];
  }
});

/* ------------------------- PER-PLATFORM PUBLISH ------------------------ */

async function publishToFacebook(account: SocialAccount, content: string, imageUrl?: string): Promise<SocialPostResult> {
  const { page_id, access_token } = account.credentials;
  if (!page_id || !access_token) {
    return { account_id: account.id, platform: "facebook", label: account.label, status: "failed", message: "Missing Page ID or Access Token." };
  }
  try {
    const url = imageUrl
      ? `https://graph.facebook.com/v19.0/${page_id}/photos`
      : `https://graph.facebook.com/v19.0/${page_id}/feed`;
    const body = imageUrl
      ? { url: imageUrl, caption: content, access_token }
      : { message: content, access_token };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || `HTTP ${res.status}`);
    const postId = json.post_id || json.id;
    return {
      account_id: account.id, platform: "facebook", label: account.label, status: "success",
      message: "Posted to Facebook Page.",
      post_url: postId ? `https://www.facebook.com/${postId}` : undefined,
    };
  } catch (e: any) {
    return { account_id: account.id, platform: "facebook", label: account.label, status: "failed", message: e.message || "Facebook post failed." };
  }
}

async function publishToInstagram(account: SocialAccount, content: string, imageUrl?: string): Promise<SocialPostResult> {
  const { ig_user_id, access_token } = account.credentials;
  if (!ig_user_id || !access_token) {
    return { account_id: account.id, platform: "instagram", label: account.label, status: "failed", message: "Missing Instagram Business Account ID or Access Token." };
  }
  if (!imageUrl) {
    return { account_id: account.id, platform: "instagram", label: account.label, status: "failed", message: "Instagram requires an image — add an image URL to this post." };
  }
  try {
    const createRes = await fetch(`https://graph.facebook.com/v19.0/${ig_user_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption: content, access_token }),
    });
    const createJson: any = await createRes.json();
    if (!createRes.ok) throw new Error(createJson?.error?.message || `HTTP ${createRes.status}`);
    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${ig_user_id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createJson.id, access_token }),
    });
    const publishJson: any = await publishRes.json();
    if (!publishRes.ok) throw new Error(publishJson?.error?.message || `HTTP ${publishRes.status}`);
    return { account_id: account.id, platform: "instagram", label: account.label, status: "success", message: "Posted to Instagram." };
  } catch (e: any) {
    return { account_id: account.id, platform: "instagram", label: account.label, status: "failed", message: e.message || "Instagram post failed." };
  }
}

function oauth1Header(method: string, url: string, params: Record<string, string>, consumerKey: string, consumerSecret: string, token: string, tokenSecret: string) {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const allParams = { ...params, ...oauthParams };
  const paramString = Object.keys(allParams).sort().map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(allParams[k])}`).join("&");
  const baseString = [method.toUpperCase(), encodeURIComponent(url), encodeURIComponent(paramString)].join("&");
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  const header = "OAuth " + Object.keys(headerParams).sort().map((k) => `${encodeURIComponent(k)}="${encodeURIComponent(headerParams[k])}"`).join(", ");
  return header;
}

async function publishToTwitter(account: SocialAccount, content: string): Promise<SocialPostResult> {
  const { api_key, api_secret, access_token, access_token_secret } = account.credentials;
  if (!api_key || !api_secret || !access_token || !access_token_secret) {
    return { account_id: account.id, platform: "twitter", label: account.label, status: "failed", message: "Missing API Key/Secret or Access Token/Secret." };
  }
  try {
    const url = "https://api.twitter.com/2/tweets";
    const authHeader = oauth1Header("POST", url, {}, api_key, api_secret, access_token, access_token_secret);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ text: content.slice(0, 280) }),
    });
    const json: any = await res.json();
    if (!res.ok) throw new Error(json?.detail || json?.errors?.[0]?.message || `HTTP ${res.status}`);
    const tweetId = json?.data?.id;
    return {
      account_id: account.id, platform: "twitter", label: account.label, status: "success",
      message: "Posted to X (Twitter).", post_url: tweetId ? `https://x.com/i/web/status/${tweetId}` : undefined,
    };
  } catch (e: any) {
    return { account_id: account.id, platform: "twitter", label: account.label, status: "failed", message: e.message || "X (Twitter) post failed." };
  }
}

async function publishToLinkedIn(account: SocialAccount, content: string): Promise<SocialPostResult> {
  const { access_token, person_urn } = account.credentials;
  if (!access_token || !person_urn) {
    return { account_id: account.id, platform: "linkedin", label: account.label, status: "failed", message: "Missing Access Token or Person URN." };
  }
  try {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: person_urn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: content },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (!res.ok) {
      const json: any = await res.json().catch(() => ({}));
      throw new Error(json?.message || `HTTP ${res.status}`);
    }
    return { account_id: account.id, platform: "linkedin", label: account.label, status: "success", message: "Posted to LinkedIn." };
  } catch (e: any) {
    return { account_id: account.id, platform: "linkedin", label: account.label, status: "failed", message: e.message || "LinkedIn post failed." };
  }
}

// WhatsApp has no public "post to a Channel/Community" API for a normal
// business account, so this isn't auto-published server-side — it returns
// a ready-to-send share link the client opens, same as the rest of the site's
// existing WhatsApp click-to-chat flows.
function shareToWhatsApp(account: SocialAccount, content: string): SocialPostResult {
  const link = account.credentials.channel_or_group_link;
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(content)}`;
  return {
    account_id: account.id, platform: "whatsapp", label: account.label, status: "manual",
    message: link ? "Opens WhatsApp with your message ready — send it to your Channel/Community." : "Opens WhatsApp with your message ready to send.",
    post_url: shareUrl,
  };
}

export const publishSocialPost = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({
      content: z.string().min(1),
      image_url: z.string().url().optional(),
      source: z.enum(["manual", "group_fares", "saved_campaign", "email_marketing"]).default("manual"),
      account_ids: z.array(z.string().uuid()).optional(),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: accountsRaw, error: accErr } = await (supabaseAdmin as any)
      .from("social_accounts")
      .select("*")
      .eq("is_active", true);
    if (accErr) throw new Error(accErr.message);
    const accounts = (accountsRaw as SocialAccount[]).filter((a) => !data.account_ids || data.account_ids.includes(a.id));

    const results: SocialPostResult[] = await Promise.all(
      accounts.map(async (account) => {
        switch (account.platform) {
          case "facebook": return publishToFacebook(account, data.content, data.image_url);
          case "instagram": return publishToInstagram(account, data.content, data.image_url);
          case "twitter": return publishToTwitter(account, data.content);
          case "linkedin": return publishToLinkedIn(account, data.content);
          case "whatsapp": return shareToWhatsApp(account, data.content);
        }
      }),
    );

    await Promise.all(
      results.map((r) =>
        (supabaseAdmin as any)
          .from("social_accounts")
          .update({
            last_status: r.status,
            last_error: r.status === "failed" ? r.message : null,
            last_posted_at: new Date().toISOString(),
          })
          .eq("id", r.account_id),
      ),
    );

    const { data: postRow, error: postErr } = await (supabaseAdmin as any)
      .from("social_posts")
      .insert({ content: data.content, image_url: data.image_url ?? null, source: data.source, results })
      .select()
      .single();
    if (postErr) throw new Error(postErr.message);

    return { post: postRow as SocialPost, results };
  });

export const deleteSocialPost = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireAdminUnlocked();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("social_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
