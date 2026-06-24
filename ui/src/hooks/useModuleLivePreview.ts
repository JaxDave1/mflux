import { useMemo } from "react";
import type { ModuleName } from "../lib/types";
import { useJobStore } from "../stores/useJobStore";
import { useActiveJobs } from "./useJobs";

export function useModuleLivePreview(module: ModuleName) {
  const jobs = useJobStore((state) => state.jobs);
  const stepwiseImages = useJobStore((state) => state.stepwiseImages);
  const activeJobs = useActiveJobs(module);

  const job = useMemo(() => {
    if (activeJobs[0]) {
      return activeJobs[0];
    }
    return jobs.find((item) => item.module === module) ?? null;
  }, [activeJobs, jobs, module]);

  const previewStepwiseImages = job ? stepwiseImages[job.id] ?? [] : [];

  return {
    job,
    stepwiseImages: previewStepwiseImages,
    activeJobs
  };
}