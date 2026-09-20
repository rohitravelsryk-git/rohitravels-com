import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Consistent page container: constrained width, standard vertical rhythm,
 * and a fade+rise entrance. Opt-in for new pages — existing routes are not
 * required to adopt this.
 */
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-h-screen w-full bg-background px-4 py-14 sm:px-6 lg:px-8 lg:py-20 animate-fade-up",
        className
      )}
      style={{ maxWidth: "1200px", marginInline: "auto" }}
    >
      {children}
    </div>
  );
}
