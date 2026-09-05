import type { Object3D } from "three";

import {
  CIVIC_FLAG_WIND_PROFILE,
  CIVIC_WIND_FLAG_KINDS,
  type WindFlagKind,
  isCivicWindFlagKind,
  updateCivicWindFlags,
  windFlagKindCount,
} from "../../WindFlags";
import type { VisualMode } from "../../visualMode";
import { SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS } from "./waterAtmosphere";

/**
 * The complete, closed world-motion allowlist for Schwellenraum.
 *
 * Camera/navigation changes are not world animation. Every world animation
 * path must opt into this contract; an unclassified flag is deliberately
 * frozen like water geometry, vessels, vegetation, particles, lamps and
 * props. The two non-flag exceptions are the light-only water veil and the
 * explicitly local Pariser Platz entity loop requested from owner footage.
 * Neither exception moves measured city geometry.
 */
// Backwards-compatible name for the formerly mode-specific allowlist. The
// four official classes now share one restrained wind field in every mode.
export const SCHWELLENRAUM_MOVING_FLAG_KINDS = CIVIC_WIND_FLAG_KINDS;

export type SchwellenraumWorldMotionSource =
  | { flagKind: WindFlagKind; kind: "wind-flag" }
  | {
      kind:
        | "light"
        | "minecraft-mob"
        | "particle"
        | "pariser-platz-entity-loop"
        | "prop"
        | "rain"
        | "snow"
        | "vegetation"
        | "vessel"
        | "water"
        | "water-light";
    };

/** Desktop default; touch devices use the shared lower 8 Hz profile. */
export const SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS =
  CIVIC_FLAG_WIND_PROFILE.frameIntervalMs;

export function isSchwellenraumWorldMotionAllowed(
  source: SchwellenraumWorldMotionSource,
): boolean {
  return (
    source.kind === "water-light" ||
    source.kind === "pariser-platz-entity-loop" ||
    (source.kind === "wind-flag" && isCivicWindFlagKind(source.flagKind))
  );
}

export function isSchwellenraumMovingFlagKind(kind: WindFlagKind): boolean {
  return isSchwellenraumWorldMotionAllowed({
    flagKind: kind,
    kind: "wind-flag",
  });
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
  updateCivicWindFlags(roots, elapsedSeconds);
}

export type SchwellenraumMotionDecision = {
  /** Whether this frame may advance the four allowlisted flag classes. */
  animateFlags: boolean;
  /** Existing Rain/Snow/Mob update paths are forbidden when false. */
  animateOrdinaryEnvironment: boolean;
  /** Whether the local, frustum-gated Pariser Platz loop may advance. */
  animatePariserPlatzEntities: boolean;
  /** Whether the material-only water veil may advance on this frame. */
  animateWaterLight: boolean;
  /** Whether world animation by itself requires a render on this RAF. */
  environmentalMotion: boolean;
};

export type SchwellenraumMotionOptions = {
  flagFrameIntervalMs?: number;
  lastFlagFrameAt: number;
  lastPariserPlatzFrameAt: number;
  lastWaterFrameAt: number;
  minecraftMobsVisible: boolean;
  mode: VisualMode;
  movingFlagCount: number;
  pariserPlatzEntitiesOnScreen: boolean;
  pariserPlatzEntityCount: number;
  pariserPlatzFrameIntervalMs: number;
  rainVisible: boolean;
  reducedMotion: boolean;
  snowVisible: boolean;
  timestamp: number;
  waterLightCount: number;
};

export function schwellenraumMotionDecision(
  {
    lastFlagFrameAt,
    lastPariserPlatzFrameAt,
    lastWaterFrameAt,
    flagFrameIntervalMs = SCHWELLENRAUM_FLAG_FRAME_INTERVAL_MS,
    minecraftMobsVisible,
    mode,
    movingFlagCount,
    pariserPlatzEntitiesOnScreen,
    pariserPlatzEntityCount,
    pariserPlatzFrameIntervalMs,
    rainVisible,
    reducedMotion,
    snowVisible,
    timestamp,
    waterLightCount,
  }: SchwellenraumMotionOptions,
  output?: SchwellenraumMotionDecision,
): SchwellenraumMotionDecision {
  const animateFlags =
    !reducedMotion &&
    movingFlagCount > 0 &&
    timestamp - lastFlagFrameAt + Number.EPSILON * 1_000 >= flagFrameIntervalMs;
  if (mode !== "schwellenraum") {
    const decision = output ?? {
      animateFlags: false,
      animateOrdinaryEnvironment: true,
      animatePariserPlatzEntities: false,
      animateWaterLight: false,
      environmentalMotion: false,
    };
    decision.animateFlags = animateFlags;
    decision.animateOrdinaryEnvironment = true;
    decision.animatePariserPlatzEntities = false;
    decision.animateWaterLight = false;
    decision.environmentalMotion =
      animateFlags || rainVisible || snowVisible || minecraftMobsVisible;
    return decision;
  }
  const animateWaterLight =
    !reducedMotion &&
    waterLightCount > 0 &&
    timestamp - lastWaterFrameAt >= SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS;
  const animatePariserPlatzEntities =
    !reducedMotion &&
    pariserPlatzEntitiesOnScreen &&
    pariserPlatzEntityCount > 0 &&
    timestamp - lastPariserPlatzFrameAt + Number.EPSILON * 1_000 >=
      pariserPlatzFrameIntervalMs;
  const decision = output ?? {
    animateFlags: false,
    animateOrdinaryEnvironment: false,
    animatePariserPlatzEntities: false,
    animateWaterLight: false,
    environmentalMotion: false,
  };
  decision.animateFlags = animateFlags;
  decision.animateOrdinaryEnvironment = false;
  decision.animatePariserPlatzEntities = animatePariserPlatzEntities;
  decision.animateWaterLight = animateWaterLight;
  decision.environmentalMotion =
    animateFlags || animateWaterLight || animatePariserPlatzEntities;
  return decision;
}
