import { describe, expect, test } from "bun:test";

import {
  heldNavigationInput,
  heldPedestrianInput,
} from "../src/navigationInput";

const appSource = await Bun.file(
  new URL("../src/App.tsx", import.meta.url),
).text();
const engineLoaderSource = await Bun.file(
  new URL("../src/viewerEngineLoader.ts", import.meta.url),
).text();
const navigationInputSource = await Bun.file(
  new URL("../src/navigationInput.ts", import.meta.url),
).text();
const indexSource = await Bun.file(
  new URL("../index.html", import.meta.url),
).text();
const boundarySource = await Bun.file(
  new URL("../src/ThreeViewerErrorBoundary.tsx", import.meta.url),
).text();

describe("progressive viewer startup", () => {
  test("keeps both rendering engines behind dynamic imports", () => {
    expect(engineLoaderSource).toContain('import("openseadragon")');
    expect(engineLoaderSource).toContain('import("./ThreeViewer")');
    expect(appSource).toContain("lazy(loadThreeViewerComponent)");
    expect(appSource).toContain("await loadOpenSeadragon()");
    expect(appSource).not.toContain(
      'import OpenSeadragon from "openseadragon"',
    );
    expect(appSource).not.toContain(
      'import { ThreeViewer, type ThreeViewerHandle } from "./ThreeViewer"',
    );
  });

  test("coalesces Strict Mode map imports into one promise", () => {
    expect(engineLoaderSource).toContain("openSeadragonPromise ??=");
    expect(engineLoaderSource).toContain("return openSeadragonPromise");
  });

  test("bounds decoded DZI tiles and parallel image work", () => {
    expect(appSource).toContain(
      "imageLoaderLimit: boundedMapProfile ? 4 : 8",
    );
    expect(appSource).toContain(
      "maxImageCacheCount: boundedMapProfile ? 48 : 96",
    );
    expect(appSource).toContain("showNavigator: !boundedMapProfile");
  });

  test("keeps a visible recovery boundary around the lazy 3D viewer", () => {
    const boundaryStart = appSource.indexOf("<ThreeViewerErrorBoundary");
    const suspenseStart = appSource.indexOf("<Suspense", boundaryStart);
    const lazyViewer = appSource.indexOf("<LazyThreeViewer", suspenseStart);
    const boundaryEnd = appSource.indexOf(
      "</ThreeViewerErrorBoundary>",
      lazyViewer,
    );

    expect(boundaryStart).toBeGreaterThan(-1);
    expect(suspenseStart).toBeGreaterThan(boundaryStart);
    expect(lazyViewer).toBeGreaterThan(suspenseStart);
    expect(boundaryEnd).toBeGreaterThan(lazyViewer);
    expect(boundarySource).toContain('role="alert"');
    expect(appSource).toContain('setViewerMode("map")');
    expect(appSource).toContain("setIsThreeReady(false)");
  });

  test("keeps app-shell navigation helpers free of rendering engines", () => {
    expect(navigationInputSource).not.toContain('from "three"');
    expect(navigationInputSource).not.toContain('from "./ThreeViewer"');
    expect(heldNavigationInput(new Set(["Shift", "ArrowUp"]))).toEqual({
      flight: { forward: 1, strafe: 0 },
      orbit: { horizontal: 0, vertical: 0 },
      pan: { horizontal: 0, vertical: 0 },
    });
    expect(heldPedestrianInput(new Set(["w", "Shift"]))).toEqual({
      forward: 1,
      look: 0,
      sprint: true,
      strafe: 0,
      turn: 0,
    });
  });

  test("paints an attributed shell before React and defers audio graph work", () => {
    expect(indexSource).toContain('class="boot-shell"');
    expect(indexSource).toContain("© OpenStreetMap contributors");
    expect(appSource).not.toContain("useLayoutEffect");
    expect(appSource).toContain("window.requestAnimationFrame(() => {");
  });
});
