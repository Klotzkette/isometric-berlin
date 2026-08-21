import type { StreetDetailsPayload } from "./TrafficSignals";
import {
  KINDERTRANSPORT_MEMORIAL_OSM_KEY,
  KINDERTRANSPORT_MEMORIAL_PROFILE,
} from "./KindertransportMemorial";
import {
  CSD_ATTACK_MEMORIAL_OSM_KEY,
  CSD_ATTACK_MEMORIAL_PROFILE,
} from "./CsdAttackMemorial";
import {
  TIERGARTEN_LITERARY_MEMORIALS_PROFILE,
  TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS,
  TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES,
  tiergartenLiteraryMemorialProtectedAt,
} from "./TiergartenLiteraryMemorials";

type MonumentEntry = NonNullable<StreetDetailsPayload["monuments"]>[number];

export const SCHWELLENRAUM_MEMORIAL_GRID_CELL_M = 32;

const PROTECTED_MIN_Y_M = -2;
const PROTECTED_MAX_Y_M = 45;

export type SchwellenraumProtectedMemorialShape = {
  halfDepthM: number;
  halfWidthM: number;
  kind: "box" | "circle" | "literary";
  maxYM: number;
  minYM: number;
  name: string;
  osmKey: string;
  radiusM: number;
  x: number;
  z: number;
};

export type SchwellenraumMemorialProtectionIndex = {
  cellSizeM: number;
  cells: Map<string, SchwellenraumProtectedMemorialShape[]>;
  protectedEntryCount: number;
  shapes: readonly SchwellenraumProtectedMemorialShape[];
  sourceKeys: ReadonlySet<string>;
};

function cellKey(xIndex: number, zIndex: number): string {
  return `${xIndex}:${zIndex}`;
}

function pointRadiusM(entry: MonumentEntry): number {
  if (entry.memorial_type === "stolperstein") return 0.75;
  if (entry.memorial_type === "plaque" || entry.memorial_type === "stone") {
    return 1.1;
  }
  if (entry.memorial_type === "ghost_bike") return 1.6;
  if (entry.kind === "tank" || entry.kind === "cannon") return 4.5;
  if (entry.kind === "monument" || entry.memorial_type === "war_memorial") {
    return 3.5;
  }
  return 2.2;
}

function protectionShapes(
  entry: MonumentEntry,
): readonly SchwellenraumProtectedMemorialShape[] {
  if (
    TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS.includes(
      entry.osm_key as (typeof TIERGARTEN_LITERARY_MEMORIAL_OSM_KEYS)[number],
    )
  ) {
    const isGoethe =
      entry.osm_key === TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe.osmKey;
    const profile = isGoethe
      ? TIERGARTEN_LITERARY_MEMORIALS_PROFILE.goethe
      : TIERGARTEN_LITERARY_MEMORIALS_PROFILE.lessing;
    const radiusM = isGoethe
      ? TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES.goethe.radiusM
      : TIERGARTEN_LITERARY_MEMORIAL_PROTECTION_PROFILES.lessing.radiusM;
    return [{
      halfDepthM: radiusM,
      halfWidthM: radiusM,
      kind: "literary",
      maxYM: PROTECTED_MAX_Y_M,
      minYM: PROTECTED_MIN_Y_M,
      name: profile.name,
      osmKey: profile.osmKey,
      radiusM,
      x: profile.worldM[0],
      z: profile.worldM[2],
    }];
  }
  if (entry.osm_key === CSD_ATTACK_MEMORIAL_OSM_KEY) {
    const treeX = entry.x_dm / 10;
    const treeZ = entry.z_dm / 10;
    const [benchLocalX, benchLocalZ] =
      CSD_ATTACK_MEMORIAL_PROFILE.benchOffsetLocalM;
    const cosine = Math.cos(CSD_ATTACK_MEMORIAL_PROFILE.rotationY);
    const sine = Math.sin(CSD_ATTACK_MEMORIAL_PROFILE.rotationY);
    const common = {
      maxYM: PROTECTED_MAX_Y_M,
      minYM: PROTECTED_MIN_Y_M,
      name: entry.name,
      osmKey: entry.osm_key,
    };
    const treeRadiusM = CSD_ATTACK_MEMORIAL_PROFILE.treeProtectionRadiusM;
    const benchRadiusM = CSD_ATTACK_MEMORIAL_PROFILE.benchProtectionRadiusM;
    return [
      {
        ...common,
        halfDepthM: treeRadiusM,
        halfWidthM: treeRadiusM,
        kind: "circle",
        radiusM: treeRadiusM,
        x: treeX,
        z: treeZ,
      },
      {
        ...common,
        halfDepthM: benchRadiusM,
        halfWidthM: benchRadiusM,
        kind: "circle",
        radiusM: benchRadiusM,
        x: treeX + cosine * benchLocalX + sine * benchLocalZ,
        z: treeZ - sine * benchLocalX + cosine * benchLocalZ,
      },
    ];
  }
  if (entry.osm_key === KINDERTRANSPORT_MEMORIAL_OSM_KEY) {
    return [{
      halfDepthM: KINDERTRANSPORT_MEMORIAL_PROFILE.collisionHalfExtentsM[1],
      halfWidthM: KINDERTRANSPORT_MEMORIAL_PROFILE.collisionHalfExtentsM[0],
      kind: "box",
      maxYM: PROTECTED_MAX_Y_M,
      minYM: PROTECTED_MIN_Y_M,
      name: entry.name,
      osmKey: entry.osm_key,
      radiusM: Math.hypot(
        ...KINDERTRANSPORT_MEMORIAL_PROFILE.collisionHalfExtentsM,
      ),
      x: entry.x_dm / 10,
      z: entry.z_dm / 10,
    }];
  }
  const widthM = Math.max(0, entry.w_dm / 10);
  const depthM = Math.max(0, entry.d_dm / 10);
  const radiusM = pointRadiusM(entry);
  const isArea = widthM > 0.4 || depthM > 0.4;
  return [{
    // OSM exports an axis-aligned source bbox here. A 1.25 m quiet margin
    // makes that conservative even for a rotated footprint and also gives a
    // standing/flying body room to stop before touching the object.
    halfDepthM: isArea ? Math.max(radiusM, depthM / 2 + 1.25) : radiusM,
    halfWidthM: isArea ? Math.max(radiusM, widthM / 2 + 1.25) : radiusM,
    kind: isArea ? "box" : "circle",
    maxYM: PROTECTED_MAX_Y_M,
    minYM: PROTECTED_MIN_Y_M,
    name: entry.name,
    osmKey: entry.osm_key,
    radiusM,
    x: entry.x_dm / 10,
    z: entry.z_dm / 10,
  }];
}

