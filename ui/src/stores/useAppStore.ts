import { create } from "zustand";
import type { SystemStatus } from "../lib/types";

interface AppState {
  activeRoute: string;
  systemStatus: SystemStatus | null;
  backendOnline: boolean | null;
  setActiveRoute: (route: string) => void;
  setSystemStatus: (status: SystemStatus | null) => void;
  setBackendOnline: (online: boolean | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeRoute: "/",
  systemStatus: null,
  backendOnline: null,
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setSystemStatus: (systemStatus) => set({ systemStatus }),
  setBackendOnline: (backendOnline) => set({ backendOnline })
}));
