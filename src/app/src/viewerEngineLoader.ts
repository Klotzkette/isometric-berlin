import { withInitialViewerPreloadRecovery } from "./preloadRecovery";

export type LazyThreeViewerModule = {
  default: typeof import("./ThreeViewer").ThreeViewer;
};

/**
 * React.lazy expects a default export. Adapting the existing named export in
 * this tiny module leaves the complete Three.js scene out of the synchronous
 * app-shell bundle while preserving its public component API.
 */
export async function loadThreeViewerComponent(): Promise<
  LazyThreeViewerModule
> {
  const module = await withInitialViewerPreloadRecovery(
    () => import("./ThreeViewer"),
  );
  return { default: module.ThreeViewer };
}
