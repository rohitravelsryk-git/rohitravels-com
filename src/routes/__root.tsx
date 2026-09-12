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
import { AdminNotifications } from "../components/AdminNotifications";
import { Radio, Bell } from "lucide-react";




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
  const router = useRouter();
  const isAdmin = router.state.location.pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <RootDocument>
        <SiteHeader />
        <AdminNotifications />
        <Outlet />
        {!isAdmin && (
          <>
            <InquiryFab />
            <WhatsAppWidget />
          </>
        )}
        <GlobalAnnouncement />
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
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="stylesheet" href={appCss} />
        {/* Load Jameel Noori Nastaleeq for Urdu */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" />
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
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Home | Rohi International Travels",
      },
      {
        name: "description",
        content: "Book premium group fares with Rohi International Travels. Elite travel solutions, smart ticketing support, and dependable service for professional travel agents.",
      },
      {
        name: "keywords",
        content: "travel agency, group fares, Rohi International Travels, cheap flights, ticketing agent, Pakistan travel, Umrah fares, airline tickets, B2B travel solutions",
      },
      {
        property: "og:title",
        content: "Home | Rohi International Travels",
      },
      {
        property: "og:description",
        content: "Book premium group fares and get elite ticketing support with Rohi International Travels. Your trusted partner for better fares since 1991.",
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
  }),

  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});
