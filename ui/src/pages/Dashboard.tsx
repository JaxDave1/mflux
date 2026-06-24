import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components";
import { api } from "../lib/api";
import { offlineModelsResponse, offlineSystemStatus } from "../lib/fallbacks";
import { formatModelLabel } from "../lib/labels";
import type { GenerationOutput as GalleryItem, JobState, ModelsResponse } from "../lib/types";
import { useAppStore } from "../stores/useAppStore";
import { useJobStore } from "../stores/useJobStore";

const terminalJobStates = new Set<JobState>(["succeeded", "failed", "cancelled", "timed_out"]);
const MODELS_POLL_MS = 15000;
const GALLERY_POLL_MS = 15000;

function clampPercent(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function formatStat(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function jobProgressPercent(progress: {
  percent: number | null;
  step: number | null;
  total_steps: number | null;
}) {
  if (progress.percent != null) {
    return progress.percent;
  }
  if (progress.step != null && progress.total_steps) {
    return Math.round((progress.step / progress.total_steps) * 100);
  }
  return null;
}

function TelemetryBar({
  label,
  value,
  detail,
  percent,
  tone = "cyan"
}: {
  label: string;
  value: string;
  detail: string;
  percent: number;
  tone?: "cyan" | "error";
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-label text-[11px] font-medium uppercase tracking-[0.18em] text-metal-titanium-light">{label}</p>
          <p className="font-body text-sm font-medium text-white">{value}</p>
        </div>
        <p className="font-label text-[10px] uppercase tracking-[0.16em] text-on-surface-variant">{detail}</p>
      </div>
      <div className="bar-track shadow-[inset_0_1px_4px_rgba(0,0,0,0.55)]">
        <div
          className="bar-fill shadow-[0_0_12px_rgba(0,212,200,0.24)]"
          style={{ width: `${percent}%` }}
          data-tone={tone}
        />
      </div>
    </div>
  );
}

function QuickActionCard({
  to,
  icon,
  title,
  subtitle
}: {
  to: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to}
      className="raised-control group flex min-h-[124px] items-center gap-5 rounded-2xl px-6 py-5 transition duration-200"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-metal-titanium-light/18 bg-[linear-gradient(180deg,rgba(215,224,234,0.16),rgba(10,26,47,0.94))] shadow-[inset_0_1px_0_rgba(243,247,251,0.18),0_6px_12px_rgba(0,0,0,0.28)]">
        <Icon className="text-[28px] text-secondary transition duration-200" name={icon} />
      </div>
      <div className="min-w-0">
        <p className="font-headline text-lg font-semibold uppercase tracking-[0.08em] text-white">{title}</p>
        <p className="mt-1 font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{subtitle}</p>
      </div>
    </Link>
  );
}

function shortenPath(path: string, maxLength = 42) {
  if (path.length <= maxLength) {
    return path;
  }
  const head = Math.max(12, Math.floor(maxLength * 0.45));
  const tail = maxLength - head - 1;
  return `${path.slice(0, head)}…${path.slice(-tail)}`;
}

export function Dashboard() {
  const backendOnline = useAppStore((state) => state.backendOnline);
  const systemStatus = useAppStore((state) => state.systemStatus) ?? offlineSystemStatus;
  const jobs = useJobStore((state) => state.jobs);
  const [models, setModels] = useState<ModelsResponse>(offlineModelsResponse);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let modelsPollElapsed = 0;
    let galleryPollElapsed = 0;

    const refreshModels = async () => {
      try {
        const nextModels = await api.models();
        if (!cancelled) {
          setModels(nextModels);
        }
      } catch {
        if (!cancelled) {
          setModels(offlineModelsResponse);
        }
      }
    };

    const refreshGallery = async () => {
      try {
        const response = await api.gallery();
        if (!cancelled) {
          setGallery(response.items);
        }
      } catch {
        if (!cancelled) {
          setGallery([]);
        }
      }
    };

    void Promise.allSettled([api.models(), api.gallery()]).then(([modelsResult, galleryResult]) => {
      if (cancelled) {
        return;
      }
      setModels(modelsResult.status === "fulfilled" ? modelsResult.value : offlineModelsResponse);
      setGallery(galleryResult.status === "fulfilled" ? galleryResult.value.items : []);
      setLoading(false);
    });

    const timer = window.setInterval(() => {
      modelsPollElapsed += 2000;
      galleryPollElapsed += 2000;
      if (modelsPollElapsed >= MODELS_POLL_MS) {
        modelsPollElapsed = 0;
        void refreshModels();
      }
      if (galleryPollElapsed >= GALLERY_POLL_MS) {
        galleryPollElapsed = 0;
        void refreshGallery();
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const galleryPreview = useMemo(
    () => gallery.filter((item) => item.moduleType !== "controlnet-preview").slice(0, 6),
    [gallery]
  );

  const activeJobs = useMemo(
    () => jobs.filter((job) => !terminalJobStates.has(job.state)),
    [jobs]
  );

  const cachedBuiltinCount = useMemo(
    () =>
      models.builtin.filter((model) => model.metadata.cached || model.metadata.installed).length,
    [models.builtin]
  );
  const activeJobsCount = Math.max(systemStatus.activeJobs, activeJobs.length);

  const memoryUsed = systemStatus.memory.used ?? 0;
  const memoryTotal = systemStatus.memory.total ?? 0;
  const mlxRuntimeUsed = systemStatus.mlxCache.used ?? 0;
  const mlxRuntimeTotal = systemStatus.mlxCache.total ?? memoryTotal;
  const modelDiskUsed = systemStatus.modelDiskCache?.used ?? 0;
  const cachedModelCount = systemStatus.cachedModelCount ?? cachedBuiltinCount;
  const diskUsed = systemStatus.diskSpace.used ?? 0;
  const diskTotal = systemStatus.diskSpace.total ?? 0;
  const diskFree = Math.max(0, Number((diskTotal - diskUsed).toFixed(1)));
  const memoryPercent = clampPercent(memoryUsed, memoryTotal);
  const mlxRuntimePercent = clampPercent(mlxRuntimeUsed, mlxRuntimeTotal);
  const mlxRuntimeDetail =
    activeJobsCount > 0 ? "INFERENCE PROCESS RSS" : "IDLE · NO ACTIVE INFERENCE";
  const modelDiskDetail = `${cachedModelCount} MFLUX MODEL${cachedModelCount === 1 ? "" : "S"} ON DISK`;
  const diskUsedPercent = clampPercent(diskUsed, diskTotal);

  const liveNeuralPercent = useMemo(() => {
    const runningJobs = activeJobs.filter((job) => job.state === "running");
    if (runningJobs.length) {
      const progressValues = runningJobs
        .map((job) => jobProgressPercent(job.progress))
        .filter((value): value is number => value != null);
      if (progressValues.length) {
        return Math.max(...progressValues);
      }
    }
    if (activeJobs.some((job) => job.state === "queued")) {
      return 3;
    }
    return systemStatus.neuralEngine.load ?? 0;
  }, [activeJobs, systemStatus.neuralEngine.load]);

  const runningJob = activeJobs.find((job) => job.state === "running") ?? activeJobs[0];
  const runningModelId =
    (typeof runningJob?.params?.model === "string" && runningJob.params.model) ||
    (typeof runningJob?.params?.model_name === "string" && runningJob.params.model_name) ||
    null;
  const runningQuantize =
    typeof runningJob?.params?.quantize === "number"
      ? runningJob.params.quantize
        ? `Q${runningJob.params.quantize}`
        : "OFF"
      : null;

  const platformLabel = (systemStatus.platform || offlineSystemStatus.platform).toUpperCase();
  const loadedModelName = formatModelLabel(
    runningModelId ?? systemStatus.loadedModel?.name ?? offlineSystemStatus.loadedModel?.name ?? "FLUX.1 Dev"
  ).toUpperCase();
  const loadedModelQuantize = (
    runningQuantize ?? systemStatus.loadedModel?.quantize ?? "q8"
  ).toUpperCase();
  const modelCardDetail = runningModelId
    ? `RUNNING · ${loadedModelQuantize}`
    : `DEFAULT · ${loadedModelQuantize} · ${cachedModelCount} CACHED`;

  const platformDetail =
    memoryTotal > 0 ? `MEMORY LOAD ${memoryPercent}%` : "LOCAL APPLE SILICON";
  const activeJobsValue = `${activeJobsCount}`;
  const activeJobsDetail =
    backendOnline === false
      ? "BACKEND OFFLINE"
      : activeJobsCount > 0
        ? activeJobs
            .slice(0, 2)
            .map((job) => {
              const progress = jobProgressPercent(job.progress);
              const progressLabel = progress != null ? ` ${progress}%` : "";
              return `${job.module.replace(/_/g, "-").toUpperCase()} · ${job.state.toUpperCase()}${progressLabel}`;
            })
            .join(" • ")
        : "QUEUE STATUS: STEADY";
  const diskPathLabel = systemStatus.diskPath ? shortenPath(systemStatus.diskPath) : "PATH UNAVAILABLE";
  const engineDetail =
    activeJobsCount > 0
      ? `${liveNeuralPercent}% LOAD · ${systemStatus.neuralEngine.status}`
      : systemStatus.neuralEngine.status.replace(/_/g, " ");

  if (loading) {
    return (
      <div className="content-shell">
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 font-label text-sm uppercase tracking-[0.18em] text-[#A0B4D0]">
          <div className="h-9 w-9 rounded-full border border-secondary/25 border-t-secondary animate-spin" />
          <div>Dashboard Loading</div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-shell">
      <main className="mx-auto max-w-[1440px]">
        <header className="mb-10">
          <h1 className="titanium-text mb-2 font-headline text-4xl font-semibold uppercase tracking-[0.04em]">
            SYSTEM DASHBOARD
          </h1>
          <p className="font-body text-[15px] tracking-wide text-on-surface-variant">
            {backendOnline === false
              ? "Backend offline • Showing local shell state"
              : activeJobsCount > 0
                ? `Live telemetry • ${activeJobsCount} job${activeJobsCount === 1 ? "" : "s"} in flight`
                : `Live telemetry • ${gallery.length} outputs indexed`}
          </p>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="mirror-panel rounded-xl p-5 transition duration-150">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">PLATFORM</span>
              <Icon className="text-base text-secondary" name="deployed_code" />
            </div>
            <div className="space-y-2">
              <div className="titanium-text font-headline text-[1.7rem] font-semibold leading-tight">{platformLabel}</div>
              <div className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{platformDetail}</div>
            </div>
          </div>

          <div className="mirror-panel rounded-xl p-5 transition duration-150">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">ENGINE</span>
              <Icon className="text-base text-secondary" name="bolt" />
            </div>
            <div className="space-y-2">
              <div className="titanium-text font-headline text-[1.7rem] font-semibold leading-tight">
                {liveNeuralPercent > 0 ? `${liveNeuralPercent}%` : "IDLE"}
              </div>
              <div className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">{engineDetail}</div>
            </div>
          </div>

          <div className="mirror-panel rounded-xl p-5 transition duration-150">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">ACTIVE JOBS</span>
              <Icon className="text-base text-secondary" name="hourglass_top" />
            </div>
            <div className="space-y-2">
              <div className="titanium-text font-headline text-[1.7rem] font-semibold leading-tight">
                {activeJobsValue}
              </div>
              <div className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                {activeJobsDetail}
              </div>
            </div>
          </div>

          <div className="mirror-panel rounded-xl p-5 transition duration-150">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">MODEL</span>
              <Icon className="text-base text-secondary" name="view_in_ar" />
            </div>
            <div className="space-y-2">
              <div className="titanium-text font-headline text-[1.7rem] font-semibold leading-tight">{loadedModelName}</div>
              <div className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                {modelCardDetail}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <section className="panel-composite scan-grid rounded-2xl p-6">
            <div className="mb-6 flex items-center gap-3">
              <Icon className="text-secondary" name="monitoring" />
              <h2 className="titanium-text font-headline text-lg font-semibold uppercase tracking-[0.12em]">
                RESOURCES
              </h2>
            </div>

            <div className="recessed-panel space-y-6 rounded-2xl px-6 py-6">
              <TelemetryBar
                label="Unified Memory"
                value={`${formatStat(memoryUsed)} GB / ${formatStat(memoryTotal)} GB`}
                detail={`${memoryPercent}% USED`}
                percent={memoryPercent}
              />
              <TelemetryBar
                label="MLX Runtime"
                value={`${formatStat(mlxRuntimeUsed)} GB / ${formatStat(mlxRuntimeTotal)} GB`}
                detail={mlxRuntimeDetail}
                percent={mlxRuntimePercent}
              />
              <TelemetryBar
                label="Model Disk Cache"
                value={`${formatStat(modelDiskUsed)} GB`}
                detail={modelDiskDetail}
                percent={diskTotal > 0 ? clampPercent(modelDiskUsed, diskTotal) : 0}
              />
              <TelemetryBar
                label="Disk Space"
                value={`${formatStat(diskFree)} GB FREE / ${formatStat(diskTotal)} GB`}
                detail={diskPathLabel}
                percent={diskUsedPercent}
              />
              <TelemetryBar
                label="Neural Engine"
                value={activeJobsCount > 0 ? "INFERENCE ACTIVE" : "STANDBY"}
                detail={`${liveNeuralPercent}% LOAD`}
                percent={liveNeuralPercent}
                tone={activeJobsCount > 0 ? "cyan" : "error"}
              />
            </div>
          </section>

          <aside className="mirror-panel rounded-2xl p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Icon className="text-secondary" name="gallery_thumbnail" />
                <h2 className="titanium-text font-headline text-base font-semibold uppercase tracking-[0.12em]">
                  RECENT OUTPUTS
                </h2>
              </div>
              <Link
                to="/gallery"
                className="font-label text-[10px] uppercase tracking-[0.18em] text-secondary transition hover:text-metal-chrome"
              >
                {gallery.length > 0 ? `${gallery.length} TOTAL` : "View All"}
              </Link>
            </div>

            {galleryPreview.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {galleryPreview.map((item) => (
                  <Link
                    key={item.id}
                    to="/gallery"
                    className="group relative aspect-square overflow-hidden rounded-xl border border-metal-titanium-light/18 bg-[linear-gradient(180deg,rgba(8,22,43,0.92),rgba(5,13,28,0.94))] shadow-[inset_0_1px_0_rgba(243,247,251,0.08)] transition duration-150 hover:border-secondary/35 hover:shadow-[0_0_18px_rgba(0,212,200,0.12)]"
                  >
                    <img
                      alt={item.prompt}
                      src={
                        item.thumbnailPath ??
                        `/api/gallery/file?path=${encodeURIComponent(item.path)}`
                      }
                      className="h-full w-full object-cover opacity-90 transition duration-200 group-hover:scale-[1.02] group-hover:opacity-100"
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-outline/18 bg-[linear-gradient(180deg,rgba(8,22,43,0.88),rgba(5,13,28,0.92))] px-4 py-10 text-center font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">
                {backendOnline === false
                  ? "NO OUTPUTS INDEXED. START BACKEND TO SCAN OUTPUT DIRECTORY."
                  : "NO OUTPUTS INDEXED"}
              </div>
            )}
          </aside>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <QuickActionCard to="/txt2img" icon="edit_square" title="QUICK TXT2IMG" subtitle="FROM PROMPT" />
          <QuickActionCard to="/img2img" icon="image_search" title="QUICK IMG2IMG" subtitle="REFERENCE TRANSFORM" />
          <QuickActionCard to="/upscaler" icon="high_quality" title="QUICK UPSCALE" subtitle="SUPER-RESOLUTION" />
        </div>
      </main>
    </div>
  );
}