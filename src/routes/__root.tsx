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
import { InquiryFab } from "../components/InquiryFab";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Rohi International Travels     — Live Group Fares" },
      {
        name: "description",
        content:
          "Live group fares to UAE,Oman and Saudia Arabia including Umrah return fares. Book on WhatsApp 0305 6622988. Trusted since 1991.",
      },
      { property: "og:title", content: "Rohi International Travels     — Live Group Fares" },
      {
        property: "og:description",
        content: "Live group fares to UAE,Oman and Saudia Arabia including Umrah return fares. Book on WhatsApp 0305 6622988. Trusted since 1991.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Rohi International Travels     — Live Group Fares" },
      { name: "twitter:description", content: "Live group fares to UAE,Oman and Saudia Arabia including Umrah return fares. Book on WhatsApp 0305 6622988. Trusted since 1991." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/20ccba81-56a2-4c4e-b160-219f567c46f5/id-preview-fb841f81--c6116e0a-fbdb-4592-b093-5b75bbc34ec6.lovable.app-1784189560749.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/20ccba81-56a2-4c4e-b160-219f567c46f5/id-preview-fb841f81--c6116e0a-fbdb-4592-b093-5b75bbc34ec6.lovable.app-1784189560749.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800;900&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "TravelAgency",
              "@id": "https://rohitravels.lovable.app/#agency",
              name: "Rohi International Travels",
              url: "https://rohitravels.lovable.app",
              telephone: "+92-305-6622988",
              foundingDate: "1991",
              image: "https://rohitravels.lovable.app/favicon.png",
              address: {
                "@type": "PostalAddress",
                streetAddress: "Sardar Market, Shahi Road",
                addressLocality: "Rahim Yar Khan",
                addressCountry: "PK",
              },
              areaServed: ["PK", "AE", "SA", "OM"],
              sameAs: [
                "https://www.facebook.com/rohitravelsryk",
                "https://www.instagram.com/rohitravels/",
                "https://www.tiktok.com/@rohitravelsryk",
              ],
            },
            {
              "@type": "WebSite",
              "@id": "https://rohitravels.lovable.app/#website",
              url: "https://rohitravels.lovable.app",
              name: "Rohi International Travels",
              publisher: { "@id": "https://rohitravels.lovable.app/#agency" },
            },
          ],
        }),
      },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <WhatsAppWidget />
      <InquiryFab />
    </QueryClientProvider>



  );
}
