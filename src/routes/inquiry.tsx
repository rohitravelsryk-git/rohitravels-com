import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

// /inquiry has been merged into /contact-us (one public page for contact
// details + the query form, instead of two near-duplicate pages feeding
// the same admin/queries backend). This redirect keeps old links,
// bookmarks and indexed search results working.
const inquirySearchSchema = z.object({ service: z.string().optional() });

export const Route = createFileRoute("/inquiry")({
  validateSearch: inquirySearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/contact-us", search: search.service ? { service: search.service } : {} });
  },
});
