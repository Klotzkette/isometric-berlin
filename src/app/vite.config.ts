import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          const normalizedModuleId = moduleId.replaceAll("\\", "/");
          if (normalizedModuleId.includes("/node_modules/openseadragon/")) {
            return "map-engine";
          }
          if (
            normalizedModuleId.includes("/node_modules/react/") ||
            normalizedModuleId.includes("/node_modules/react-dom/")
          ) {
            return "react-vendor";
          }
          if (normalizedModuleId.includes("/node_modules/three/")) {
            return "three-engine";
          }
          return undefined;
        },
      },
    },
  },
});
