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
};

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
