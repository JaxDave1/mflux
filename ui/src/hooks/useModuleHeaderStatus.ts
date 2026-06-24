import type { Job } from "../lib/types";

export function useModuleHeaderStatus(activeJobs: Job[], latestJob: Job | null): string | undefined {
  if (activeJobs.length) {
    return `${activeJobs.length} ACTIVE`;
  }
  if (latestJob?.state === "running" || latestJob?.state === "queued") {
    return "GENERATING";
  }
  return undefined;
}