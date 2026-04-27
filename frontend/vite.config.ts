import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        companion: resolve(__dirname, "companion.html"),
        spotlight: resolve(__dirname, "spotlight.html"),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8081",
      "/ws": {
        target: "ws://localhost:8081",
        ws: true,
      },
    },
  },
});
