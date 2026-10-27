import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shared scroll-reveal wrapper. Fades and lifts content in the first time it
 * enters the viewport (threshold 0.15, once per element). Pairs with the
 * `animate-reveal` utility in src/styles.css and is disabled automatically for
 * users who prefer reduced motion (the global reduced-motion rules neutralize
 * the animation).
 */
export function Reveal({
  children,
  className,
  as: Tag = "div",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
  delay?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const Comp = Tag as any;
  return (
    <Comp
      ref={ref as any}
      className={`${shown ? "animate-reveal" : "opacity-0"} ${className ?? ""}`.trim()}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Comp>
  );
}