function shapeBounds(
  shape: SchwellenraumProtectedMemorialShape,
): readonly [number, number, number, number] {
  const radial = shape.kind === "circle" || shape.kind === "literary";
  const halfX = radial ? shape.radiusM : shape.halfWidthM;
  const halfZ = radial ? shape.radiusM : shape.halfDepthM;
  return [shape.x - halfX, shape.z - halfZ, shape.x + halfX, shape.z + halfZ];
}

/**
 * Compile all source-flagged memorials into a uniform spatial hash. Query cost
 * therefore depends on the handful of shapes in one 32 m cell, not on the
 * roughly one thousand protected records in the widened city payload.
 */
export function createSchwellenraumMemorialProtectionIndex(
  monuments: ReadonlyArray<MonumentEntry> | undefined,
  cellSizeM = SCHWELLENRAUM_MEMORIAL_GRID_CELL_M,
): SchwellenraumMemorialProtectionIndex {
  if (!Number.isFinite(cellSizeM) || cellSizeM <= 0) {
    throw new Error("Schwellenraum memorial grid cells must be positive");
  }
  const cells = new Map<string, SchwellenraumProtectedMemorialShape[]>();
  const shapes: SchwellenraumProtectedMemorialShape[] = [];
  const sourceKeys = new Set<string>();
  for (const entry of monuments ?? []) {
    if (entry.schwellenraum_protected !== true) continue;
    if (!entry.osm_key || sourceKeys.has(entry.osm_key)) {
      throw new Error(
        `Duplicate or missing protected OSM key: ${entry.osm_key}`,
      );
    }
    sourceKeys.add(entry.osm_key);
    for (const shape of protectionShapes(entry)) {
      shapes.push(shape);
      const [minX, minZ, maxX, maxZ] = shapeBounds(shape);
      for (
        let zIndex = Math.floor(minZ / cellSizeM);
        zIndex <= Math.floor(maxZ / cellSizeM);
        zIndex += 1
      ) {
        for (
          let xIndex = Math.floor(minX / cellSizeM);
          xIndex <= Math.floor(maxX / cellSizeM);
          xIndex += 1
        ) {
          const key = cellKey(xIndex, zIndex);
          const bucket = cells.get(key);
          if (bucket) bucket.push(shape);
          else cells.set(key, [shape]);
        }
      }
    }
  }
  return {
    cellSizeM,
    cells,
    protectedEntryCount: sourceKeys.size,
    shapes,
    sourceKeys,
  };
}

/** Horizontal clearance from a point to the nearest protected source shape. */
export function schwellenraumProtectedMemorialClearanceM(
  index: SchwellenraumMemorialProtectionIndex,
  x: number,
  z: number,
): number {
  if (![x, z].every(Number.isFinite)) return 0;
  let clearanceM = Number.POSITIVE_INFINITY;
  for (const shape of index.shapes) {
    if (shape.kind === "circle" || shape.kind === "literary") {
      clearanceM = Math.min(
        clearanceM,
        Math.max(0, Math.hypot(x - shape.x, z - shape.z) - shape.radiusM),
      );
      continue;
    }
    clearanceM = Math.min(
      clearanceM,
      Math.hypot(
        Math.max(0, Math.abs(x - shape.x) - shape.halfWidthM),
        Math.max(0, Math.abs(z - shape.z) - shape.halfDepthM),
      ),
    );
  }
  return clearanceM;
}

export function schwellenraumProtectedMemorialShapeAt(
  index: SchwellenraumMemorialProtectionIndex,
  x: number,
  y: number,
  z: number,
): SchwellenraumProtectedMemorialShape | null {
  if (![x, y, z].every(Number.isFinite)) return null;
  const bucket = index.cells.get(
    cellKey(Math.floor(x / index.cellSizeM), Math.floor(z / index.cellSizeM)),
  );
  if (!bucket) return null;
  for (const shape of bucket) {
    if (y < shape.minYM || y > shape.maxYM) continue;
    if (shape.kind === "literary") {
      if (tiergartenLiteraryMemorialProtectedAt(x, z)) return shape;
    } else if (shape.kind === "circle") {
      if ((x - shape.x) ** 2 + (z - shape.z) ** 2 <= shape.radiusM ** 2) {
        return shape;
      }
    } else if (
      Math.abs(x - shape.x) <= shape.halfWidthM &&
      Math.abs(z - shape.z) <= shape.halfDepthM
    ) {
      return shape;
    }
  }
  return null;
}

export function schwellenraumProtectedMemorialAt(
  index: SchwellenraumMemorialProtectionIndex,
  x: number,
  y: number,
  z: number,
): boolean {
  return schwellenraumProtectedMemorialShapeAt(index, x, y, z) !== null;
}
