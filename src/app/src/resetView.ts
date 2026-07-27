import type { VisualMode } from "./visualMode";

// The one view the app promises to come back to: the Chancellery hero shot
// in daylight, north up, right way round. Kept here rather than in App so
// the contract can be asserted without rendering React.
export const NORTH_UP_ROTATION = 296.565051177078;
export const DEFAULT_FOCUS_LANDMARK = "Bundeskanzleramt";

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
