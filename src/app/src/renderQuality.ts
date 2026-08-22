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

export type RenderFrameSources = {
  cameraMoving: boolean;
  environmentalMotion: boolean;
  presentationChanged: boolean;
  renderInvalidated: boolean;
};

export type StableViewportSize = {
  height: number;
  width: number;
};

export type StableWebglMemoryProfile = {
  /** Let the final SMAA pass own edge smoothing on every GPU. */
  antialias: boolean;
  /** Multisample count for the EffectComposer's two render targets. */
  composerSamples: 0;
};

/**
 * Bound persistent WebGL render-target memory on every device.
 *
 * A 4x multisampled half-float composer can reserve hundreds of MiB because
 * EffectComposer owns two full-size targets. It also duplicated both renderer
 * MSAA and the final SMAA pass. The flat authored palette fits losslessly in
 * an unsigned-byte target, so one SMAA stage is the stable all-mode contract.
 */
export function stableWebglMemoryProfile(
  _coarsePointer: boolean,
): StableWebglMemoryProfile {
  return {
    antialias: false,
    composerSamples: 0,
  };
}

/**
 * Keep the WebGL backing store on one integer CSS-pixel size.
 *
 * Safari can report fractional ResizeObserver rectangles that oscillate by a
 * few hundredths of a pixel while its browser chrome settles. Passing those
 * fractions to EffectComposer reallocates every multisampled render target,
 * which presents as a full-canvas flash even though the layout did not change.
 */
export function stableViewportSize(
  width: number,
  height: number,
): StableViewportSize {
  return {
    height: Number.isFinite(height) ? Math.max(1, Math.round(height)) : 1,
    width: Number.isFinite(width) ? Math.max(1, Math.round(width)) : 1,
  };
}

export function renderInteractionActive({
  controls,
  touch,
  wheel,
}: RenderInteractionSources): boolean {
  return controls || touch || wheel;
}

/** A frame is drawn only for a real visual mutation, never for elapsed time. */
export function renderFrameRequired({
  cameraMoving,
  environmentalMotion,
  presentationChanged,
  renderInvalidated,
}: RenderFrameSources): boolean {
  return (
    cameraMoving ||
    environmentalMotion ||
    presentationChanged ||
    renderInvalidated
  );
}

export const STABLE_DESKTOP_PIXEL_RATIO_CAP = 2;
export const STABLE_TOUCH_PIXEL_RATIO_CAP = 1.5;
export const STABLE_DESKTOP_PIXEL_BUDGET = 10_000_000;
export const STABLE_TOUCH_PIXEL_BUDGET = 4_400_000;
/**
 * Camera motion follows requestAnimationFrame on every device.
 *
 * The former 33.3 ms coarse-pointer gate discarded every second display
 * frame. Fine ink then jumped two raster positions at a time on phones and
 * looked like flashing even when the GPU had ample headroom for 60 Hz.
 */
export const ACTIVE_MOTION_FRAME_INTERVAL_MS = 0;
export const DESKTOP_ENVIRONMENT_FRAME_INTERVAL_MS = 1_000 / 30;
export const TOUCH_ENVIRONMENT_FRAME_INTERVAL_MS = 1_000 / 20;

/** Weather and roaming figures do not need camera-rate buffer uploads. */
export function environmentFrameIntervalMs(coarsePointer: boolean): number {
  return coarsePointer
    ? TOUCH_ENVIRONMENT_FRAME_INTERVAL_MS
    : DESKTOP_ENVIRONMENT_FRAME_INTERVAL_MS;
}

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
