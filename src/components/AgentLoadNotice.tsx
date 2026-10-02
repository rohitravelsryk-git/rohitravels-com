import { AlertTriangle } from "lucide-react";

/**
 * The agent portal reads Supabase with the agent's own (RLS-scoped) session. When
 * that session has expired or a read fails, `data` comes back empty and the pages
 * would otherwise say "no records" — which reads as if the agency's bookings were
 * deleted. Every agent-portal list shows this notice instead of an empty table.
 */
export function describeAgentLoadFailure(input: { noSession?: boolean; errors: (string | null | undefined)[] }): string | null {
  if (input.noSession) {
    return "Your sign-in has ended, so your records could not be read. Nothing has been deleted — please sign in again.";
  }
  const messages = input.errors.filter(Boolean) as string[];
  if (!messages.length) return null;
  return `Your records could not be loaded (${messages.join("; ")}). They are safe — please try again.`;
}

export function AgentLoadNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-booking-amber/35 bg-booking-amber-soft/60 px-4 py-3 text-sm text-foreground"
    >
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-booking-amber" />
        <span>{message}</span>
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-booking-amber/40 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-booking-canvas"
        >
          Try again
        </button>
      )}
    </div>
  );
}
