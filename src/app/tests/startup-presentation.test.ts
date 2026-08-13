import { describe, expect, test } from "bun:test";

import {
  photographicSurfaceNeeded,
  presentationFogRange,
  startupCurtainMayOpen,
  startupPresentationStatus,
} from "../src/ThreeViewer";
import type { VisualMode } from "../src/visualMode";

const drawnModes: VisualMode[] = ["day", "night", "snowstorm"];
const stylesSource = await Bun.file(
  new URL("../src/styles.css", import.meta.url),
).text();

describe("startup presentation gate", () => {
  test.each(drawnModes)(
    "%s hides photogrammetry until the drawn city exists",
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

  test("Minecraft waits for voxels instead of exposing the photo mesh", () => {
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

  test("the old surface is permitted only as a completed failure fallback", () => {
    const fallback = startupPresentationStatus({
      isoWorldReady: false,
      isoWorldState: "failed",
      lightingMode: "day",
      voxelWorldReady: false,
      voxelWorldState: "idle",
    });

    expect(fallback).toBe("fallback");
    expect(startupCurtainMayOpen(fallback, false)).toBeFalse();
    expect(startupCurtainMayOpen(fallback, true)).toBeTrue();
    expect(startupCurtainMayOpen("pending", true)).toBeFalse();
    expect(startupCurtainMayOpen("ready", false)).toBeTrue();
  });

  test("downloads photogrammetry only for failure recovery or an underside", () => {
    expect(photographicSurfaceNeeded("pending", false)).toBeFalse();
    expect(photographicSurfaceNeeded("ready", false)).toBeFalse();
    expect(photographicSurfaceNeeded("fallback", false)).toBeTrue();
    expect(photographicSurfaceNeeded("ready", true)).toBeTrue();
  });

  test("the startup curtain is opaque and never cross-fades over photos", () => {
    const curtainRule = stylesSource.match(
      /\.three-startup-curtain\s*\{(?<body>[^}]*)\}/,
    )?.groups?.body;

    expect(curtainRule).toBeDefined();
    expect(curtainRule).toContain("inset: 0");
    expect(curtainRule).toContain("background-color: inherit");
    expect(curtainRule).not.toContain("opacity");
    expect(curtainRule).not.toContain("transition");
  });

  test("keeps every underground mode clear of exterior weather and horizon fog", () => {
    const modes: VisualMode[] = ["day", "night", "minecraft", "snowstorm"];
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
  });
});
