import * as React from "react";
import { Heading } from "./heading";
import { Text } from "./text";
import { Button } from "./button";

/**
 * Standard empty/no-results state: icon, title, description, and an
 * optional action. Opt-in for new pages — existing empty states are not
 * required to switch to this.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-card p-10 text-center shadow-sm">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-subtle text-gold">
          {icon}
        </div>
      )}
      <Heading level={3}>{title}</Heading>
      <Text variant="body">{description}</Text>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
