import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { NavRail, StatusBar } from "./components";
import { api } from "./lib/api";
import {
  Config,
  ControlNet,
  Dashboard,
  DepthPro,
  Gallery,
  Img2Img,
  Inpaint,
  Kontext,
  Models,
  Txt2Img,
  Upscaler
} from "./pages";
import { useAppStore } from "./stores/useAppStore";

export default function App() {
  const location = useLocation();
  const setActiveRoute = useAppStore((state) => state.setActiveRoute);
  const setSystemStatus = useAppStore((state) => state.setSystemStatus);

  useEffect(() => {
    setActiveRoute(location.pathname);
  }, [location.pathname, setActiveRoute]);

  useEffect(() => {
    api.systemStatus().then(setSystemStatus).catch(() => undefined);
  }, [setSystemStatus]);

  return (
    <>
      <NavRail />
      <StatusBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/txt2img" element={<Txt2Img />} />
        <Route path="/img2img" element={<Img2Img />} />
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
