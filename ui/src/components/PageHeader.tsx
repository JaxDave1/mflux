export function PageHeader({
  title,
  version,
  description,
  className = ""
}: {
  title: string;
  version?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`mb-8 flex items-end justify-between gap-4 ${className}`}>
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight text-on-surface">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 font-label text-xs tracking-[0.18em] text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {version ? (
        <div className="rounded-full border border-secondary/40 px-3 py-1 font-label text-[10px] tracking-[0.18em] text-secondary">
          {version}
        </div>
      ) : null}
    </div>
  );
}
