import { PageHeader, Panel } from "../components";

export function ModulePage({
  title,
  description,
  sections
}: {
  title: string;
  description: string;
  sections: readonly string[];
}) {
  return (
    <div className="content-shell">
      <PageHeader title={title} description={description} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="CONTROL SURFACE" neonBorder="primary" className="space-y-3">
          {sections.map((section) => (
            <div
              key={section}
              className="rounded-panel border border-outline-variant/60 bg-surface-container-low px-4 py-4"
            >
              <div className="font-label text-[10px] tracking-[0.18em] text-secondary">
                {section.toUpperCase()}
              </div>
              <div className="mt-2 text-sm text-on-surface-variant">
                This section is reserved for the next integration pass.
              </div>
            </div>
          ))}
        </Panel>
        <Panel title="IMPLEMENTATION STATUS" neonBorder="secondary" className="space-y-4">
          <div className="rounded-panel border border-secondary/30 bg-secondary/5 px-4 py-4 text-sm text-on-surface">
            Route and shared interface are live. Backend integration for this module is still
            pending.
          </div>
          <div className="text-sm leading-6 text-on-surface-variant">
            The screen already uses the shared shell, status bar, and Mirror Blue surface system.
          </div>
        </Panel>
      </div>
    </div>
  );
}
