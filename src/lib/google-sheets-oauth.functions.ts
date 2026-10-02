import { createServerFn } from "@tanstack/react-start";

export const getGoogleSheetsOAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getGoogleSheetsOAuthStatus: impl } = await import("./google-sheets-oauth.server");
  return impl();
});
