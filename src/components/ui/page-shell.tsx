import * as React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "min-h-screen w-full bg-bg-primary px-4 py-14 sm:px-6 lg:px-8 lg:py-20 animate-page-enter",
        className
      )}
      style={{ maxWidth: "1200px", marginInline: "auto" }}
    >
      {children}
    </div>
  );
}
