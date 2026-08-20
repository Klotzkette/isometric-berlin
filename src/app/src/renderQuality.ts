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
  /** Let the final SMAA pass own edge smoothing on memory-constrained GPUs. */
  antialias: boolean;
  /** Multisample count for the EffectComposer's two render targets. */
  composerSamples: 0 | 4;
  /** Desktop keeps the existing HDR target; touch uses compact byte colour. */
  halfFloatComposer: boolean;
};

/**
 * Bound persistent WebGL render-target memory on coarse-pointer devices.
 *
 * A 4x multisampled half-float composer can reserve hundreds of MiB at tablet
 * resolutions because EffectComposer owns two full-size targets. Mobile keeps
 * the same final SMAA pass but avoids both the duplicate renderer MSAA buffer
 * and the half-float multisample targets. Desktop output stays byte-for-byte
 * on the established high-quality profile.
 */
export function stableWebglMemoryProfile(
  coarsePointer: boolean,
): StableWebglMemoryProfile {
  return coarsePointer
    ? {
        antialias: false,
        composerSamples: 0,
        halfFloatComposer: false,
      }
    : {
        antialias: true,
        composerSamples: 4,
        halfFloatComposer: true,
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
