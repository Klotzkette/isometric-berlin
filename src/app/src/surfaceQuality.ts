export type SurfaceQualityState = {
  coarsePointer: boolean;
  detailReady: boolean;
  interacting: boolean;
};

export function shouldUseSettledSurface({
  coarsePointer,
  detailReady,
  interacting,
}: SurfaceQualityState): boolean {
  return detailReady && !coarsePointer && !interacting;
}
