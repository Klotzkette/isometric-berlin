import { HAUPTBAHNHOF_ACCESS, hauptbahnhofDoorOpeningAt } from "./HauptbahnhofAccessProfile";
import { MINECRAFT_ARCHITECTURAL_PROFILES } from "./MinecraftArchitecturalLandmarks";
import { HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS } from "./MinecraftHeroNavigation";
import type { VisualMode } from "./visualMode";

const station = MINECRAFT_ARCHITECTURAL_PROFILES.hauptbahnhof;
const access = HAUPTBAHNHOF_ACCESS;
const sourceIds = new Set<string>(HAUPTBAHNHOF_NAVIGATION_SOURCE_IDS);
const angle = station.rotationDegrees * Math.PI / 180;
const cosine = Math.cos(angle);
const sine = Math.sin(angle);
const local = { x: 0, y: 0, z: 0 };

function stationLocal(x: number, y: number, z: number): typeof local {
  const dx = x - station.anchorWorld[0];
  const dz = z - station.anchorWorld[2];
  local.x = dx * cosine - dz * sine;
  local.y = y - station.anchorWorld[1];
  local.z = dx * sine + dz * cosine;
  return local;
}

/** Replace only the known coarse station envelopes in the public hall. */
export function hauptbahnhofWalkableInteriorAt(
  x: number,
  y: number,
  z: number,
  sourceBuildingId?: string,
): boolean {
  if (!sourceBuildingId || !sourceIds.has(sourceBuildingId)) return false;
  const p = stationLocal(x, y, z);
  // Local y includes the slightly different terrain, voxel and drawn datums.
  // Authored walls/door jambs/rails are tested separately before this override.
  return Math.abs(p.x) < 19.6 && Math.abs(p.z) <= 99 && p.y >= -0.5 && p.y <= 4.9;
}

/**
 * Ground-floor public solids in the represented station, not an opaque
 * building-sized box. Pass zero padding from the pedestrian capsule sampler;
 * swept-flight callers may supply their sphere radius.
 */
export function hauptbahnhofSolidAt(
  mode: VisualMode,
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  const p = stationLocal(x, y, z);
  const r = Math.max(0, radius);
  const ax = Math.abs(p.x);
  const az = Math.abs(p.z);
  if (ax > 22 + r || az > 94 + r || p.y < -15.15 - r || p.y > 27 + r) return false;
  if (mode === "minecraft") {
    // These are the actual extents of the 7.4 m blocks beside the omitted
    // central gable cell: the visible ground-level aperture is 8.6 m wide.
    if (Math.abs(az - 89.1) <= 0.7 + r && ax <= 19.7 + r && p.y >= 1.2 - r) {
      if (p.y > 6.8 - r || ax >= 4.3 - r) return true;
    }
    return Math.abs(ax - 19.2) <= 0.7 + r && az <= 91.8 + r && p.y >= 1.32 - r;
  }
  if (Math.abs(az - access.facadeLocalZ) <= 0.28 + r && ax <= 20.4 + r && p.y >= -r) {
    if (p.y >= access.doorHeightM - r) return true;
    if (!hauptbahnhofDoorOpeningAt(p.x - r) || !hauptbahnhofDoorOpeningAt(p.x + r)) return true;
  }
  // The hall's glass sides and retained shopfront line bound its public floor.
  if (Math.abs(ax - 20) <= 0.3 + r && az <= 90 + r && p.y >= -r) return true;
  // Four full-height panoramic shafts. Their cabins/landing doors remain solid.
  if (p.y <= 14.5 + r) {
    for (const liftX of [-9.5, 9.5]) {
      for (const liftZ of [-33, 33]) {
        if (Math.hypot(p.x - liftX, p.z - liftZ) <= 1.82 + r) return true;
      }
    }
  }
  if (p.y >= -r && p.y <= 3.55 + r && ax <= 4.2 + r && Math.abs(p.z - 37) <= 6.5 + r) return true;
  // Ground-gallery balustrades and the transverse guard at each foyer.
  if (p.y >= 0.2 - r && p.y <= 1.55 + r) {
    if (Math.abs(ax - 9.5) <= 0.07 + r && az >= 20 - r && az <= access.foyerInnerLocalZ + r) return true;
    if (Math.abs(az - access.foyerInnerLocalZ) <= 0.07 + r && ax <= 9.5 + r) return true;
    if (Math.abs(Math.abs(p.z) - 49.5) >= 2.48 - r && Math.abs(Math.abs(p.z) - 49.5) <= 2.62 + r && ax <= 9.9 + r) return true;
  }
  // Existing structural columns in both arms of the daylight hall.
  return p.y >= -5.3 - r && p.y <= 6.5 + r &&
    Math.abs(ax - 17.2) <= 0.48 + r &&
    [31, 55, 79].some((columnZ) => Math.abs(az - columnZ) <= 0.48 + r);
}

/** Floors only where the rendered ground-level landing/gallery actually is. */
export function hauptbahnhofGroundAt(
  mode: VisualMode,
  x: number,
  z: number,
  currentGroundY?: number,
): number | null {
  const p = stationLocal(x, station.anchorWorld[1], z);
  const ax = Math.abs(p.x);
  const az = Math.abs(p.z);
  if (ax > 20 || az > access.foyerOuterLocalZ) return null;
  if (mode === "minecraft") {
    return station.anchorWorld[1] + station.publicFloorTopLocalY;
  }
  const foyer = az >= access.foyerInnerLocalZ;
  // Hand off only at the existing inner ramp footprint. Letting the much
  // wider deep-platform floor win at z=78 used to drop a gallery walker
  // fourteen metres as soon as they left the narrow portal volume.
  if (mode === "schwellenraum") {
    if (Number.isFinite(currentGroundY) && Math.abs(currentGroundY! - station.anchorWorld[1]) > 2) return null;
    if (az <= 36.5 && ax >= 9 && ax <= 15) return null;
  }
  const gallery = az >= 20 && ax >= access.groundAtriumHalfWidthM;
  const bridge = Math.abs(az - 49.5) <= 2.6 && ax <= 9.9;
  const pavilionLanding = Math.abs(p.z - 37) <= 7.1 && ax <= 4.8;
  const groundFloor = foyer || gallery || bridge || pavilionLanding;
  if (mode === "schwellenraum") {
    return groundFloor ? station.anchorWorld[1] + access.floorTopLocalY : null;
  }
  const hint = Number.isFinite(currentGroundY)
    ? currentGroundY! - station.anchorWorld[1]
    : access.floorTopLocalY;
  let floor: number | null = null;
  const acceptFloor = (top: number, present: boolean): void => {
    if (present && top <= hint + 0.5 && (floor === null || top > floor)) floor = top;
  };
  acceptFloor(access.floorTopLocalY, groundFloor);
  // Resolve existing upper/lower slabs from above, without snapping a lower
  // visitor upward. This also handles a mode switch from Minecraft's solid
  // floor into the drawn atrium: null would fall back to invisible terrain.
  acceptFloor(4.85, az >= 20 && az <= 88 &&
    (ax >= 7.5 || Math.abs(az - 28) <= 2.6));
  acceptFloor(-5.15, az >= 20 && az <= 88 &&
    (ax >= 12 || Math.abs(az - 71) <= 2.6));
  acceptFloor(-14.055, az <= 84 && Math.abs(ax - 9.5) <= 4.8);
  acceptFloor(-15, az <= 90);
  return floor === null ? null : station.anchorWorld[1] + floor;
}
