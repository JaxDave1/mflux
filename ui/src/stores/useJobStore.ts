import { create } from "zustand";
import { api } from "../lib/api";
import type { Job, JobCreateRequest, ModuleName } from "../lib/types";

const terminalStates = new Set(["succeeded", "failed", "cancelled", "timed_out"]);
const streams = new Map<string, EventSource>();

interface JobState {
  jobs: Job[];
  stepwiseImages: Record<string, string[]>;
  error: string | null;
  loadJobs: (includeTerminal?: boolean) => Promise<void>;
  submitJob: (payload: JobCreateRequest | FormData) => Promise<Job>;
  connectJob: (id: string) => void;
  cancelJob: (id: string) => Promise<void>;
  activeJobsForModule: (module: ModuleName) => Job[];
}

function upsertJob(jobs: Job[], job: Job) {
  const existing = jobs.findIndex((item) => item.id === job.id);
  if (existing === -1) {
    return [job, ...jobs];
  }
  const next = [...jobs];
  next[existing] = job;
  return next;
}

function moduleFromPayload(payload: JobCreateRequest | FormData): ModuleName | null {
  if (payload instanceof FormData) {
    return (payload.get("module") as ModuleName | null) ?? null;
  }
  return payload.module;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  stepwiseImages: {},
  error: null,

  loadJobs: async (includeTerminal = false) => {
    const response = await api.jobs(includeTerminal);
    set({ jobs: response.jobs, error: null });
    response.jobs.forEach((job) => {
      if (!terminalStates.has(job.state)) {
        get().connectJob(job.id);
      }
    });
  },

  submitJob: async (payload) => {
    const module = moduleFromPayload(payload);
    const job = await api.createJob(payload);
    set((state) => ({ jobs: upsertJob(state.jobs, job), error: null }));
    get().connectJob(job.id);
    if (module && job.module !== module) {
      set({ error: `Job module mismatch: expected ${module}, got ${job.module}` });
    }
    return job;
  },

  connectJob: (id) => {
    if (streams.has(id)) {
      return;
    }
    const source = new EventSource(`/api/jobs/${id}/stream`);
    streams.set(id, source);

    const updateJob = (job: Job) => {
      set((state) => ({ jobs: upsertJob(state.jobs, job), error: null }));
      if (terminalStates.has(job.state)) {
        source.close();
        streams.delete(id);
      }
    };

    source.addEventListener("progress", async () => {
      try {
        updateJob(await api.job(id));
      } catch {
        // The next event or poll will recover if the API is still alive.
      }
    });
    source.addEventListener("state", async () => {
      try {
        updateJob(await api.job(id));
      } catch {
        // The stream closes below on terminal complete events.
      }
    });
    source.addEventListener("complete", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { job: Job };
        updateJob(data.job);
      } catch {
        void api.job(id).then(updateJob);
      }
    });
    source.addEventListener("stepwise_image", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { path: string };
        set((state) => ({
          stepwiseImages: {
            ...state.stepwiseImages,
            [id]: [...(state.stepwiseImages[id] ?? []), data.path]
          }
        }));
      } catch {
        // Ignore malformed preview events; progress/job state still drives the UI.
      }
    });
    source.onerror = () => {
      source.close();
      streams.delete(id);
    };
  },

  cancelJob: async (id) => {
    const job = await api.cancelJob(id);
    const source = streams.get(id);
    source?.close();
    streams.delete(id);
    set((state) => ({ jobs: upsertJob(state.jobs, job), error: null }));
  },

  activeJobsForModule: (module) => get().jobs.filter((job) => job.module === module && !terminalStates.has(job.state))
}));
