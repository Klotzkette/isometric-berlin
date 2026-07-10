import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "map-engine": ["openseadragon"],
          "react-vendor": ["react", "react-dom"],
          "three-engine": ["three"],
        },
      },
    },
  },
});
