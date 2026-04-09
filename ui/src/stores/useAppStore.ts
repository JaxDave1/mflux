import { create } from "zustand";
import type { SystemStatus } from "../lib/types";

interface AppState {
  activeRoute: string;
  systemStatus: SystemStatus | null;
  setActiveRoute: (route: string) => void;
  setSystemStatus: (status: SystemStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeRoute: "/",
  systemStatus: null,
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setSystemStatus: (systemStatus) => set({ systemStatus })
}));
