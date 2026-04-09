import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { ModelsResponse, SystemStatus, GenerationOutput as GalleryItem } from "../lib/types";

function clampPercent(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function formatStat(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function relativeTime(value?: string) {
  if (!value) {
    return "NO RUNS";
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "NO RUNS";
  }
  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 60000));
  if (diffMinutes < 1) {
    return "JUST NOW";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
}

function TopCard({
  icon,
  label,
  value,
  subtitle,
  iconClassName = "text-secondary",
  subtitleClassName = "text-secondary neon-glow-secondary"
}: {
  icon: string;
  label: string;
  value: string;
  subtitle: string;
  iconClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container p-4 transition-all hover:neon-border-secondary">
      <div className="mb-2 flex items-center gap-3">
        <span className={`material-symbols-outlined text-xl ${iconClassName}`}>{icon}</span>
        <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</span>
      </div>
      <h3 className="font-headline text-lg font-bold text-on-surface">{value}</h3>
      <p className={`font-label text-xs tracking-widest ${subtitleClassName}`}>{subtitle}</p>
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
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-primary/30 bg-surface-container p-8 transition-all duration-300 hover:border-primary"
    >
      <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="material-symbols-outlined mb-4 text-5xl text-secondary neon-glow-secondary transition-transform group-hover:scale-110">
          {icon}
        </span>
        <h5 className="mb-1 font-headline text-lg font-bold tracking-tight text-secondary">{title}</h5>
        <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">{subtitle}</p>
      </div>
      <div className="absolute right-0 top-0 p-2 opacity-30">
        <span className="material-symbols-outlined text-xs text-primary">arrow_outward</span>
      </div>
    </Link>
  );
}

export function Dashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [models, setModels] = useState<ModelsResponse | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([api.systemStatus(), api.models(), api.gallery()])
      .then(([status, modelResponse, galleryResponse]) => {
        setSystemStatus(status);
        setModels(modelResponse);
        setGallery(galleryResponse.items);
      })
      .finally(() => setLoading(false));
  }, []);

  const cachedBuiltins = useMemo(
    () => models?.builtin.filter((item) => item.metadata.cached) ?? [],
    [models]
  );
  const galleryPreview = useMemo(
    () => gallery.filter((item) => item.moduleType !== "controlnet-preview").slice(0, 5),
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
      ? clampPercent(systemStatus.neuralEngine.load <= 1 ? systemStatus.neuralEngine.load * 100 : systemStatus.neuralEngine.load, 100)
      : 0
  );
  const sessionCount = useMemo(() => {
    if (!gallery.length) {
      return 0;
    }
    const today = new Date().toDateString();
    const runsToday = gallery.filter((item) => {
      const created = new Date(item.createdAt);
      return !Number.isNaN(created.getTime()) && created.toDateString() === today;
    }).length;
    return runsToday || gallery.length;
  }, [gallery]);
  const avgGenerationTime = useMemo(() => {
    const timed = gallery
      .map((item) => item.generationTimeSeconds)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (!timed.length) {
      return "N/A";
    }
    return `${(timed.reduce((sum, value) => sum + value, 0) / timed.length).toFixed(1)}s`;
  }, [gallery]);
  const loadedModelName = systemStatus?.loadedModel?.name ?? "Z-Image Turbo";
  const loadedModelQuantize = systemStatus?.loadedModel?.quantize
    ? `${String(systemStatus.loadedModel.quantize).toUpperCase()} QUANTIZE`
    : "Q8 QUANTIZE";
  const lastGeneration = relativeTime(gallery[0]?.createdAt);
  const platformLabel = `${(systemStatus?.platform ?? "M3 MAX").toUpperCase()} / ${memoryTotal || 64}GB UNIFIED`;

  if (loading) {
    return (
      <div className="content-shell">
        <div className="flex min-h-[60vh] items-center justify-center font-label text-sm tracking-[0.18em] text-on-surface-variant">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="content-shell">
      <main className="mx-auto max-w-[1440px]">
        <header className="mb-10">
          <h1 className="mb-1 font-headline text-4xl font-bold uppercase tracking-tight text-on-surface neon-text-primary">
            SYSTEM DASHBOARD
          </h1>
          <p className="font-label tracking-wide text-on-surface-variant">
            M3 Max · MLX / MPS · Ready for generation
          </p>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <TopCard
            icon="computer"
            label="PLATFORM"
            value={platformLabel}
            subtitle="HARDWARE ACCELERATED"
          />
          <TopCard
            icon="memory"
            label="ENGINE"
            value="MLX / MPS"
            subtitle="ACTIVE OPTIMIZATION"
          />
          <TopCard
            icon="pending_actions"
            label="ACTIVE JOBS"
            value={`${systemStatus?.activeJobs ?? 0}`}
            subtitle={(systemStatus?.activeJobs ?? 0) > 0 ? "PROCESSING" : "WAITING FOR INPUT"}
            iconClassName="text-on-surface-variant"
            subtitleClassName="text-on-surface-variant"
          />
          <TopCard
            icon="model_training"
            label="MODEL LOADED"
            value={loadedModelName}
            subtitle={loadedModelQuantize}
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 rounded-xl border border-outline-variant/20 bg-surface-container-low p-6 scanline lg:col-span-2">
            <div className="space-y-4">
              <div className="group">
                <div className="mb-2 flex items-end justify-between">
                  <span className="font-label text-xs uppercase tracking-widest text-on-surface">UNIFIED MEMORY</span>
                  <span className="font-label text-[10px] text-on-surface-variant">
                    ({formatStat(memoryUsed)} / {formatStat(memoryTotal)} GB){" "}
                    <span className="ml-1 text-secondary">{memoryPercent}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-surface-container-highest">
                  <div
                    className="h-full bg-secondary shadow-glow-secondary"
                    style={{ width: `${memoryPercent}%` }}
                  />
                </div>
              </div>

              <div className="group">
                <div className="mb-2 flex items-end justify-between">
                  <span className="font-label text-xs uppercase tracking-widest text-on-surface">MLX CACHE</span>
                  <span className="font-label text-[10px] text-on-surface-variant">
                    ({formatStat(mlxCacheUsed)} / {formatStat(mlxCacheTotal)} GB){" "}
                    <span className="ml-1 text-secondary">{mlxCachePercent}%</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-surface-container-highest">
                  <div
                    className="h-full bg-secondary shadow-glow-secondary"
                    style={{ width: `${mlxCachePercent}%` }}
                  />
                </div>
              </div>

              <div className="group">
                <div className="mb-2 flex items-end justify-between">
                  <span className="font-label text-xs uppercase tracking-widest text-on-surface">DISK SPACE</span>
                  <span className="font-label text-[10px] text-on-surface-variant">
                    {formatStat(diskFree)}GB FREE
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-surface-container-highest">
                  <div
                    className="h-full bg-secondary shadow-glow-secondary"
                    style={{ width: `${diskUsedPercent}%` }}
                  />
                </div>
              </div>

              <div className="group">
                <div className="mb-2 flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-label text-xs uppercase tracking-widest text-on-surface">NEURAL ENGINE</span>
                    <span className="rounded-[2px] border border-secondary/30 bg-secondary/10 px-1.5 py-0.5 text-[8px] font-bold tracking-tighter text-secondary">
                      {systemStatus?.neuralEngine.active ? "MPS ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <span className="font-label text-[10px] text-on-surface-variant">FULL CAPACITY</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-white/5 bg-surface-container-highest">
                  <div
                    className="h-full bg-secondary shadow-glow-secondary"
                    style={{ width: `${neuralPercent}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 border-t border-outline-variant/20 pt-6 md:grid-cols-4">
              <div>
                <p className="mb-1 font-label text-[9px] uppercase tracking-widest text-on-surface-variant">
                  GENERATIONS THIS SESSION
                </p>
                <p className="font-headline text-xl font-bold text-on-surface">{sessionCount}</p>
              </div>
              <div>
                <p className="mb-1 font-label text-[9px] uppercase tracking-widest text-on-surface-variant">
                  AVG GENERATION TIME
                </p>
                <p className="font-headline text-xl font-bold text-on-surface">{avgGenerationTime}</p>
              </div>
              <div>
                <p className="mb-1 font-label text-[9px] uppercase tracking-widest text-on-surface-variant">
                  TOTAL GENERATIONS
                </p>
                <p className="font-headline text-xl font-bold text-on-surface">{gallery.length.toLocaleString()}</p>
              </div>
              <div>
                <p className="mb-1 font-label text-[9px] uppercase tracking-widest text-on-surface-variant">
                  LAST GENERATION
                </p>
                <p className="font-headline text-xl font-bold text-on-surface">{lastGeneration}</p>
              </div>
            </div>
          </div>

          <div className="self-start rounded-xl border border-outline-variant/30 bg-surface-container p-6">
            <h4 className="mb-6 font-label text-xs uppercase tracking-widest text-on-surface-variant">
              RECENT GENERATIONS
            </h4>
            {galleryPreview.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {galleryPreview.map((item) => (
                    <div
                      key={item.id}
                      className="group relative aspect-square overflow-hidden rounded border border-outline-variant/50 transition-all hover:neon-border-secondary"
                    >
                      <img
                        alt={item.prompt}
                        src={`/api/gallery/file?path=${encodeURIComponent(item.thumbnailPath ?? item.path)}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <Link
                  to="/gallery"
                  className="mt-6 block w-full border border-outline-variant/30 py-2 text-center font-label text-[10px] uppercase tracking-widest text-on-surface-variant transition-colors hover:border-secondary hover:text-secondary"
                >
                  VIEW ALL GENERATIONS
                </Link>
              </>
            ) : (
              <div className="rounded border border-outline-variant/30 px-4 py-8 text-center font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
                NO OUTPUTS INDEXED
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="mb-6 font-label text-xs uppercase tracking-widest text-on-surface-variant">
            QUICK ACTIONS
          </h4>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <QuickActionCard
              to="/txt2img"
              icon="edit_square"
              title="QUICK TXT2IMG"
              subtitle="START NEURAL RENDER"
            />
            <QuickActionCard
              to="/img2img"
              icon="image_search"
              title="QUICK IMG2IMG"
              subtitle="TRANSFORM EXISTING DATA"
            />
            <QuickActionCard
              to="/upscaler"
              icon="high_quality"
              title="QUICK UPSCALE"
              subtitle="ENHANCE FIDELITY"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
