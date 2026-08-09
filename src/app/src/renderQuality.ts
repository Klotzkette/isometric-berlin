export type RenderQualityOptions = {
  coarsePointer: boolean;
  devicePixelRatio: number;
  height: number;
  width: number;
};

export type RenderInteractionSources = {
  controls: boolean;
  touch: boolean;
  wheel: boolean;
};

export function renderInteractionActive({
  controls,
  touch,
  wheel,
}: RenderInteractionSources): boolean {
  return controls || touch || wheel;
}

export const STABLE_DESKTOP_PIXEL_RATIO_CAP = 2;
export const STABLE_TOUCH_PIXEL_RATIO_CAP = 1.5;
export const STABLE_DESKTOP_PIXEL_BUDGET = 10_000_000;
export const STABLE_TOUCH_PIXEL_BUDGET = 4_400_000;

export function renderPixelRatio({
  coarsePointer,
  devicePixelRatio,
  height,
  width,
}: RenderQualityOptions): number {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  // One viewport gets one backing-store resolution. Earlier releases changed
  // DPR after 420 ms of input and restored it 1.1 s later. Even with
  // hysteresis, that reallocated and resampled the whole canvas twice per
  // gesture: measured at 1280x720 as 2560x1440 -> 2432x1368 -> 2560x1440.
  // A fixed, GPU-bounded compromise removes both flashes and raises touch
  // interaction detail without making 4K canvases unbounded.
  const ratioCap = coarsePointer
    ? STABLE_TOUCH_PIXEL_RATIO_CAP
    : STABLE_DESKTOP_PIXEL_RATIO_CAP;
  const pixelBudget = coarsePointer
    ? STABLE_TOUCH_PIXEL_BUDGET
    : STABLE_DESKTOP_PIXEL_BUDGET;
  const budgetRatio = Math.sqrt(pixelBudget / (safeWidth * safeHeight));
  return Math.max(1, Math.min(devicePixelRatio, ratioCap, budgetRatio));
}
