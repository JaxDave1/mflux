import { useEffect } from "react";
import type { ModuleName } from "../lib/types";
import { useJobStore } from "../stores/useJobStore";

export function useActiveJobs(module?: ModuleName) {
  const jobs = useJobStore((state) => state.jobs);
  const loadJobs = useJobStore((state) => state.loadJobs);

  useEffect(() => {
    void loadJobs(false);
  }, [loadJobs]);

  return module
    ? jobs.filter((job) => job.module === module && !["succeeded", "failed", "cancelled", "timed_out"].includes(job.state))
    : jobs.filter((job) => !["succeeded", "failed", "cancelled", "timed_out"].includes(job.state));
}

export function useJob(id: string | null) {
  const job = useJobStore((state) => state.jobs.find((item) => item.id === id) ?? null);
  const connectJob = useJobStore((state) => state.connectJob);

  useEffect(() => {
    if (id) {
      connectJob(id);
    }
  }, [connectJob, id]);

  return job;
}
