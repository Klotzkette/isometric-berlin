import type OpenSeadragon from "openseadragon";

export type OpenSeadragonEngine = typeof OpenSeadragon;
export type LazyThreeViewerModule = {
  default: typeof import("./ThreeViewer").ThreeViewer;
};

let openSeadragonPromise: Promise<OpenSeadragonEngine> | null = null;

/**
 * Keep the 2D map engine out of the default 3D startup graph. The cached
 * promise also makes React Strict Mode and rapid map/3D switching share one
 * download and one module evaluation.
 */
export function loadOpenSeadragon(): Promise<OpenSeadragonEngine> {
  openSeadragonPromise ??= import("openseadragon").then(
    (module) => module.default,
  );
  return openSeadragonPromise;
}

/**
 * React.lazy expects a default export. Adapting the existing named export in
 * this tiny module leaves the complete Three.js scene out of the synchronous
 * app-shell bundle while preserving its public component API.
 */
export async function loadThreeViewerComponent(): Promise<
  LazyThreeViewerModule
> {
  const module = await import("./ThreeViewer");
  return { default: module.ThreeViewer };
}
