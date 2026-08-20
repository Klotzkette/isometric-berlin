import type { VisualMode } from "./visualMode";

export type ThreeViewerWorldFamily =
  | "mobile-drawn"
  | "mobile-voxel"
  | "persistent";

/**
 * Tablets can expose a fine primary pointer while their touchscreen appears
 * only through `any-pointer` or `maxTouchPoints`. Treat every touch-capable
 * browser as memory-constrained so attaching a mouse cannot accidentally
 * select the desktop world budget.
 */
export function mobileLikeInputProfile(
  primaryPointerCoarse: boolean,
  anyPointerCoarse: boolean,
  maxTouchPoints: number,
): boolean {
  return (
    primaryPointerCoarse ||
    anyPointerCoarse ||
    (Number.isFinite(maxTouchPoints) && maxTouchPoints > 0)
  );
}

export function browserUsesMobileViewerProfile(): boolean {
  return mobileLikeInputProfile(
    window.matchMedia("(pointer: coarse)").matches,
    window.matchMedia("(any-pointer: coarse)").matches,
    navigator.maxTouchPoints ?? 0,
  );
}

/** Desktop keeps one warm renderer; phones keep exactly one heavy world. */
export function threeViewerWorldFamily(
  mode: VisualMode,
  keepThreeWarm: boolean,
): ThreeViewerWorldFamily {
  if (keepThreeWarm) return "persistent";
  return mode === "minecraft" ? "mobile-voxel" : "mobile-drawn";
}

export function mobileWorldFamilyChanges(
  previous: VisualMode,
  next: VisualMode,
  keepThreeWarm: boolean,
): boolean {
  return (
    !keepThreeWarm &&
    threeViewerWorldFamily(previous, false) !==
      threeViewerWorldFamily(next, false)
  );
}

export function viewerRuntimeFailureDecision(
  automaticRecoveryAlreadyUsed: boolean,
): "restart-clean" | "show-recovery" {
  return automaticRecoveryAlreadyUsed ? "show-recovery" : "restart-clean";
}
