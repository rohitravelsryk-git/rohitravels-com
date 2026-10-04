import * as React from "react";
import { cn } from "@/lib/utils";

const VARIANT_CLASSES = {
  body: "text-[0.95rem] font-normal leading-7 text-text-secondary",
  small: "text-sm font-normal leading-6 text-text-secondary",
  meta: "text-xs font-medium uppercase tracking-[0.06em] text-text-muted",
  urdu: "font-urdu text-[1.05rem] leading-[2.15] text-text-secondary",
} as const;

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
  return React.createElement(
    Tag,
    { ...props, className: cn(VARIANT_CLASSES[variant], className) },
    children
  );
}
