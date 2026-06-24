import { useState } from "react";
import type { Job } from "../lib/types";
import { useJobStore } from "../stores/useJobStore";

function jobStatusPill(job: Job | null) {
  if (!job) {
    return { label: "IDLE", className: "status-pill opacity-70" };
  }
  if (job.state === "running" || job.state === "queued") {
    return { label: job.state.toUpperCase(), className: "status-pill" };
  }
  if (job.state === "succeeded") {
    return { label: "COMPLETE", className: "status-pill" };
  }
  if (job.state === "failed" || job.state === "timed_out") {
    return {
      label: job.state === "failed" ? "FAILED" : "TIMED OUT",
      className: "status-pill border-[rgba(255,77,107,0.45)] bg-[rgba(255,77,107,0.12)] text-[#ff8fa3]"
    };
  }
  return { label: job.state.toUpperCase(), className: "status-pill opacity-80" };
}

function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "--:--";
  }
  const seconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RunningStatePreview({
  job,
  stepwiseImages
}: {
  job: Job | null;
  stepwiseImages: string[];
}) {
  const cancelJob = useJobStore((state) => state.cancelJob);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const latestPreview = stepwiseImages[stepwiseImages.length - 1];
  const isRunning = job?.state === "running" || job?.state === "queued";
  const finalImage = job?.state === "succeeded" ? job.output?.output_url : null;
  const image = finalImage ?? latestPreview;
  const percent = job?.progress.percent ?? 0;
  const isFinal = Boolean(finalImage);
  const status = jobStatusPill(job);
  const waitingMessage = isRunning
    ? latestPreview
      ? "Rendering stepwise preview…"
      : "Generation in progress — output appears here when complete."
    : "NO ACTIVE JOB";

  const handleCancel = async () => {
    if (!job) {
      return;
    }
    setCancelError(null);
    setCancelling(true);
    try {
      await cancelJob(job.id);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel job");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="module-preview-stage overflow-hidden rounded-panel border border-outline-variant/60 bg-surface-container-low">
      <div className={`aspect-video w-full bg-black/25 ${isFinal ? "preview-stage-final" : ""}`}>
        {image ? (
          <img
            key={image}
            src={image}
            alt="Generation preview"
            className={`h-full w-full object-contain ${isFinal ? "preview-reveal-final" : "preview-reveal-step"}`}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-on-surface-variant">
            {job && (job.state === "running" || job.state === "queued") ? (
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-secondary/20 border-t-secondary" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-metal-titanium-light/18 bg-[linear-gradient(180deg,rgba(8,22,43,0.92),rgba(5,13,28,0.94))] font-headline text-sm text-metal-titanium-light">
                MX
              </div>
            )}
            <div className="font-label text-xs tracking-[0.18em]">
              {job ? (isRunning ? "GENERATING" : "WAITING FOR PREVIEW") : waitingMessage}
            </div>
            {job && isRunning ? (
              <div className="font-body text-xs text-[var(--color-text-muted)]">{waitingMessage}</div>
            ) : null}
          </div>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className={status.className}>
            <span className="status-pill-dot" />
            {status.label}
          </span>
          <div className="flex items-center gap-2">
            {isRunning && job ? (
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancelling}
                className="rounded-md border border-error/35 bg-error/10 px-2 py-1 font-label text-[10px] uppercase tracking-[0.12em] text-error transition hover:bg-error/20 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            ) : null}
            <span className="font-mono text-xs text-[var(--color-text-secondary)]">
              {job?.progress.step && job.progress.total_steps
                ? `STEP ${job.progress.step}/${job.progress.total_steps}`
                : `${percent || 0}%`}
            </span>
          </div>
        </div>
        {cancelError ? (
          <div className="rounded-md border border-error/25 bg-error/10 px-2 py-2 font-label text-[10px] uppercase tracking-[0.12em] text-error">
            {cancelError}
          </div>
        ) : null}
        <div className="bar-track h-1.5">
          <div className="bar-fill h-full" style={{ width: `${Math.max(0, Math.min(100, percent || 0))}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-on-surface-variant">
          <div>
            <div className="font-label tracking-[0.18em]">ELAPSED</div>
            <div className="mt-1 font-mono text-on-surface">{formatMs(job?.progress.elapsed_ms)}</div>
          </div>
          <div>
            <div className="font-label tracking-[0.18em]">ETA</div>
            <div className="mt-1 font-mono text-on-surface">{formatMs(job?.progress.eta_ms)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}