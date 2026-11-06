import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const kViteHost = process.env.VITE_HOST ?? "127.0.0.1";
const kVitePort = 4173;

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: kViteHost,
    port: kVitePort,
    allowedHosts: ["terminal.local"],
    proxy: {
      "/api": { target: "http://127.0.0.1:4317", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:4317", changeOrigin: true },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
