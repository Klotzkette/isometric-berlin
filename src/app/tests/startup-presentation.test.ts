import { describe, expect, test } from "bun:test";

import {
  photographicSurfaceNeeded,
  presentationFogRange,
  startupCurtainMayOpen,
  startupPresentationStatus,
} from "../src/ThreeViewer";
import type { VisualMode } from "../src/visualMode";

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

  test("keeps a visible static city backdrop below 2D and 3D startup", () => {
    expect(appSource).toContain("cssUrl(referenceMapUrl)");
    expect(appSource).toContain("style={viewerStaticBackdropStyle}");
    expect(appSource).toContain('className="viewer-static-backdrop"');
    expect(stylesSource).toContain(".viewer-static-backdrop");
    expect(stylesSource).toContain("--viewer-static-backdrop-image");
    expect(stylesSource).toContain("background: transparent");
    expect(stylesSource).toContain(".openseadragon-canvas canvas");
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
