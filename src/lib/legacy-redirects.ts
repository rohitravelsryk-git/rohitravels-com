/**
 * Old → new public URL map.
 *
 * When a page's address changes, add the old path here — `src/server.ts`
 * answers every request for it with a permanent (301) redirect to the new
 * address, so search rankings, shared links and old bookmarks carry over
 * instead of hitting a 404. No route file is needed.
 *
 * URL conventions for this site:
 *  - lowercase only
 *  - words separated by single hyphens (`/discount-vouchers`, not
 *    `/discountvouchers` or `/discount/vouchers`)
 *  - no trailing slash, no file extensions
 *  - a slash only for real parent/child sections
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/discountvouchers": "/discount-vouchers",
  "/discount/vouchers": "/discount-vouchers",
};

/**
 * Works out where a request should be sent, or null to serve it normally.
 * Handles the legacy map plus two canonical-URL rules: one address per page
 * (lowercase, no trailing slash) so search engines never see duplicates.
 */
export function resolveLegacyRedirect(pathname: string): string | null {
  // Never canonicalize framework-internal endpoints, API routes or files.
  // Server-function IDs are case-sensitive; lowercasing them corrupts every
  // data request and leaves otherwise valid pages empty or on an error screen.
  if (pathname.startsWith("/_") || pathname.startsWith("/api/") || pathname.includes(".")) return null;

  let target = pathname;

  // Trailing slash → canonical form without it.
  if (target.length > 1 && target.endsWith("/")) target = target.replace(/\/+$/, "");

  // Uppercase → lowercase.
  if (/[A-Z]/.test(target)) target = target.toLowerCase();

  // Renamed pages.
  target = LEGACY_REDIRECTS[target] ?? target;

  return target === pathname ? null : target;
}

/** Permanent redirect response, preserving any query string. */
export function legacyRedirect(request: Request, to: string): Response {
  const url = new URL(request.url);
  return new Response(null, {
    status: 301,
    headers: {
      Location: `${to}${url.search}`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
