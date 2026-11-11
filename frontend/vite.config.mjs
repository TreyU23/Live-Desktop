import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const kViteHost = process.env.VITE_HOST ?? "127.0.0.1";
const kVitePort = 4173;
const kBackend = "http://127.0.0.1:4317";
const kTokenHeader = "x-live-desktop-token";
const kLoopbackPeers = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

// Every proxied request reaches the backend from 127.0.0.1, so its loopback-peer check cannot see a
// LAN caller when VITE_HOST exposes the dev server. Strip the launch token here for non-loopback peers.
function stripTokenForRemotePeers(proxy) {
  proxy.on("proxyRes", (proxyRes, request) => {
    if (!kLoopbackPeers.has(request.socket?.remoteAddress)) delete proxyRes.headers[kTokenHeader];
  });
}

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
      "/api": { target: kBackend, changeOrigin: true },
      "/health": { target: kBackend, changeOrigin: true, configure: stripTokenForRemotePeers },
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
