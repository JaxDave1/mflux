import type { ReactNode } from "react";
import { GenerateButton } from "./GenerateButton";

export function ConfirmModal({
  title,
  children,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 px-4">
      <div className="mirror-panel w-full max-w-lg rounded-xl border border-error/40 p-5 shadow-[0_0_36px_rgba(255,77,107,0.16)]">
        <div className="font-headline text-xl font-bold uppercase tracking-[0.08em] text-on-surface">{title}</div>
        <div className="mt-4 text-sm leading-6 text-on-surface-variant">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <GenerateButton onClick={onCancel} variant="ghost" label="CANCEL" disabled={busy} />
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-panel border border-error/60 bg-error/15 px-4 py-3 font-label text-xs uppercase tracking-[0.24em] text-error transition hover:bg-error/25 hover:shadow-[0_0_18px_rgba(255,77,107,0.24)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "DELETING" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
