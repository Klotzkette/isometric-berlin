import { HAUPTBAHNHOF_ACCESS, hauptbahnhofDoorOpeningAt } from "./HauptbahnhofAccessProfile";
import {
  HBF_CIRCULATION_V291,
  hbfCirculationGroundLocalAtV291,
  hbfFlightGroundAtV291,
  hbfFlightOpeningAtV291,
  hbfLandingContainsV291,
  hbfLevelFloorContainsV291,
  hbfUpperPlatformAtV291,
  hbfWorldToLocalV291,
} from "./HbfCirculationV291";
import { HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS } from "./MinecraftHeroNavigation";
import type { VisualMode } from "./visualMode";

const station = HBF_CIRCULATION_V291;
const access = HAUPTBAHNHOF_ACCESS;
const sourceIds = new Set<string>(HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS);
const upperEnvelopeSourceIds = new Set<string>(station.upperRailEnvelopeSourceIds);
const local: [number, number, number] = [0, 0, 0];

function upperPublicRouteAt(px: number, py: number, pz: number): boolean {
  // A hole removes slab support, not the public air above it. Allow the
  // capsule's edge at the actual platform boundary without inventing floor.
  if (py >= 10.2 && py <= 13.2 && hbfUpperPlatformAtV291(px, pz, 0.45)) return true;
  return station.flights.some((flight) => {
    if (flight.fromLevelId !== "upper-rail") return false;
    const top = hbfFlightGroundAtV291(flight, px, pz, 0.8);
    return top !== null && py >= top - 0.7 && py <= top + 2.3;
  });
}

/** Replace only the receipted coarse station envelopes in the public hall. */
export function hauptbahnhofWalkableInteriorAt(
  x: number, y: number, z: number, sourceBuildingId?: string,
): boolean {
  if (!sourceBuildingId || !sourceIds.has(sourceBuildingId) && !upperEnvelopeSourceIds.has(sourceBuildingId)) return false;
  const [px, py, pz] = hbfWorldToLocalV291(x, y, z, local);
  if (upperEnvelopeSourceIds.has(sourceBuildingId)) return upperPublicRouteAt(px, py, pz);
  const ax = Math.abs(px), az = Math.abs(pz);
  if (az > 99 || py < -15.2 || py > 13.2) return false;
  // Expanding the public interior must not punch a high opening in a gable.
  if (az >= 88.5 && py > access.doorHeightM) return false;
  if (ax < 19.6) return true;
  if (py < -5.2 && ax < station.deepHalfWidthM && az <= 90) return true;
  return upperPublicRouteAt(px, py, pz);
}

