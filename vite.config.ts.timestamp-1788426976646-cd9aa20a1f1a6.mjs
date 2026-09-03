// vite.config.ts
import { defineConfig } from "file:///D:/pos-demo/node_modules/vite/dist/node/index.js";
import react from "file:///D:/pos-demo/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///D:/pos-demo/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "D:\\pos-demo";
var DEV_API_TARGET = "http://136.65.34.15:8080";
var devProxy = {
  target: DEV_API_TARGET,
  changeOrigin: true,
  secure: false,
  cookieDomainRewrite: "localhost"
};
var isElectronBuild = process.env.ELECTRON === "true";
function electronHtmlPlugin() {
  return {
    name: "electron-html",
    transformIndexHtml(html) {
      if (!isElectronBuild) return html;
      return html.replace(/\s+crossorigin(="[^"]*")?/g, "");
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => ({
  base: isElectronBuild ? "./" : "/",
  server: {
    host: "::",
    port: 5e3,
    proxy: {
      "/api": devProxy,
      "/files": devProxy,
      "/uploads": devProxy,
      "/images": devProxy
    }
  },
  preview: {
    host: "127.0.0.1",
    port: 5001,
    proxy: {
      "/api": devProxy,
      "/files": devProxy,
      "/uploads": devProxy,
      "/images": devProxy
    }
  },
  plugins: [
    react(),
    isElectronBuild && electronHtmlPlugin(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxwb3MtZGVtb1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxccG9zLWRlbW9cXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L3Bvcy1kZW1vL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgY29tcG9uZW50VGFnZ2VyIH0gZnJvbSBcImxvdmFibGUtdGFnZ2VyXCI7XHJcblxyXG4vLyBSZW1vdGUgQVBJIHVzZWQgaW4gZGV2IHByb3h5IChtYXRjaGVzIC5lbnYucHJvZHVjdGlvbikuIENvb2tpZSBzZXNzaW9uIHdvcmtzIHZpYSBzYW1lLW9yaWdpbiAvYXBpLlxyXG5jb25zdCBERVZfQVBJX1RBUkdFVCA9IFwiaHR0cDovLzM1LjIyMy45My42OjgwODBcIjtcclxuY29uc3QgZGV2UHJveHkgPSB7XHJcbiAgdGFyZ2V0OiBERVZfQVBJX1RBUkdFVCxcclxuICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgc2VjdXJlOiBmYWxzZSxcclxuICBjb29raWVEb21haW5SZXdyaXRlOiBcImxvY2FsaG9zdFwiLFxyXG59O1xyXG5cclxuLy8gUmVsYXRpdmUgYmFzZSBwYXRoIHJlcXVpcmVkIGZvciBFbGVjdHJvbiAobG9hZHMgZGlzdC9pbmRleC5odG1sIHZpYSBmaWxlOi8vKS5cclxuY29uc3QgaXNFbGVjdHJvbkJ1aWxkID0gcHJvY2Vzcy5lbnYuRUxFQ1RST04gPT09IFwidHJ1ZVwiXHJcblxyXG4vKiogU3RyaXAgY3Jvc3NvcmlnaW4gZnJvbSBidWlsdCBIVE1MIFx1MjAxNCBicmVha3MgRVMgbW9kdWxlcyBvbiBFbGVjdHJvbiBmaWxlOi8vIC8gYXBwOi8vICovXHJcbmZ1bmN0aW9uIGVsZWN0cm9uSHRtbFBsdWdpbigpIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogXCJlbGVjdHJvbi1odG1sXCIsXHJcbiAgICB0cmFuc2Zvcm1JbmRleEh0bWwoaHRtbDogc3RyaW5nKSB7XHJcbiAgICAgIGlmICghaXNFbGVjdHJvbkJ1aWxkKSByZXR1cm4gaHRtbDtcclxuICAgICAgcmV0dXJuIGh0bWwucmVwbGFjZSgvXFxzK2Nyb3Nzb3JpZ2luKD1cIlteXCJdKlwiKT8vZywgXCJcIik7XHJcbiAgICB9LFxyXG4gIH07XHJcbn1cclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgYmFzZTogaXNFbGVjdHJvbkJ1aWxkID8gXCIuL1wiIDogXCIvXCIsXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA1MDAwLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgXCIvYXBpXCI6IGRldlByb3h5LFxyXG4gICAgICBcIi9maWxlc1wiOiBkZXZQcm94eSxcclxuICAgICAgXCIvdXBsb2Fkc1wiOiBkZXZQcm94eSxcclxuICAgICAgXCIvaW1hZ2VzXCI6IGRldlByb3h5LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIGhvc3Q6IFwiMTI3LjAuMC4xXCIsXHJcbiAgICBwb3J0OiA1MDAxLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgXCIvYXBpXCI6IGRldlByb3h5LFxyXG4gICAgICBcIi9maWxlc1wiOiBkZXZQcm94eSxcclxuICAgICAgXCIvdXBsb2Fkc1wiOiBkZXZQcm94eSxcclxuICAgICAgXCIvaW1hZ2VzXCI6IGRldlByb3h5LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICBpc0VsZWN0cm9uQnVpbGQgJiYgZWxlY3Ryb25IdG1sUGx1Z2luKCksXHJcbiAgICBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCksXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1TixTQUFTLG9CQUFvQjtBQUNwUCxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBSGhDLElBQU0sbUNBQW1DO0FBTXpDLElBQU0saUJBQWlCO0FBQ3ZCLElBQU0sV0FBVztBQUFBLEVBQ2YsUUFBUTtBQUFBLEVBQ1IsY0FBYztBQUFBLEVBQ2QsUUFBUTtBQUFBLEVBQ1IscUJBQXFCO0FBQ3ZCO0FBR0EsSUFBTSxrQkFBa0IsUUFBUSxJQUFJLGFBQWE7QUFHakQsU0FBUyxxQkFBcUI7QUFDNUIsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sbUJBQW1CLE1BQWM7QUFDL0IsVUFBSSxDQUFDLGdCQUFpQixRQUFPO0FBQzdCLGFBQU8sS0FBSyxRQUFRLDhCQUE4QixFQUFFO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLE1BQU0sa0JBQWtCLE9BQU87QUFBQSxFQUMvQixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsTUFDWixXQUFXO0FBQUEsSUFDYjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLFlBQVk7QUFBQSxNQUNaLFdBQVc7QUFBQSxJQUNiO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sbUJBQW1CLG1CQUFtQjtBQUFBLElBQ3RDLFNBQVMsaUJBQWlCLGdCQUFnQjtBQUFBLEVBQzVDLEVBQUUsT0FBTyxPQUFPO0FBQUEsRUFDaEIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
