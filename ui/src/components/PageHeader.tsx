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
    <header className={`module-reskin-page-header mb-8 flex items-end justify-between gap-4 ${className}`}>
      <div>
        <h1 className="titanium-text font-headline text-[32px] font-semibold uppercase tracking-[0.04em]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 font-body text-sm text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {version ? (
        <div className="status-pill">
          <span className="status-pill-dot" />
          {version}
        </div>
      ) : null}
    </header>
  );
}