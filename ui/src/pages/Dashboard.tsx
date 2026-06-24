import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components";
import { api } from "../lib/api";
import { offlineModelsResponse, offlineSystemStatus } from "../lib/fallbacks";
import { formatModelLabel } from "../lib/labels";
import type { GenerationOutput as GalleryItem, ModelsResponse, SystemStatus } from "../lib/types";
import { useAppStore } from "../stores/useAppStore";

function clampPercent(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function formatStat(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
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

export function Dashboard() {
  const backendOnline = useAppStore((state) => state.backendOnline);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>(offlineSystemStatus);
  const [models, setModels] = useState<ModelsResponse>(offlineModelsResponse);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.allSettled([api.systemStatus(), api.models(), api.gallery()]).then(
      ([statusResult, modelsResult, galleryResult]) => {
        if (cancelled) {
          return;
        }

        setSystemStatus(
          statusResult.status === "fulfilled" ? statusResult.value : offlineSystemStatus
        );
        setModels(modelsResult.status === "fulfilled" ? modelsResult.value : offlineModelsResponse);
        setGallery(galleryResult.status === "fulfilled" ? galleryResult.value.items : []);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const galleryPreview = useMemo(
    () => gallery.filter((item) => item.moduleType !== "controlnet-preview").slice(0, 6),
    [gallery]
  );

  const memoryUsed = systemStatus?.memory.used ?? 0;
  const memoryTotal = systemStatus?.memory.total ?? 0;
  const mlxCacheUsed = systemStatus?.mlxCache.used ?? 0;
  const mlxCacheTotal = systemStatus?.mlxCache.total ?? 0;
  const diskUsed = systemStatus?.diskSpace.used ?? 0;
  const diskTotal = systemStatus?.diskSpace.total ?? 0;
  const diskFree = Math.max(0, Number((diskTotal - diskUsed).toFixed(1)));
  const memoryPercent = clampPercent(memoryUsed, memoryTotal);
  const mlxCachePercent = clampPercent(mlxCacheUsed, mlxCacheTotal);
  const diskUsedPercent = clampPercent(diskUsed, diskTotal);
  const neuralPercent = Math.max(
    systemStatus?.neuralEngine.active ? 82 : 0,
    systemStatus?.neuralEngine.load
      ? clampPercent(
          systemStatus.neuralEngine.load <= 1
            ? systemStatus.neuralEngine.load * 100
            : systemStatus.neuralEngine.load,
          100
        )
      : 0
  );

  const platformLabel = (systemStatus.platform || offlineSystemStatus.platform).toUpperCase();
  const loadedModelName = formatModelLabel(
    systemStatus.loadedModel?.name ??
      models.builtin.find((model) => model.active)?.name ??
      offlineSystemStatus.loadedModel?.name ??
      "FLUX.1 Dev"
  ).toUpperCase();
  const platformDetail =
    memoryTotal > 0 ? `MEMORY LOAD ${memoryPercent}%` : "LOCAL APPLE SILICON";
  const activeJobsValue = `${systemStatus.activeJobs}`;
  const activeJobsDetail =
    backendOnline === false
      ? "BACKEND OFFLINE"
      : systemStatus.activeJobs > 0
        ? "RUNS IN FLIGHT"
        : "QUEUE STATUS: STEADY";

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
              : "All systems nominal • Local Flux inference ready"}
          </p>
        </header>

        {/* ── Top cards ── */}
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
              <div className="titanium-text font-headline text-[1.7rem] font-semibold leading-tight">MLX NEURAL</div>
              <div className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">OPTIMIZED FOR METAL</div>
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
              <span className="font-label text-[10px] uppercase tracking-[0.22em] text-on-surface-variant">MODEL LOADED</span>
              <Icon className="text-base text-secondary" name="view_in_ar" />
            </div>
            <div className="space-y-2">
              <div className="titanium-text font-headline text-[1.7rem] font-semibold leading-tight">{loadedModelName}</div>
              <div className="font-label text-[10px] uppercase tracking-[0.18em] text-on-surface-variant">VRAM USAGE: {formatStat(mlxCacheUsed)}GB</div>
            </div>
          </div>
        </div>

        {/* ── Telemetry + Recent ── */}
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
                label="MLX Cache"
                value={`${formatStat(mlxCacheUsed)} GB`}
                detail={`${formatStat(mlxCacheTotal)} GB`}
                percent={mlxCachePercent}
              />
              <TelemetryBar
                label="Disk Space"
                value={`${formatStat(diskFree)} GB FREE`}
                detail={`${formatStat(diskTotal)} GB`}
                percent={diskUsedPercent}
              />
              <TelemetryBar
                label="Neural Engine"
                value={systemStatus.neuralEngine.active ? "ACTIVE" : "OFFLINE"}
                detail={`${neuralPercent}% LOAD`}
                percent={neuralPercent}
                tone={systemStatus.neuralEngine.active ? "cyan" : "error"}
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
                View All
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

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <QuickActionCard to="/txt2img" icon="edit_square" title="QUICK TXT2IMG" subtitle="FROM PROMPT" />
          <QuickActionCard to="/img2img" icon="image_search" title="QUICK IMG2IMG" subtitle="REFERENCE TRANSFORM" />
          <QuickActionCard to="/upscaler" icon="high_quality" title="QUICK UPSCALE" subtitle="SUPER-RESOLUTION" />
        </div>
      </main>
    </div>
  );
}
