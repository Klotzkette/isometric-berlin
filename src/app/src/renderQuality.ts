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
export const PIXEL_RATIO_DOWNGRADE_HOLD_MS = 420;
/**
 * Long on purpose, and the single most important number here.
 *
 * v0.42.0 costed a *continuous* gesture at one downgrade plus one upgrade,
 * which is correct as far as it goes. But nobody moves a map continuously:
 * "hin und her" is a burst, a pause of a few hundred milliseconds, another
 * burst. With a 420 ms restore hold every one of those pauses was long enough
 * to swap the canvas back to full resolution, so a back-and-forth pan ran a
 * downgrade/upgrade cycle roughly once a second — the resolution pulsing users
 * still reported after v0.42.0 and v0.50.0. At 1100 ms the pauses inside a
 * burst no longer reach the restore, so the whole back-and-forth costs one
 * downgrade and one upgrade. The price is that the picture stays at the
 * interaction resolution for about a second after the last input, which is a
 * single expected settle rather than a repeating blink.
 */
export const PIXEL_RATIO_UPGRADE_HOLD_MS = 1100;

/**
 * Hold times for the settled-detail tier (the official-tree microcrowns).
 *
 * Same shape of problem as the pixel ratio, different signal: the tier used to
 * read `cameraMoving` straight, and that flag flaps frame to frame while a
 * wheel dolly or a rotate step plays out, so the microcrowns blinked off and
 * on again several times per gesture. With hysteresis a short gesture keeps
 * them and a sustained one costs a single drop plus a single restore.
 *
 * The holds track the pixel-ratio ones for the same reason (see above): the
 * pauses inside a back-and-forth gesture must not be long enough to restore,
 * or the whole Tiergarten canopy pops in and out once per pause. The drop hold
 * is the longer of the two because the camera keeps easing after the input
 * stops, and a click-sized move should never cost the crowns at all.
 */
export const SETTLED_DETAIL_DROP_HOLD_MS = 480;
export const SETTLED_DETAIL_RESTORE_HOLD_MS = 1100;

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
  // Desktop interaction sits just under the settled tier on purpose.
  //
  // Hysteresis got the *number* of switches per gesture down to one, but one
  // switch is still one visible event: the canvas is resampled, so the whole
  // picture softens on the way in and snaps back on the way out. At 1.4 against
  // a settled 2.75 that step is far too large to hide, and it is what is left of
  // the "flackert beim Bewegen" report on a HiDPI desktop. Closing the gap to
  // 1.9 / 8.6 Mpx makes the step a few percent on a normal 1080p or 1440p
  // canvas — below the threshold where resampling reads as a flash — while the
  // budget still cuts a 4K canvas back meaningfully.
  //
  // The price is desktop headroom during a drag: interaction now costs about
  // 1.8x the fragments it used to. That is affordable because it is still less
  // than the settled frame the same machine already renders. The coarse-pointer
  // (phone/tablet) tiers are deliberately untouched — the 1 / 2 split there is
  // what holds 60 fps on a phone, and that contract outranks this one.
  const ratioCap = interacting ? (coarsePointer ? 1 : 1.9) : coarsePointer ? 2 : 2.75;
  const pixelBudget = interacting
    ? coarsePointer
      ? 2_800_000
      : 8_600_000
    : coarsePointer
      ? 5_800_000
      : 11_500_000;
  const budgetRatio = Math.sqrt(pixelBudget / (safeWidth * safeHeight));
  return Math.max(1, Math.min(devicePixelRatio, ratioCap, budgetRatio));
}
