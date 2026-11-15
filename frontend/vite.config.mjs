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

// Content Security Policy for the built app (decision: Phase 5 of the Astryx plan). Built themes keep
// style-src strict: only style attributes (React style props, Astryx inline CSS variables) are allowed
// inline. Frames are limited to the two music providers. Added at build time only, because the dev
// server injects inline scripts for React refresh. The native host serves dist/client unchanged.
export const kContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  // Astryx injects two kinds of static <style>: Layer's @position-try rules (popovers, menus,
  // tooltips) and CodeBlock's syntax-token map. These are their hashes for the pinned
  // @astryxdesign/core 0.7.16; browser-redesign.mjs fails on any CSP violation, so a version bump
  // that changes either stylesheet shows up there.
  "style-src 'self' 'sha256-/i2+VVt2qoVh0Ag9OWwyc9593DCZeYGAv6SliqVbheY=' 'sha256-S3X78TfYa2X+eJlpah8LnW4Dq9tZQGGwE5PSRFXzGGo=' 'sha256-0KUt1GaAbAKiIczMgRikTmhynZoYPcw+0bnDtqcsh14='",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src https://embed.music.apple.com https://open.spotify.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

function contentSecurityPolicy() {
  return {
    name: "live-desktop-csp",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: kContentSecurityPolicy }, injectTo: "head-prepend" }],
  };
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
  plugins: [react(), contentSecurityPolicy()],
});
