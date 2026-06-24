import type { ReactNode } from "react";
import { RunningStatePreview } from "./RunningStatePreview";
import { Panel } from "./Panel";
import type { Job } from "../lib/types";

export function ModuleRunColumn({
  runControl,
  job,
  stepwiseImages
}: {
  runControl: ReactNode;
  job: Job | null;
  stepwiseImages: string[];
}) {
  return (
    <div className="module-control-column space-y-6 xl:sticky xl:top-24 xl:self-start">
      <Panel title="RUN CONTROL" neonBorder="secondary" className="space-y-4">
        {runControl}
      </Panel>
      <Panel title="LIVE OUTPUT" variant="composite" className="module-live-output-panel">
        <RunningStatePreview job={job} stepwiseImages={stepwiseImages} />
      </Panel>
    </div>
  );
}