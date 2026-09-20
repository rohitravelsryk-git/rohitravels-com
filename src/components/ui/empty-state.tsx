import * as React from "react";
import { Heading } from "./heading";
import { Text } from "./text";
import { Button } from "./button";

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
    <div className="flex flex-col items-center gap-4 rounded-lg bg-bg-secondary p-10 text-center shadow-sm transition duration-base ease-base hover:-translate-y-0.5 hover:shadow-md">
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent-subtle text-accent">
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
