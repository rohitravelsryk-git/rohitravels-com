import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFares from "./tools/list-fares";
import listVouchers from "./tools/list-vouchers";
import listVouchersAdmin from "./tools/list-vouchers-admin";
import createVoucher from "./tools/create-voucher";
import updateVoucher from "./tools/update-voucher";
import deleteVoucher from "./tools/delete-voucher";

// Direct Supabase issuer required for OAuth token verification (see knowledge).
// VITE_SUPABASE_PROJECT_ID is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "rohi-travels-mcp",
  title: "Rohi International Travels",
  version: "0.1.0",
  instructions:
    "Tools for Rohi International Travels. Anyone signed in can list public live fares and public voucher availability. Admin-only tools (voucher CRUD and full voucher details) require the site owner's account.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listFares,
    listVouchers,
    listVouchersAdmin,
    createVoucher,
    updateVoucher,
    deleteVoucher,
  ],
});
