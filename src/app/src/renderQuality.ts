export type RenderQualityOptions = {
  coarsePointer: boolean;
  devicePixelRatio: number;
  height: number;
  interacting: boolean;
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

/**
 * Zoom-stable resolution switching.
 *
 * A mouse-wheel dolly is not a continuous gesture: OrbitControls dispatches
 * `start` and `end` for *every single tick*, so reading the interaction flag
 * directly flipped the whole canvas between the interaction and the settled
 * pixel ratio twice per tick. On a HiDPI screen that is a 1.4 ↔ 2.0 resolution
 * swap several times a second — the flicker users reported while zooming in and
 * out. (At devicePixelRatio 1 both branches clamp to 1, which is why it never
 * showed up in earlier desktop captures.)
 *
 * The governor gives the switch hysteresis in both directions. Every input
 * extends a short deadline, so consecutive wheel ticks read as one interaction
 * instead of a burst of separate ones; dropping resolution then needs that
 * interaction to persist past DOWNGRADE_HOLD_MS (longer than the coalescing
 * window, so an isolated tick never downgrades at all), and restoring it needs
 * the input to have really stopped for UPGRADE_HOLD_MS. A whole zoom run costs
 * at most one downgrade and one upgrade.
 */
export const INTERACTION_COALESCE_MS = 220;
export const PIXEL_RATIO_DOWNGRADE_HOLD_MS = 260;
export const PIXEL_RATIO_UPGRADE_HOLD_MS = 420;

/**
 * Hold times for the settled-detail tier (the official-tree microcrowns).
 *
 * Same shape of problem as the pixel ratio, different signal: the tier used to
 * read `cameraMoving` straight, and that flag flaps frame to frame while a
 * wheel dolly or a rotate step plays out, so the microcrowns blinked off and
 * on again several times per gesture. With hysteresis a short gesture keeps
 * them and a sustained one costs a single drop plus a single restore. The
 * restore hold is longer than the pixel-ratio one because the camera keeps
 * easing for a moment after the input stops.
 */
export const SETTLED_DETAIL_DROP_HOLD_MS = 320;
export const SETTLED_DETAIL_RESTORE_HOLD_MS = 520;

export type PixelRatioModeInput = {
  activeSinceMs: number | null;
  applied: boolean;
  idleSinceMs: number | null;
  inputActive: boolean;
  nowMs: number;
};

export type HystereticModeInput = PixelRatioModeInput & {
  downgradeHoldMs: number;
  upgradeHoldMs: number;
};

export function nextHystereticMode({
  activeSinceMs,
  applied,
  downgradeHoldMs,
  idleSinceMs,
  inputActive,
  nowMs,
  upgradeHoldMs,
}: HystereticModeInput): boolean {
  if (inputActive) {
    if (applied || activeSinceMs === null) {
      return applied;
    }
    return nowMs - activeSinceMs >= downgradeHoldMs;
  }
  if (!applied || idleSinceMs === null) {
    return applied;
  }
  return nowMs - idleSinceMs < upgradeHoldMs;
}

export function nextPixelRatioMode(input: PixelRatioModeInput): boolean {
  return nextHystereticMode({
    ...input,
    downgradeHoldMs: PIXEL_RATIO_DOWNGRADE_HOLD_MS,
    upgradeHoldMs: PIXEL_RATIO_UPGRADE_HOLD_MS,
  });
}

export function nextSettledDetailMode(input: PixelRatioModeInput): boolean {
  return nextHystereticMode({
    ...input,
    downgradeHoldMs: SETTLED_DETAIL_DROP_HOLD_MS,
    upgradeHoldMs: SETTLED_DETAIL_RESTORE_HOLD_MS,
  });
}

export function renderPixelRatio({
  coarsePointer,
  devicePixelRatio,
  height,
  interacting,
  width,
}: RenderQualityOptions): number {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const ratioCap = interacting ? (coarsePointer ? 1 : 1.4) : coarsePointer ? 2 : 2.75;
  const pixelBudget = interacting
    ? coarsePointer
      ? 2_800_000
      : 5_200_000
    : coarsePointer
      ? 5_800_000
      : 11_500_000;
  const budgetRatio = Math.sqrt(pixelBudget / (safeWidth * safeHeight));
  return Math.max(1, Math.min(devicePixelRatio, ratioCap, budgetRatio));
}
