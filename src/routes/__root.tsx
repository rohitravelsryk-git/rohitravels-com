import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { WhatsAppWidget } from "../components/WhatsAppWidget";
import { WhatsAppDirectGate } from "../components/WhatsAppDirectDialog";
import { InquiryFab } from "../components/InquiryFab";
import { GlobalAnnouncement } from "../components/GlobalAnnouncement";
import { SiteHeader } from "../components/SiteHeader";
import { Radio } from "lucide-react";




function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            Go home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="rounded-full border border-border px-6 py-3 text-sm font-bold text-foreground transition hover:bg-secondary"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <RootDocument>
        <SiteHeader />
        <Outlet />
        <div className="fixed bottom-[88px] right-6 z-[60] flex flex-col items-end gap-3 md:bottom-[105px] md:right-10 print:hidden">
          <Link
            to="/updates"
            className="group relative flex h-12 items-center justify-center overflow-hidden rounded-full bg-black px-8 text-sm font-black uppercase tracking-widest text-[#EAB308] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] ring-2 ring-white/10 transition-all hover:scale-105 hover:bg-black/90 active:scale-95"
          >
            <Bell className="mr-2 h-5 w-5 animate-bounce text-[#EAB308]" />
            Latest Updates
          </Link>
        </div>
        <InquiryFab />
        <GlobalAnnouncement />
        <WhatsAppWidget />
        <WhatsAppDirectGate />
      </RootDocument>
    </QueryClientProvider>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      reportLovableError(error.error || error.message);
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", (e) => reportLovableError(e.reason));
    return () => {
      window.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="stylesheet" href={appCss} />
        {/* Load Jameel Noori Nastaleeq for Urdu */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" />
        <HeadContent />
      </head>
      <body>
        <div id="app">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
    },
  },
});

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {
        title: "Rohi International Travels - Elite Travel Solutions",
      },
      {
        name: "description",
        content: "Unlock competitive group fares, smart ticketing support and dependable travel solutions for modern travel agents.",
      },
      {
        property: "og:title",
        content: "Rohi International Travels - Elite Travel Solutions",
      },
      {
        property: "og:description",
        content: "Unlock competitive group fares, smart ticketing support and dependable travel solutions for modern travel agents.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://rohitravels.com",
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
