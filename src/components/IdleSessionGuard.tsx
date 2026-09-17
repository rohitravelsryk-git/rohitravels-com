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

  /**
   * Break through even when the admin is in another tab/app:
   *  • a desktop (OS-level) notification that sits above the browser
   *  • an audible beep
   *  • a flashing tab title
   * All of these degrade gracefully when unsupported or denied.
   */
  useEffect(() => {
    if (!warning) return;
    let sysNotif: Notification | null = null;
    const originalTitle = document.title;

    try {
      const beep = new AudioContext();
      const osc = beep.createOscillator();
      const gain = beep.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(beep.destination);
      osc.start();
      osc.stop(beep.currentTime + 0.35);
    } catch { /* autoplay blocked */ }

    const showSystem = () => {
      try {
        sysNotif = new Notification(`${portalName} — session about to expire`, {
          body: "Click here to continue your session or log out.",
          requireInteraction: true,
          tag: "rohi-session-timeout",
        } as NotificationOptions);
        sysNotif.onclick = () => { try { window.focus(); } catch { /* noop */ } sysNotif?.close(); };
      } catch { /* noop */ }
    };
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") showSystem();
      else if (Notification.permission === "default") void Notification.requestPermission().then((p) => { if (p === "granted") showSystem(); });
    }

    const flash = window.setInterval(() => {
      document.title = document.title.startsWith("⚠") ? originalTitle : `⚠ Session expiring — ${portalName}`;
    }, 1000);

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
    return () => {
      clearCountdown();
      window.clearInterval(flash);
      document.title = originalTitle;
      sysNotif?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warning]);


  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:hidden">
      <div className="w-full max-w-[440px] overflow-hidden rounded-[18px] bg-[#faf9f7] p-5 shadow-[0_24px_70px_-15px_rgba(0,0,0,0.5)] ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] text-gray-500">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>Session timeout</span>
          </div>
          <button
            onClick={stayLoggedIn}
            aria-label="Dismiss"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-black/5 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[22px] font-semibold leading-[1.2] text-gray-900">
              You're about to be signed out
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
              {portalName} ends this session in <span className="font-mono font-bold text-[#c1553b]">{remaining}s</span> after inactivity.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={stayLoggedIn}
                className="inline-flex items-center gap-2 rounded-lg bg-[#141413] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black active:scale-[0.98]"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Continue session
              </button>
              <button
                onClick={doLogout}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-gray-600 transition-colors hover:bg-black/5"
              >
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            </div>
          </div>
          <div className="flex h-[110px] w-[110px] shrink-0 items-center justify-center rounded-xl bg-[#c1553b] text-white">
            <Clock className="h-12 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
