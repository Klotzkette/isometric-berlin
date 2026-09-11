import type { Group } from "three";
import { createSmoothSurfaces, type SurfacePayload } from "./IsometricCityWorld";
import { smoothGroundTopSampler, WATER_TOP_Y, type VoxelPayload } from "./MinecraftVoxelWorld";
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
): Group | null {
  if (!coarsePointer || !ground || !surfaces) return null;
  const sample = smoothGroundTopSampler(ground);
  const { cell_m: cell, grid: { min_x_idx: minX, min_z_idx: minZ } } = ground;
  const terrainAt = (x: number, z: number): number => sample(x / cell - minX, z / cell - minZ);
  const waterTop = ground.water_top_y_m ?? WATER_TOP_Y;
  const root = createSmoothSurfaces(
    surfaceFamilyPayload(surfaces, "water"), waterTop, waterTop + 5.35, terrainAt,
    { excludeDistrictMarkings: true },
  );
  root.name = INITIAL_DRAWN_WATER_NAME;
  root.userData.waterPolygonCount = surfaces.water.length;
  root.userData.basinCount = surfaces.water.filter((entry) => entry.kind === "basin").length;
  root.userData.sunkenWallCount = surfaces.sunken_walls?.length ?? 0;
  return root;
}
