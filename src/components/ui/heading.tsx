import * as React from "react";
import { cn } from "@/lib/utils";

const LEVEL_CLASSES: Record<1 | 2 | 3 | 4, string> = {
  1: "text-[clamp(2rem,4vw,3rem)] leading-[1.15] font-semibold tracking-[-0.02em]",
  2: "text-[clamp(1.5rem,3vw,2rem)] leading-[1.25] font-semibold tracking-[-0.02em]",
  3: "text-[1.25rem] leading-[1.35] font-semibold tracking-[-0.02em]",
  4: "text-lg leading-[1.4] font-semibold tracking-[-0.01em]",
};

export function Heading({
  level = 1,
  children,
  className,
}: {
  level?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}) {
  const Tag = (`h${level}` as const);
  return React.createElement(
    Tag,
    { className: cn(LEVEL_CLASSES[level], "font-sans text-text-primary", className) },
    children
  );
}
