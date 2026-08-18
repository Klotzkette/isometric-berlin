import type { Object3D } from "three";

import {
  type WindFlagKind,
  updateWindFlags,
  windFlagKindCount,
} from "../../WindFlags";
import type { VisualMode } from "../../visualMode";

/**
 * The complete, closed world-motion allowlist for Schwellenraum.
 *
 * Camera/navigation changes are not world animation. Every world animation
 * path must opt into this contract; an unclassified flag is deliberately
 * frozen like water, vessels, vegetation, particles, lamps and props.
 */
export const SCHWELLENRAUM_MOVING_FLAG_KINDS = [
  "federal-president",
  "germany",
  "european-union",
  "switzerland",
] as const satisfies readonly WindFlagKind[];

const movingFlagKinds: ReadonlySet<WindFlagKind> = new Set(
  SCHWELLENRAUM_MOVING_FLAG_KINDS,
);

export type SchwellenraumWorldMotionSource =
  | { flagKind: WindFlagKind; kind: "wind-flag" }
  | {
      kind:
        | "light"
        | "minecraft-mob"
        | "particle"
        | "prop"
        | "rain"
        | "snow"
        | "vegetation"
        | "vessel"
        | "water";
    };

/** A calm, deterministic 15 Hz cloth cadence instead of full-rate motion. */
export const SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS = 1000 / 15;

export function isSchwellenraumWorldMotionAllowed(
  source: SchwellenraumWorldMotionSource,
): boolean {
  return source.kind === "wind-flag" && movingFlagKinds.has(source.flagKind);
}

export function isSchwellenraumMovingFlagKind(kind: WindFlagKind): boolean {
  return isSchwellenraumWorldMotionAllowed({ flagKind: kind, kind: "wind-flag" });
}

export function countSchwellenraumMovingFlags(
  roots: readonly Object3D[],
): number {
  return roots.reduce(
    (sum, root) => sum + windFlagKindCount(root, isSchwellenraumMovingFlagKind),
    0,
  );
}

export function updateSchwellenraumMovingFlags(
  roots: readonly Object3D[],
  elapsedSeconds: number,
): void {
  for (const root of roots) {
    updateWindFlags(root, elapsedSeconds, {
      cacheKey: "schwellenraum-allowlist",
      kindAllowed: isSchwellenraumMovingFlagKind,
    });
  }
}

export type SchwellenraumMotionDecision = {
  /** Whether this frame may advance the four allowlisted flag classes. */
  animateFlags: boolean;
  /** Existing Rain/Snow/Mob update paths are forbidden when false. */
  animateOrdinaryEnvironment: boolean;
  /** Whether world animation by itself requires a render on this RAF. */
  environmentalMotion: boolean;
};

export function schwellenraumMotionDecision({
  lastFlagFrameAt,
  minecraftMobsVisible,
  mode,
  movingFlagCount,
  rainVisible,
  snowVisible,
  timestamp,
}: {
  lastFlagFrameAt: number;
  minecraftMobsVisible: boolean;
  mode: VisualMode;
  movingFlagCount: number;
  rainVisible: boolean;
  snowVisible: boolean;
  timestamp: number;
}): SchwellenraumMotionDecision {
  if (mode !== "schwellenraum") {
    return {
      animateFlags: false,
      animateOrdinaryEnvironment: true,
      environmentalMotion:
        rainVisible || snowVisible || minecraftMobsVisible,
    };
  }
  const animateFlags =
    movingFlagCount > 0 &&
    timestamp - lastFlagFrameAt >= SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS;
  return {
    animateFlags,
    animateOrdinaryEnvironment: false,
    environmentalMotion: animateFlags,
  };
}
