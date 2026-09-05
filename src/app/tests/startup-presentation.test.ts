import { describe, expect, test } from "bun:test";

import {
  photographicSurfaceNeeded,
  presentationFogRange,
  startupCurtainMayOpen,
  startupPresentationStatus,
} from "../src/ThreeViewer";
import type { VisualMode } from "../src/visualMode";
import { UI_COPY } from "../src/localization";

const drawnModes: VisualMode[] = [
  "day",
  "night",
  "snowstorm",
  "schwellenraum",
];
const stylesSource = await Bun.file(
  new URL("../src/styles.css", import.meta.url),
).text();
const appSource = await Bun.file(
  new URL("../src/App.tsx", import.meta.url),
)
  .text()
  .then((source) => source.replaceAll("\r\n", "\n"));
const viewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
)
  .text()
  .then((source) => source.replaceAll("\r\n", "\n"));

describe("startup presentation gate", () => {
  test.each(drawnModes)(
    "%s keeps the curtain closed until the drawn city exists",
    (lightingMode) => {
      expect(
        startupPresentationStatus({
          isoWorldReady: false,
          isoWorldState: "idle",
          lightingMode,
          voxelWorldReady: false,
          voxelWorldState: "idle",
        }),
      ).toBe("pending");
      expect(
        startupPresentationStatus({
          isoWorldReady: false,
          isoWorldState: "loading",
          lightingMode,
          voxelWorldReady: false,
          voxelWorldState: "idle",
        }),
      ).toBe("pending");
      expect(
        startupPresentationStatus({
          isoWorldReady: true,
          isoWorldState: "loading",
          lightingMode,
          voxelWorldReady: false,
          voxelWorldState: "idle",
        }),
      ).toBe("ready");
    },
  );

  test("Minecraft waits for voxels before exposing the canvas", () => {
    expect(
      startupPresentationStatus({
        isoWorldReady: true,
        isoWorldState: "loading",
        lightingMode: "minecraft",
        voxelWorldReady: false,
        voxelWorldState: "loading",
      }),
    ).toBe("pending");
    expect(
      startupPresentationStatus({
        isoWorldReady: true,
        isoWorldState: "loading",
        lightingMode: "minecraft",
        voxelWorldReady: true,
        voxelWorldState: "loading",
      }),
    ).toBe("ready");
  });

  test("a failed procedural world keeps the curtain closed for recovery", () => {
    const fallback = startupPresentationStatus({
      isoWorldReady: false,
      isoWorldState: "failed",
      lightingMode: "day",
      voxelWorldReady: false,
      voxelWorldState: "idle",
    });

    expect(fallback).toBe("fallback");
    expect(startupCurtainMayOpen(fallback)).toBeFalse();
    expect(startupCurtainMayOpen("pending")).toBeFalse();
    expect(startupCurtainMayOpen("ready")).toBeTrue();
  });

  test("a cold mode switch does not overwrite the last complete framebuffer", () => {
    const gate = viewerSource.lastIndexOf(
      "!startupCurtainMayOpen(currentStartupPresentationStatus(runtime))",
    );
    const frame = viewerSource.indexOf("composer.render();");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeGreaterThan(viewerSource.indexOf("const renderRequired ="));
    expect(gate).toBeLessThan(frame);
    expect(viewerSource.slice(gate, gate + 120)).toContain("return;");
    expect(viewerSource.slice(gate, frame)).not.toContain(".clear(");
    for (const lightingMode of [...drawnModes, "minecraft"] as VisualMode[]) {
      expect(startupCurtainMayOpen(startupPresentationStatus({
        isoWorldReady: lightingMode === "minecraft",
        isoWorldState: "loading",
        lightingMode,
        voxelWorldReady: lightingMode !== "minecraft",
        voxelWorldState: "loading",
      }))).toBeFalse();
    }
  });

  test("never requests the retired photographic surface", () => {
    expect(photographicSurfaceNeeded("pending", false)).toBeFalse();
    expect(photographicSurfaceNeeded("ready", false)).toBeFalse();
    expect(photographicSurfaceNeeded("fallback", false)).toBeFalse();
    expect(photographicSurfaceNeeded("ready", true)).toBeFalse();
    expect(photographicSurfaceNeeded("fallback", false, true)).toBeFalse();
    expect(photographicSurfaceNeeded("ready", true, true)).toBeFalse();
  });

  test("the startup curtain is opaque and never cross-fades over photos", () => {
    const curtainRule = stylesSource.match(
      /\.three-startup-curtain\s*\{(?<body>[^}]*)\}/,
    )?.groups?.body;

    expect(curtainRule).toBeDefined();
    expect(curtainRule).toContain("inset: 0");
    expect(curtainRule).toContain("background-color: inherit");
    expect(curtainRule).toContain("--viewer-static-backdrop-image");
    expect(curtainRule).not.toContain("opacity");
    expect(curtainRule).not.toContain("transition");
  });

  test("keeps a marker-free lightweight city backdrop below startup", async () => {
    const backdrop = Bun.file(
      new URL(
        "../public/dzi/regierungsviertel/regierungsviertel_files/8/0_0.jpg",
        import.meta.url,
      ),
    );

    expect(appSource).toContain("resolveCssAssetUrl(startupBackdropUrl)");
    expect(appSource).not.toContain("resolveCssAssetUrl(referenceMapUrl)");
    expect(appSource).toContain("regierungsviertel_files/8/0_0.jpg");
    expect(await backdrop.exists()).toBeTrue();
    expect(backdrop.size).toBeLessThan(32_000);
    expect(appSource).toContain("new URL(path, document.baseURI).href");
    expect(appSource).toContain("style={viewerStaticBackdropStyle}");
    expect(appSource).toContain('className="viewer-static-backdrop"');
    expect(stylesSource).toContain(".viewer-static-backdrop");
    expect(stylesSource).toContain("--viewer-static-backdrop-image");
    expect(stylesSource).toContain("background: transparent");
    expect(stylesSource).toContain(".openseadragon-canvas canvas");
  });

  test("describes the procedural source-fused city instead of a photo mesh", () => {
    expect(UI_COPY.de.loadingCity).toBe("Baue Berliner 3D-Stadtmodell auf");
    expect(UI_COPY.en.loadingCity).toBe("Building Berlin 3D city model");
    expect(UI_COPY.de.loadingCity.toLowerCase()).not.toContain("mesh");
    expect(UI_COPY.en.loadingCity.toLowerCase()).not.toContain("mesh");
  });

  test("forces WebGL clears to visible mode colours instead of browser black", () => {
    expect(viewerSource).toContain("renderer.setClearColor(0xdcf3f9, 1)");
    expect(viewerSource).toContain("runtime.renderer.setClearColor(sky, 1)");
    expect(viewerSource).toContain("runtime.renderer.setClearColor(deep, 1)");
    expect(stylesSource).toContain(".three-canvas");
    expect(stylesSource).toContain("background: #dcf3f9");
  });

  test("keeps every underground mode clear of exterior weather and horizon fog", () => {
    const modes: VisualMode[] = [
      "day",
      "night",
      "minecraft",
      "snowstorm",
      "schwellenraum",
    ];
    for (const mode of modes) {
      expect(presentationFogRange(mode, true), mode).toBeNull();
    }
    expect(presentationFogRange("minecraft", false)).not.toBeNull();
    expect(presentationFogRange("snowstorm", false)).toEqual({
      near: 540,
      far: 2_250,
    });
    expect(presentationFogRange("day", false)).toBeNull();
    expect(presentationFogRange("night", false)).toBeNull();
    expect(presentationFogRange("schwellenraum", false)).toBeNull();
  });
});
