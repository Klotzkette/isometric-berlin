import type { FetchLike } from "./resilientFetch";
import type { VisualMode } from "./visualMode";

export const PRISM_WORLD_FILE = "lod2-prisms.json";
export const SURFACE_WORLD_FILE = "surface-polygons.json";
// The established terrain exports are source-pinned. Keep these names in sync
// without pulling their Three.js module into the initial app shell.
const VOXEL_WORLD_FILE = "minecraft-voxels.json";
export const RAIL_LINES_FILE = "rail-lines.json";
export const STREET_DETAILS_FILE = "street-details.json?schema=7";

export function createStartupWorldRequests(
  fetcher: FetchLike = globalThis.fetch.bind(globalThis),
) {
  const pending = new Map<string, {
    controller: AbortController;
    response: Promise<Response>;
  }>();
  let adopted = false;

  return {
    prime(sceneUrl: URL, mode: VisualMode): void {
      if (adopted || pending.size > 0) return;
      // Keep one large response in flight before the renderer is available.
      // Priming all five Drawn bodies competed with module loading on touch.
      const firstWorld = mode === "minecraft" ? VOXEL_WORLD_FILE : PRISM_WORLD_FILE;
      const urls = [sceneUrl, new URL(firstWorld, sceneUrl)];
      for (const url of urls) {
        const controller = new AbortController();
        const response = fetcher(url, { cache: "default", signal: controller.signal });
        // The normal reader owns validation, parsing and retries after it mounts.
        void response.catch(() => undefined);
        pending.set(url.href, { controller, response });
      }
    },

    adopt(): FetchLike {
      adopted = true;
      return (input, init) => {
        const url = input instanceof URL ? input.href : typeof input === "string" ? input : input.url;
        const request = pending.get(url);
        if (!request) return fetcher(input, init);
        pending.delete(url);
        const abort = () => request.controller.abort(init?.signal?.reason);
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener("abort", abort, { once: true });
        return request.response;
      };
    },

    discard(): void {
      for (const request of pending.values()) request.controller.abort();
      pending.clear();
    },
  };
}
