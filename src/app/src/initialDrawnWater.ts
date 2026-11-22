import type { Group } from "three";
import { createSmoothSurfaces, isInvalidenParkBasinV371, type SurfacePayload } from "./IsometricCityWorld";
import { smoothGroundTopSampler, WATER_TOP_Y, type VoxelPayload } from "./terrainPayload";
import { surfaceFamilyPayload } from "./progressiveWorld";

export const SUNKEN_WALL_OSM_KEY = "way/1065885229";
export const INITIAL_DRAWN_WATER_NAME = "source-bound drawn water";

/** The retained OSM cut-out supplies the measured wedge, rather than a marker. */
export function drawnWaterMonumentKeys(
  surfaces: SurfacePayload | null | undefined,
): ReadonlySet<string> {
  const wall = surfaces?.sunken_walls?.find((entry) => entry.name === "Sinkende Mauer");
  const basin = surfaces?.water.some((entry) => entry.kind === "basin" && entry.ring.length >= 4);
  return new Set(wall && wall.ring.length >= 4 && basin ? [SUNKEN_WALL_OSM_KEY] : []);
}

/**
 * Touch installs the complete exact water family before the startup curtain
 * opens, using the already decoded terrain. Other surface families follow in
 * bounded worker batches; the worker skips this already attached water family.
 */
export function createInitialDrawnWater(
  ground: VoxelPayload | null,
  surfaces: SurfacePayload | null,
  coarsePointer: boolean,
  invalidenGroundV371 = false,
): Group | null {
  if ((!coarsePointer && !invalidenGroundV371) || !ground || !surfaces) return null;
  const payload = surfaceFamilyPayload(surfaces, "water");
  if (!coarsePointer) {
    // This is the sole owner of this basin on desktop. The progressive worker
    // still streams all remaining city water when its normal turn arrives.
    payload.water = payload.water.filter(isInvalidenParkBasinV371);
    if (!payload.water.length) return null;
    payload.sunken_walls = payload.sunken_walls?.filter(wall => wall.name === "Sinkende Mauer");
  }
  const sample = smoothGroundTopSampler(ground);
  const { cell_m: cell, grid: { min_x_idx: minX, min_z_idx: minZ } } = ground;
  const terrainAt = (x: number, z: number): number => sample(x / cell - minX, z / cell - minZ);
  const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
  const root = createSmoothSurfaces(
    payload, waterTop, waterTop + 5.35, terrainAt,
    { excludeDistrictMarkings: true, invalidenGroundV371 },
  );
  root.name = coarsePointer ? INITIAL_DRAWN_WATER_NAME : "Invalidenpark basin and Sinkende Mauer";
  root.userData.waterPolygonCount = payload.water.length;
  root.userData.basinCount = payload.water.filter((entry) => entry.kind === "basin").length;
  root.userData.sunkenWallCount = payload.sunken_walls?.length ?? 0;
  return root;
}
