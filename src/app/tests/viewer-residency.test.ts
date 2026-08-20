import { describe, expect, test } from "bun:test";

import {
  mobileLikeInputProfile,
  mobileWorldFamilyChanges,
  threeViewerWorldFamily,
  viewerRuntimeFailureDecision,
} from "../src/viewerResidency";
import type { VisualMode } from "../src/visualMode";

const appSource = await Bun.file(
  new URL("../src/App.tsx", import.meta.url),
).text();
const threeViewerSource = await Bun.file(
  new URL("../src/ThreeViewer.tsx", import.meta.url),
).text();

const drawnModes: VisualMode[] = [
  "day",
  "night",
  "snowstorm",
  "schwellenraum",
];

describe("mobile ThreeViewer residency", () => {
  test("uses the bounded profile for primary, secondary or reported touch input", () => {
    expect(mobileLikeInputProfile(true, false, 0)).toBe(true);
    expect(mobileLikeInputProfile(false, true, 0)).toBe(true);
    expect(mobileLikeInputProfile(false, false, 5)).toBe(true);
    expect(mobileLikeInputProfile(false, false, 0)).toBe(false);
    expect(mobileLikeInputProfile(false, false, Number.NaN)).toBe(false);
    expect(appSource).toContain("!browserUsesMobileViewerProfile()");
    expect(threeViewerSource).toContain(
      "const coarsePointer = browserUsesMobileViewerProfile()",
    );
  });

  test("keeps all drawn modes in one mobile family and Minecraft separate", () => {
    for (const mode of drawnModes) {
      expect(threeViewerWorldFamily(mode, false)).toBe("mobile-drawn");
      expect(mobileWorldFamilyChanges("day", mode, false)).toBeFalse();
    }
    expect(threeViewerWorldFamily("minecraft", false)).toBe("mobile-voxel");
    expect(mobileWorldFamilyChanges("day", "minecraft", false)).toBeTrue();
    expect(
      mobileWorldFamilyChanges("minecraft", "snowstorm", false),
    ).toBeTrue();
  });

  test("keeps the desktop renderer persistent across every visual mode", () => {
    const modes: VisualMode[] = [...drawnModes, "minecraft"];
    for (const mode of modes) {
      expect(threeViewerWorldFamily(mode, true)).toBe("persistent");
      expect(mobileWorldFamilyChanges("minecraft", mode, true)).toBeFalse();
    }
  });

  test("restarts once before exposing explicit recovery actions", () => {
    expect(viewerRuntimeFailureDecision(false)).toBe("restart-clean");
    expect(viewerRuntimeFailureDecision(true)).toBe("show-recovery");
  });

  test("keys the live viewer by mobile family and never opens DZI from onError", () => {
    expect(appSource).toContain("key={threeViewerInstanceKey}");
    expect(appSource).toContain("threeViewerAutoRecoveryUsedRef.current = false");
    expect(appSource).toContain("<ThreeViewerLoadErrorFallback");
    const errorHandler = appSource.slice(
      appSource.indexOf("onError={(message) =>"),
      appSource.indexOf("onPedestrianRespawn", appSource.indexOf("onError={(message) =>")),
    );
    expect(errorHandler).toContain("handleThreeViewerRuntimeError");
    expect(errorHandler).not.toContain('setViewerMode("map")');
  });
});
