import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Remote API used in dev proxy (matches .env.production). Cookie session works via same-origin /api.
const DEV_API_TARGET = "http://35.223.93.6:8080";
const devProxy = {
  target: DEV_API_TARGET,
  changeOrigin: true,
  secure: false,
  cookieDomainRewrite: "localhost",
};

// Relative base path required for Electron (loads dist/index.html via file://).
const isElectronBuild = process.env.ELECTRON === "true"

/** Strip crossorigin from built HTML — breaks ES modules on Electron file:// / app:// */
function electronHtmlPlugin() {
  return {
    name: "electron-html",
    transformIndexHtml(html: string) {
      if (!isElectronBuild) return html;
      return html.replace(/\s+crossorigin(="[^"]*")?/g, "");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: isElectronBuild ? "./" : "/",
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
  preview: {
    host: "127.0.0.1",
    port: 5001,
    proxy: {
      "/api": devProxy,
      "/files": devProxy,
      "/uploads": devProxy,
      "/images": devProxy,
    },
  },
  plugins: [
    react(),
    isElectronBuild && electronHtmlPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
