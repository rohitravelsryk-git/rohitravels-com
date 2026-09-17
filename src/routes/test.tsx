import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { 
  Activity, 
  ArrowLeft, 
  CheckCircle2, 
  ExternalLink, 
  Layers, 
  Palette, 
  Plane, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/test")({
  head: () => ({
    meta: [
      { title: "Test Page — Rohi International Travels" },
      {
        name: "description",
        content: "Public diagnostics, design system tokens, and interactive test sandbox for Rohi International Travels.",
      },
      { property: "og:title", content: "Test Page — Rohi International Travels" },
      {
        property: "og:description",
        content: "Public test and verification page for the Rohi International Travels website.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rohitravels.com/test" },
    ],
    links: [{ rel: "canonical", href: "https://rohitravels.com/test" }],
  }),
  component: TestPage,
});

function TestPage() {
  const [pingCount, setPingCount] = useState(1);
  const [lastCheckTime, setLastCheckTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [testAmount, setTestAmount] = useState<number>(185000);

  const handlePing = () => {
    setPingCount((c) => c + 1);
    setLastCheckTime(new Date().toLocaleTimeString());
  };

  const systemStatus = [
    { name: "Public Web Router", status: "Operational", detail: "TanStack Router v1", icon: Layers },
    { name: "Design System Tokens", status: "Active", detail: "#F4F3EE / #D97757 / #2A2620", icon: Palette },
    { name: "Flight & Umrah Engines", status: "Ready", detail: "Group Fares & Custom Calculators", icon: Plane },
    { name: "Security & Visa Verification", status: "Protected", detail: "Multi-country Visa Checkers", icon: ShieldCheck },
  ];

  const paletteTokens = [
    { name: "Background", hex: "#F4F3EE", token: "--background", usage: "Page canvas & backdrop" },
    { name: "Cards / Surface", hex: "#FFFFFF", token: "--card", usage: "Elevated content cards & modals" },
    { name: "Accent Brand", hex: "#D97757", token: "--color-accent", usage: "Primary actions, highlights & CTA" },
    { name: "Muted & Borders", hex: "#B1ADA1", token: "--border", usage: "Subtle borders, dividers & captions" },
    { name: "Text / Ink", hex: "#2A2620", token: "--color-text", usage: "Headings, body typography & high contrast" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground animate-premium-fade pb-16">
      {/* Hero Header */}
      <section className="border-b border-border/60 bg-card py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Public Portal Test Environment</span>
              </div>
              <h1 className="mt-3 font-serif text-3xl font-black text-navy sm:text-4xl">
                System Diagnostics & <span className="text-gold">Test Page</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Verification suite and component test sandbox for Rohi International Travels.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="rounded-full"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Home
                </Link>
              </Button>
              <Button
                onClick={handlePing}
                size="sm"
                className="rounded-full bg-gold hover:bg-gold/90 text-gold-foreground"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Ping Diagnostic ({pingCount})
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-6 border-t border-border/50 pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
              Environment Status: <strong className="text-foreground">Online</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-gold" />
              Last Heartbeat: <strong className="text-foreground">{lastCheckTime}</strong>
            </span>
            <span>
              Target Branch: <code className="rounded bg-muted px-2 py-0.5 font-mono text-foreground">main</code>
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        {/* Diagnostics Overview */}
        <div>
          <h2 className="text-lg font-bold text-navy mb-4">1. Subsystem Health Checks</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {systemStatus.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.name} className="shadow-xs hover:shadow-sm transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy/5 text-navy">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 bg-emerald-50 text-[11px]">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                      {item.status}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Design System & Token Audit */}
        <div>
          <h2 className="text-lg font-bold text-navy mb-4">2. Design System Color Tokens</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cascading Theme Palette</CardTitle>
              <CardDescription>
                Defined in <code className="font-mono text-xs">src/styles.css</code> and applied site-wide.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {paletteTokens.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-xl border border-border/70 p-3 bg-card flex flex-col justify-between space-y-3"
                  >
                    <div
                      className="h-14 w-full rounded-lg border border-border/50 shadow-inner flex items-center justify-center text-xs font-mono font-bold"
                      style={{
                        backgroundColor: p.hex,
                        color: p.hex === "#FFFFFF" || p.hex === "#F4F3EE" ? "#2A2620" : "#FFFFFF",
                      }}
                    >
                      {p.hex}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-navy">{p.name}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{p.token}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{p.usage}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* UI Component Sandbox */}
        <div>
          <h2 className="text-lg font-bold text-navy mb-4">3. Interactive UI Sandbox</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Button Variants */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Shared Button Primitives</CardTitle>
                <CardDescription>
                  Reusable components from <code className="font-mono text-xs">src/components/ui/button.tsx</code>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="default">Default Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="destructive" size="sm">Destructive</Button>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Button size="sm" className="rounded-full bg-gold text-gold-foreground hover:bg-gold/90">
                    Gold Action Pill
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full">
                    Rounded Outline
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Live Calculation Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dynamic Fare & Currency State</CardTitle>
                <CardDescription>
                  Local state reactivity check with formatting for PKR ticket values.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-background">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Base Ticket Fare</span>
                    <div className="font-mono text-xl font-bold text-navy">
                      PKR {testAmount.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTestAmount((v) => Math.max(10000, v - 5000))}
                    >
                      -5,000
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTestAmount((v) => v + 5000)}
                    >
                      +5,000
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Estimated with 15% Taxes:{" "}
                  <strong className="text-navy font-mono">
                    PKR {Math.round(testAmount * 1.15).toLocaleString()}
                  </strong>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Direct Public Page Links</CardTitle>
            <CardDescription>
              Verify cross-navigation across the public website routes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Link
                to="/"
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-gold transition-colors text-xs font-semibold text-navy group"
              >
                <span>Homepage</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold" />
              </Link>
              <Link
                to="/services"
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-gold transition-colors text-xs font-semibold text-navy group"
              >
                <span>Our Services</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold" />
              </Link>
              <Link
                to="/verify-visa"
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-gold transition-colors text-xs font-semibold text-navy group"
              >
                <span>Verify Visa</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold" />
              </Link>
              <Link
                to="/calculator"
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:border-gold transition-colors text-xs font-semibold text-navy group"
              >
                <span>Travel Calculators</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-gold" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
