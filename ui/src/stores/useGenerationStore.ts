import { create } from "zustand";
import type { GenerationJob, GenerationOutput } from "../lib/types";

interface GenerationState {
  currentJob: GenerationJob | null;
  recentOutputs: GenerationOutput[];
  favorites: GenerationOutput[];
  startJob: (job: GenerationJob) => void;
  completeJob: (outputs: GenerationOutput[]) => void;
  failJob: () => void;
  addFavorite: (output: GenerationOutput) => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  currentJob: null,
  recentOutputs: [],
  favorites: [],
  startJob: (currentJob) => set({ currentJob }),
  completeJob: (outputs) =>
    set((state) => ({
      currentJob: state.currentJob
        ? { ...state.currentJob, status: "completed", finishedAt: new Date().toISOString() }
        : null,
      recentOutputs: [...outputs, ...state.recentOutputs].slice(0, 24)
    })),
  failJob: () =>
    set((state) => ({
      currentJob: state.currentJob
        ? { ...state.currentJob, status: "failed", finishedAt: new Date().toISOString() }
        : null
    })),
  addFavorite: (output) =>
    set((state) => ({
      favorites: state.favorites.some((item) => item.id === output.id)
        ? state.favorites
        : [output, ...state.favorites]
    }))
}));
