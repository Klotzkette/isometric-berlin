import type { Object3D } from "three";

import {
  CIVIC_FLAG_WIND_PROFILE,
  CIVIC_WIND_FLAG_KINDS,
  type WindFlagKind,
  type CivicWindFlagTarget,
  isCivicWindFlagKind,
  updateCivicWindFlags,
  windFlagKindCount,
} from "../../WindFlags";
import type { VisualMode } from "../../visualMode";
import { SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS } from "./waterAtmosphere";
import { SCHWELLENRAUM_TOWER_STEAM_FRAME_INTERVAL_MS } from "./towerSteam";

/**
 * The complete, closed world-motion allowlist for Schwellenraum.
 *
 * Camera/navigation changes are not world animation. Every world animation
 * path must opt into this contract; an unclassified flag is deliberately
 * frozen like water geometry, vessels, vegetation, particles, lamps and
 * props. The named exceptions are the light-only water veil, the explicitly
 * local Pariser Platz entity loop and owner-requested rose steam above the
 * Fernsehturm sphere. None of these moves measured city geometry.
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
        | "fernsehturm-steam"
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
    source.kind === "fernsehturm-steam" ||
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
  targets?: readonly CivicWindFlagTarget[],
): void {
  updateCivicWindFlags(roots, elapsedSeconds, targets);
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
  /** Whether the local, frustum-gated Fernsehturm steam may advance. */
  animateTowerSteam: boolean;
  /** Whether world animation by itself requires a render on this RAF. */
  environmentalMotion: boolean;
};

export type SchwellenraumMotionOptions = {
  flagFrameIntervalMs?: number;
  lastFlagFrameAt: number;
  lastPariserPlatzFrameAt: number;
  lastWaterFrameAt: number;
  lastTowerSteamFrameAt?: number;
  towerSteamOnScreen?: boolean;
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
    lastTowerSteamFrameAt = 0,
    towerSteamOnScreen = false,
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
      animateTowerSteam: false,
      environmentalMotion: false,
    };
    decision.animateFlags = animateFlags;
    decision.animateOrdinaryEnvironment = true;
    decision.animatePariserPlatzEntities = false;
    decision.animateWaterLight = false;
    decision.animateTowerSteam = false;
    decision.environmentalMotion =
      animateFlags || rainVisible || snowVisible || minecraftMobsVisible;
    return decision;
  }
  const animateWaterLight =
    !reducedMotion &&
    waterLightCount > 0 &&
    timestamp - lastWaterFrameAt >= SCHWELLENRAUM_WATER_FRAME_INTERVAL_MS;
  const animateTowerSteam =
    !reducedMotion &&
    towerSteamOnScreen &&
    timestamp - lastTowerSteamFrameAt + Number.EPSILON * 1_000 >=
      SCHWELLENRAUM_TOWER_STEAM_FRAME_INTERVAL_MS;
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
    animateTowerSteam: false,
    environmentalMotion: false,
  };
  decision.animateFlags = animateFlags;
  decision.animateOrdinaryEnvironment = false;
  decision.animatePariserPlatzEntities = animatePariserPlatzEntities;
  decision.animateWaterLight = animateWaterLight;
  decision.animateTowerSteam = animateTowerSteam;
  decision.environmentalMotion =
    animateFlags || animateWaterLight || animatePariserPlatzEntities ||
    animateTowerSteam;
  return decision;
}
