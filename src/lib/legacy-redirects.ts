/**
 * Old → new public URL map.
 *
 * When a page's address changes, add the old path here and create a tiny
 * route file for it (see `src/routes/discountvouchers.tsx`) that calls
 * `legacyRedirect()`. Search engines and old bookmarks are then sent to the
 * new address with a permanent (301) redirect, so ranking and links carry
 * over instead of hitting a 404.
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
