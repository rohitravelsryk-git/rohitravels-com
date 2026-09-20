import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  body: "text-base leading-[1.65] text-muted-foreground",
  small: "text-sm leading-[1.5] text-muted-foreground",
  meta: "text-[0.8125rem] font-medium uppercase tracking-[0.01em] text-muted-foreground/80",
  urdu: "font-urdu leading-[2.2] text-[1.05rem]",
} as const;

/**
 * Consistent body/small/meta/Urdu text styling. Opt-in for new content —
 * existing copy is not required to switch to this.
 */
export function Text({
  variant = "body",
  as: Tag = "p",
  children,
  className,
  ...props
}: {
  variant?: keyof typeof VARIANT_CLASSES;
  as?: "p" | "span" | "label" | "figcaption";
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className">) {
  return React.createElement(Tag, { ...props, className: cn(VARIANT_CLASSES[variant], className) }, children);
}
