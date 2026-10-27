import * as React from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main
      className={cn(
        "min-h-screen w-full bg-bg-primary px-4 py-14 sm:px-6 sm:py-14 lg:px-8 lg:py-20 animate-page-enter",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[1200px]">{children}</div>
    </main>
  );
}
