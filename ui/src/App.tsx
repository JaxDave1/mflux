import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { JobPanel, NavRail, StatusBar } from "./components";
import { api } from "./lib/api";
import {
  Config,
  ControlNet,
  Dashboard,
  DepthPro,
  Gallery,
  Flux2Edit,
  Img2Img,
  Inpaint,
  Kontext,
  Models,
  Txt2Img,
  Upscaler
} from "./pages";
import { useAppStore } from "./stores/useAppStore";
import { useJobStore } from "./stores/useJobStore";

export default function App() {
  const location = useLocation();
  const setActiveRoute = useAppStore((state) => state.setActiveRoute);
  const setSystemStatus = useAppStore((state) => state.setSystemStatus);
  const setBackendOnline = useAppStore((state) => state.setBackendOnline);
  const loadJobs = useJobStore((state) => state.loadJobs);

  useEffect(() => {
    setActiveRoute(location.pathname);
  }, [location.pathname, setActiveRoute]);

  useEffect(() => {
    let cancelled = false;

    const refreshRuntime = async () => {
      const [healthResult, statusResult] = await Promise.allSettled([api.health(), api.systemStatus()]);
      if (cancelled) {
        return;
      }

      if (statusResult.status === "fulfilled") {
        setSystemStatus(statusResult.value);
      } else {
        setSystemStatus(null);
      }

      if (healthResult.status === "fulfilled") {
        setBackendOnline(healthResult.value.runtimeReady);
        return;
      }

      setBackendOnline(false);
    };

    void refreshRuntime();
    const timer = window.setInterval(() => {
      void refreshRuntime();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setBackendOnline, setSystemStatus]);

  useEffect(() => {
    void loadJobs(false);
    const timer = window.setInterval(() => {
      void loadJobs(false);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [loadJobs]);

  return (
    <>
      <NavRail />
      <StatusBar />
      <JobPanel />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/txt2img" element={<Txt2Img />} />
        <Route path="/img2img" element={<Img2Img />} />
        <Route path="/flux2-edit" element={<Flux2Edit />} />
        <Route path="/inpaint" element={<Inpaint />} />
        <Route path="/controlnet" element={<ControlNet />} />
        <Route path="/kontext" element={<Kontext />} />
        <Route path="/upscaler" element={<Upscaler />} />
        <Route path="/depth-pro" element={<DepthPro />} />
        <Route path="/models" element={<Models />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/config" element={<Config />} />
      </Routes>
    </>
  );
}
