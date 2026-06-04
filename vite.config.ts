import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Remote API used in dev proxy (matches .env.production). Cookie session works via same-origin /api.
const DEV_API_TARGET = "http://34.29.70.169:8080";
const devProxy = {
  target: DEV_API_TARGET,
  changeOrigin: true,
  secure: false,
  cookieDomainRewrite: "localhost",
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5000,
    proxy: {
      "/api": devProxy,
      "/files": devProxy,
      "/uploads": devProxy,
      "/images": devProxy,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
