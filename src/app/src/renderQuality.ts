export type RenderQualityOptions = {
  coarsePointer: boolean;
  devicePixelRatio: number;
  height: number;
  interacting: boolean;
  width: number;
};

export function renderPixelRatio({
  coarsePointer,
  devicePixelRatio,
  height,
  interacting,
  width,
}: RenderQualityOptions): number {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const ratioCap = interacting ? (coarsePointer ? 1 : 1.25) : coarsePointer ? 1.75 : 2.25;
  const pixelBudget = interacting
    ? coarsePointer
      ? 2_800_000
      : 4_500_000
    : coarsePointer
      ? 4_800_000
      : 8_000_000;
  const budgetRatio = Math.sqrt(pixelBudget / (safeWidth * safeHeight));
  return Math.max(1, Math.min(devicePixelRatio, ratioCap, budgetRatio));
}