/** All represented hall solids, identical across the six visual modes. */
export function hauptbahnhofSolidAt(
  mode: VisualMode, x: number, y: number, z: number, radius = 0,
): boolean {
  const [px, py, pz] = hbfWorldToLocalV291(x, y, z, local);
  const r = Math.max(0, radius), ax = Math.abs(px), az = Math.abs(pz);
  if (ax > 40 + r || az > 94 + r || py < -15.65 - r || py > 27 + r) return false;
  if (mode === "minecraft") {
    if (Math.abs(az - 89.1) <= 0.7 + r && ax <= 19.7 + r && py >= 1.2 - r &&
      (py > 6.8 - r || ax >= 4.3 - r)) return true;
    if (Math.abs(ax - 19.2) <= 0.7 + r && az <= 91.8 + r && py >= 1.32 - r &&
      !upperPublicRouteAt(px, py, pz)) return true;
  } else if (Math.abs(az - access.facadeLocalZ) <= 0.28 + r && ax <= 20.4 + r && py >= -r) {
    if (py >= access.doorHeightM - r) return true;
    if (!hauptbahnhofDoorOpeningAt(px - r) || !hauptbahnhofDoorOpeningAt(px + r)) return true;
  }
  if (mode !== "minecraft" && Math.abs(ax - 20) <= 0.3 + r && az <= 90 + r && py >= -r && !upperPublicRouteAt(px, py, pz)) return true;
  for (const shaft of station.shafts) {
    if (py < shaft.bottomLocalY - r || py > shaft.topLocalY + r) continue;
    if (mode === "minecraft" ? Math.max(Math.abs(px - shaft.x), Math.abs(pz - shaft.z)) <= 2.3 + r :
      Math.hypot(px - shaft.x, pz - shaft.z) <= shaft.radiusM + r) return true;
  }
  if (py >= -14.055 - r && py <= station.deepColumnTopLocalY + r) {
    const radiusM = mode === "minecraft" ? station.deepColumnNativeRadiusM : station.deepColumnRadiusM;
    for (const columnX of station.deepColumnCentresLocalX) for (const columnZ of station.deepColumnCentresLocalZ) {
      if (Math.hypot(px - columnX, pz - columnZ) <= radiusM + r) return true;
    }
  }
  if (py >= -r && py <= 3.55 + r && ax <= 4.2 + r && Math.abs(pz - 37) <= 6.5 + r) return true;
  for (const level of station.levels) {
    if (!("openHalfM" in level)) continue;
    const top = level.topLocalY;
    if (py < top - 0.05 - r || py > top + 1.3 + r) continue;
    const railFar = level.id === "ground-concourse" ? access.foyerInnerLocalZ : station.armFarLocalZ;
    const landingOpening = Math.abs(az - level.bridgeLocalZ) <= 2.6 + r || station.landings.some((landing) =>
      landing.levelId === level.id && hbfLandingContainsV291(landing, px, pz, r + 0.15));
    if (Math.abs(ax - level.openHalfM) <= 0.07 + r && az <= railFar + r && !landingOpening) return true;
    if (level.id === "ground-concourse" && Math.abs(az - access.foyerInnerLocalZ) <= 0.07 + r && ax <= access.groundAtriumHalfWidthM + r) return true;
    if (Math.abs(Math.abs(pz) - level.bridgeLocalZ) >= 2.48 - r && Math.abs(Math.abs(pz) - level.bridgeLocalZ) <= 2.62 + r && ax <= level.openHalfM + 0.4 + r &&
      !hbfFlightOpeningAtV291(px, pz, top, r + 0.15)) return true;
  }
  // Exact slab tops never block a standing player. The dynamic tread caps
  // retain the stable shared incline as their physical walking support.
  for (const level of station.levels) {
    if (py >= level.topLocalY - 0.03 - r || py <= level.topLocalY - 0.5 - r) continue;
    if (hbfLevelFloorContainsV291(level.id, px, pz, mode === "minecraft") && !hbfFlightOpeningAtV291(px, pz, level.topLocalY, r + 0.1)) return true;
  }
  for (const flight of station.flights) {
    const height = hbfFlightGroundAtV291(flight, px, pz, r + 0.18);
    if (height === null || py < height + 0.05 - r || py > height + 1.3 + r) continue;
    const inner = hbfFlightGroundAtV291(flight, px, pz, -0.17 - r);
    if (inner === null) return true;
  }
  return py >= -5.3 - r && py <= 6.5 + r && Math.abs(ax - 17.2) <= 0.48 + r &&
    [31, 55, 79].some((columnZ) => Math.abs(az - columnZ) <= 0.48 + r);
}

/** Real five-level slabs, platforms, landing connectors and stable inclines. */
export function hauptbahnhofGroundAt(
  mode: VisualMode, x: number, z: number, currentGroundY?: number,
): number | null {
  const [px, , pz] = hbfWorldToLocalV291(x, station.frame.anchorWorld[1], z, local);
  const hint = Number.isFinite(currentGroundY) ? currentGroundY! - station.frame.anchorWorld[1] : access.floorTopLocalY;
  const localY = hbfCirculationGroundLocalAtV291(px, pz, hint, mode === "minecraft");
  return localY === null ? null : station.frame.anchorWorld[1] + localY;
}

/** Ignore only the obsolete alternate-mode fittings of this station interior. */
export function hauptbahnhofCirculationBoundsAt(x: number, y: number, z: number): boolean {
  const [px, py, pz] = hbfWorldToLocalV291(x, y, z, local);
  return Math.abs(px) <= 39.2 && Math.abs(pz) <= 94 && py >= -15.7 && py <= 15;
}
