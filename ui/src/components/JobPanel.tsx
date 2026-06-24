import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Job } from "../lib/types";
import { useJobStore } from "../stores/useJobStore";
import { Icon } from "./Icon";

const moduleLabels: Record<string, string> = {
  txt2img: "Txt2Img",
  img2img: "Img2Img",
  inpaint: "Inpaint",
  controlnet: "ControlNet",
  kontext: "Kontext",
  upscaler: "Upscaler",
  depth_pro: "Depth Pro",
  model_download: "Model Download",
  civitai_download: "CivitAI Download",
  model_export: "Model Export"
};

const moduleRoutes: Record<string, string> = {
  txt2img: "/txt2img",
  img2img: "/img2img",
  inpaint: "/inpaint",
  controlnet: "/controlnet",
  kontext: "/kontext",
  upscaler: "/upscaler",
  depth_pro: "/depth-pro",
  model_download: "/models",
  civitai_download: "/models",
  model_export: "/models"
};

function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) {
    return "--";
  }
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function JobPanel() {
  const jobs = useJobStore((state) => state.jobs);
  const loadJobs = useJobStore((state) => state.loadJobs);
  const cancelJob = useJobStore((state) => state.cancelJob);
  const [shellJobs, setShellJobs] = useState<Job[]>([]);
  const activeJobs = useMemo(
    () => {
      const byId = new Map<string, Job>();
      [...jobs, ...shellJobs].forEach((job) => {
        if (!["succeeded", "failed", "cancelled", "timed_out"].includes(job.state)) {
          byId.set(job.id, job);
        }
      });
      return [...byId.values()];
    },
    [jobs, shellJobs]
  );

  useEffect(() => {
    const refreshJobs = async () => {
      const response = await api.jobs(false);
      setShellJobs(response.jobs);
      await loadJobs(false);
    };
    void refreshJobs();
    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadJobs]);

  if (!activeJobs.length) {
    return null;
  }

  return (
    <aside className="fixed bottom-5 right-5 z-[100] w-[360px] max-w-[calc(100vw-112px)] space-y-3">
      {activeJobs.map((job) => {
        const percent = job.progress.percent ?? 0;
        const hasSteps = job.progress.step !== null && job.progress.total_steps !== null;
        return (
          <div key={job.id} className="mirror-panel rounded-xl p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <Link
                  to={moduleRoutes[job.module] ?? "/"}
                  className="font-label text-[11px] uppercase tracking-[0.18em] text-secondary"
                >
                  {moduleLabels[job.module] ?? job.module}
                </Link>
                <div className="mt-1 font-body text-sm text-on-surface">
                  {job.state === "queued"
                    ? "Queued"
                    : job.module === "model_download" || job.module === "civitai_download"
                      ? "Download running"
                      : job.module === "model_export"
                        ? "Export running"
                        : "Generation running"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void cancelJob(job.id)}
                className="rounded-md border border-error/35 bg-error/10 px-2 py-1 font-label text-[10px] uppercase tracking-[0.12em] text-error transition hover:bg-error/20"
              >
                Cancel
              </button>
            </div>

            <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
              <span>Elapsed {formatDuration(job.progress.elapsed_ms)}</span>
              <span>ETA {formatDuration(job.progress.eta_ms)}</span>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${job.progress.source === "indeterminate" ? "animate-pulse" : ""}`}
                style={{ width: `${job.progress.source === "indeterminate" ? 35 : percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 font-label text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">
              <span>{hasSteps ? `Step ${job.progress.step}/${job.progress.total_steps}` : job.progress.source}</span>
              <span className="flex items-center gap-1 text-secondary">
                <Icon name="progress_activity" className="text-sm" />
                {job.state}
              </span>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
