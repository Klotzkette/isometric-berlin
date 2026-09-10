import { clearPreloadRecoveryGuard } from "./preloadRecovery";
import { PROJECT_VERSION } from "./projectMetadata";

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
  const module = await import("./ThreeViewer");
  clearPreloadRecoveryGuard(PROJECT_VERSION);
  return { default: module.ThreeViewer };
}
