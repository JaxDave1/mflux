import { useEffect, useState } from "react";
import { useAppStore } from "../stores/useAppStore";

export function StatusBar({ className = "" }: { className?: string }) {
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString([], { hour12: false })
  );
  const status = useAppStore((state) => state.systemStatus);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour12: false }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header
      className={`scanline frosted fixed right-0 top-0 z-30 flex h-status items-center justify-between border-b border-primary/30 px-6 left-[72px] ${className}`}
    >
      <div className="font-headline text-lg font-bold tracking-tight text-primary neon-text-primary">
        MFLUX NEURAL INTERFACE
      </div>
      <div className="hidden font-label text-xs tracking-[0.3em] text-on-surface-variant md:block">
        {status?.platform ?? "M3 MAX"} · MLX / MPS
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-label text-xs tracking-[0.24em] text-secondary">
          <span className="h-2 w-2 rounded-full bg-secondary shadow-glow-secondary animate-pulse-dot" />
          ONLINE
        </div>
        <div className="font-mono text-xs text-on-surface-variant">{clock}</div>
      </div>
    </header>
  );
}
