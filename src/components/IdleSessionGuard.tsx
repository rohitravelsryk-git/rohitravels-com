import { useEffect, useRef, useState } from "react";
import { Clock, LogOut, RefreshCw } from "lucide-react";

type Props = {
  /** Portal name shown in the popup heading, e.g. "Admin Panel" or "Agent Portal". */
  portalName: string;
  /** Idle time in ms before the warning appears. Default 15 min. */
  idleMs?: number;
  /** Countdown in the warning modal before auto-logout. Default 60 s. */
  warningMs?: number;
  /** Called when the user chooses Logout or the countdown expires. */
  onLogout: () => void | Promise<void>;
};

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

export function IdleSessionGuard({
  portalName,
  idleMs = 10 * 60 * 1000,
  warningMs = 10 * 1000,
  onLogout,
}: Props) {
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(Math.ceil(warningMs / 1000));
  const idleTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);

  const clearIdle = () => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };
  const clearCountdown = () => {
    if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    countdownTimer.current = null;
  };

  const startIdle = () => {
    clearIdle();
    idleTimer.current = window.setTimeout(() => {
      setWarning(true);
      setRemaining(Math.ceil(warningMs / 1000));
    }, idleMs);
  };

  const stayLoggedIn = () => {
    setWarning(false);
    clearCountdown();
    startIdle();
  };

  const doLogout = async () => {
    clearIdle();
    clearCountdown();
    setWarning(false);
    await onLogout();
  };

  useEffect(() => {
    const onActivity = () => { if (!warning) startIdle(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    startIdle();
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      clearIdle();
      clearCountdown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning, idleMs]);

  useEffect(() => {
    if (!warning) return;
    countdownTimer.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearCountdown();
          void doLogout();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning]);

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-center gap-3 bg-[#0b2545] px-5 py-3 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Session Timeout</p>
            <h2 className="font-serif text-lg font-bold leading-tight">{portalName}</h2>
          </div>
        </div>
        <div className="px-5 py-5 text-sm text-gray-700">
          <p>
            You've been inactive for a while. For your security, this session will end automatically in{" "}
            <span className="font-mono font-bold text-red-600">{remaining}s</span>.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Choose <b>Continue Session</b> to stay signed in or <b>Logout</b> to end now.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
          <button
            onClick={doLogout}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
          <button
            onClick={stayLoggedIn}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Continue Session
          </button>
        </div>
      </div>
    </div>
  );
}
