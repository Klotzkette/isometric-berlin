export type SurfaceQualityState = {
  coarsePointer: boolean;
  detailReady: boolean;
  interactionTierLocked: boolean;
};

export function shouldUseSettledSurface({
  coarsePointer,
  detailReady,
  interactionTierLocked,
}: SurfaceQualityState): boolean {
  // The chosen tier is a device/mode property, never an input-state property.
  // Swapping 2.6M and 6.6M-face surfaces after every gesture made the city and
  // the Tiergarten microcrowns pop even when both DPR tiers were close. Desktop
  // keeps settled detail once it has loaded; touch and Minecraft keep the
  // interaction tier. Only the one-time progressive load may upgrade a scene.
  return detailReady && !coarsePointer && !interactionTierLocked;
}
