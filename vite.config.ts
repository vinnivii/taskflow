import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    proxy: {
      "/api/uptime-kuma": {
        target: "https://monitoramento-softcomshop.softcomapps.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/uptime-kuma/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
