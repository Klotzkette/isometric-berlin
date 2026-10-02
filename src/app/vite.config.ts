import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

export const STARTUP_JS_BUDGET_BYTES = 400 * 1024;

/** Each offline-bounded packet remains one output asset; grouping the complete
 * mode would recreate a tens-of-megabytes JavaScript payload. */
export function altMitteV169ManualChunk(moduleId: string): string | undefined {
  const match = moduleId
    .replaceAll("\\", "/")
    .match(
      /\/data\/altMitteV169(Drawn|Native|Navigation)\/(packet-\d+)\.json(?:\?.*)?$/,
    );
  return match
    ? `alt-mitte-v169-${match[1].toLowerCase()}-${match[2]}`
    : undefined;
}

/**
 * Guard the synchronous app shell, including all of its static JS imports.
 * Three.js stays deliberately dynamic and is therefore excluded from this
 * graph until the isometric viewer is requested.
 */
function startupBudget(): Plugin {
  return {
    name: "isometric-berlin-startup-budget",
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(
        (item) => item.type === "chunk" && item.isEntry,
      );
      if (!entry || entry.type !== "chunk") {
        this.error("Could not find the viewer entry chunk");
      }
      const visited = new Set<string>();
      const visit = (fileName: string): number => {
        if (visited.has(fileName)) {
          return 0;
        }
        visited.add(fileName);
        const item = bundle[fileName];
        if (!item || item.type !== "chunk") {
          return 0;
        }
        return (
          item.code.length +
          item.imports.reduce(
            (total, dependency) => total + visit(dependency),
            0,
          )
        );
      };
      const initialBytes = visit(entry.fileName);
      if (initialBytes > STARTUP_JS_BUDGET_BYTES) {
        this.error(
          `Initial JavaScript graph is ${initialBytes} bytes; ` +
            `budget is ${STARTUP_JS_BUDGET_BYTES} bytes`,
        );
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), startupBudget()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(moduleId) {
          const altMittePacket = altMitteV169ManualChunk(moduleId);
          if (altMittePacket) return altMittePacket;
          const normalizedModuleId = moduleId.replaceAll("\\", "/");
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
