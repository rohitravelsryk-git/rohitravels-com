import * as React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "min-h-screen w-full bg-bg-primary px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16 animate-page-enter",
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </main>
  );
}
