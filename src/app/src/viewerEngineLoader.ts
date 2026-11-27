import { withInitialViewerPreloadRecovery } from "./preloadRecovery";

export type LazyThreeViewerModule = {
  default: typeof import("./ThreeViewer").ThreeViewer;
};

// Warm the module in parallel with the controller. An optional camera catalogue
// can still be in flight, so only the later renderer consumer arms recovery.
export const preloadThreeViewer = () => import("./ThreeViewer");

/**
 * React.lazy expects a default export. Adapting the existing named export in
 * this tiny module leaves the complete Three.js scene out of the synchronous
 * app-shell bundle while preserving its public component API.
 */
export async function loadThreeViewerComponent(): Promise<
  LazyThreeViewerModule
> {
  const module = await withInitialViewerPreloadRecovery(preloadThreeViewer);
  return { default: module.ThreeViewer };
}
