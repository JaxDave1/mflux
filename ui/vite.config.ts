import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiHost = env.VITE_API_HOST || "127.0.0.1";
  const apiPort = env.VITE_API_PORT || "8189";

  return {
    plugins: [react()],
    server: {
      port: 4173,
      proxy: {
        "/api": {
          target: `http://${apiHost}:${apiPort}`,
          changeOrigin: true
        }
      }
    }
  };
});
