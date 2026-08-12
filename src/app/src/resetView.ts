import type { VisualMode } from "./visualMode";

// The one view the app promises to come back to: an elevated Reichstag hero
// shot from above the Platz der Republik lawn in daylight. The bootstrap
// camera mirrors the authored Reichstag focus camera so loading never detours
// through a different landmark before the scene manifest is ready.
export const NORTH_UP_ROTATION = 296.565051177078;
export const DEFAULT_FOCUS_LANDMARK = "Reichstagsgebäude";
export const DEFAULT_THREE_TARGET_WORLD = [317.729, 21.595, 40.477] as const;
export const DEFAULT_THREE_CAMERA_OFFSET = [
  -128.763,
  38.048,
  124.345,
] as const;

export type ViewState = {
  focus: string;
  isFlipped: boolean;
  isUnderside: boolean;
  lightingMode: VisualMode;
  rotationDegrees: number;
};

export const DEFAULT_VIEW: ViewState = {
  focus: DEFAULT_FOCUS_LANDMARK,
  isFlipped: false,
  isUnderside: false,
  lightingMode: "day",
  rotationDegrees: NORTH_UP_ROTATION,
};

/**
 * Reset is unconditional: whatever the viewer is showing — night, Minecraft,
 * an orbited camera, a distant landmark — one click yields the same state.
 */
export function resolveResetView(): ViewState {
  return { ...DEFAULT_VIEW };
}

export function isDefaultView(current: ViewState): boolean {
  return (
    current.focus === DEFAULT_VIEW.focus &&
    current.isFlipped === DEFAULT_VIEW.isFlipped &&
    current.isUnderside === DEFAULT_VIEW.isUnderside &&
    current.lightingMode === DEFAULT_VIEW.lightingMode &&
    Math.abs(current.rotationDegrees - DEFAULT_VIEW.rotationDegrees) < 1e-9
  );
}
