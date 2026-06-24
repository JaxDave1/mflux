import { useEffect, useState } from "react";
import { useAppStore } from "../stores/useAppStore";

export function StatusBar({ className = "" }: { className?: string }) {
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString([], { hour12: false })
  );
  const backendOnline = useAppStore((state) => state.backendOnline);
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour12: false }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const isOnline = backendOnline ?? browserOnline;

  return (
    <header
      className={`app-header fixed right-0 top-0 z-30 flex h-status items-center justify-between px-6 left-[72px] ${className}`}
    >
      <div className="titanium-text hidden whitespace-nowrap font-headline text-lg font-semibold uppercase tracking-[0.08em] md:block">
        MFLUX NEURAL INTERFACE
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div
          className={`status-pill ${
            isOnline
              ? ""
              : "border-error/30 bg-error/10 text-error"
          }`}
        >
          <span
            className={`status-pill-dot animate-pulse-dot ${
              isOnline
                ? ""
                : "bg-error shadow-[0_0_10px_rgba(255,77,107,0.4)]"
            }`}
          />
          {isOnline ? "SYSTEM ONLINE" : "SYSTEM OFFLINE"}
        </div>
        <div className="titanium-text font-mono text-xs">{clock}</div>
      </div>
    </header>
  );
}
