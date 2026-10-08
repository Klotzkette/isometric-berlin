import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import {
  createBerlinWallMemorialV174,
  createMinecraftBerlinWallMemorialV174,
} from "../src/BerlinWallMemorialV174";
import {
  BERLIN_WALL_MEMORIAL_V174_BUILDINGS,
  BERLIN_WALL_MEMORIAL_V174_POSTS,
  BERLIN_WALL_MEMORIAL_V174_PRISM_IDS,
  BERLIN_WALL_MEMORIAL_V174_SOLIDS,
  berlinWallMemorialV174EnclosureContains,
  berlinWallMemorialV174RoofAt,
  berlinWallMemorialV174SolidAt,
  berlinWallMemorialV174SourceColumn,
} from "../src/berlinWallMemorialV174Profile";
import {
  createDistantBuildingShells,
  PRISM_SUPPRESSED_IDS,
  type PrismBuilding,
  type PrismPayload,
} from "../src/IsometricCityWorld";
import {
  compilePedestrianObstacles,
  pedestrianPointIsBlocked,
  type PedestrianPolygonObstacle,
} from "../src/pedestrianNavigation";
import navigation from "../src/data/berlinWallMemorialV174Navigation.json";
import { persistentPedestrianSourceIds } from "./helpers/persistentPedestrianSources";

describe("Bernauer present-day memorial", () => {
  test("same complete static drawn detail for pointer and touch", () => {
    const full = createBerlinWallMemorialV174(), touch = createBerlinWallMemorialV174({ mobileLike: true });
    expect(full.children.length).toBe(3);
    expect(full.userData.northMitteV174).toBe("bernauer");
    for (let i = 0; i < full.children.length; i++) {
      const a = full.children[i] as Mesh, b = touch.children[i] as Mesh;
      expect(a.geometry.attributes.position.array).toEqual(b.geometry.attributes.position.array);
      expect(a.geometry.attributes.uv).toBeUndefined();
      expect(a.matrixAutoUpdate).toBe(false);
      if (a instanceof InstancedMesh && b instanceof InstancedMesh) {
        expect(a.instanceMatrix.array).toEqual(b.instanceMatrix.array);
        expect(a.count).toBe(b.count);
      }
    }
  });

  test("native is one orthogonal block batch and can be constructed repeatedly", () => {
    for (const mobileLike of [false, true]) {
      const native = createMinecraftBerlinWallMemorialV174({ mobileLike });
      expect(native.children.length).toBe(1);
      expect(native.userData.blockNative).toBe(true);
      const mesh = native.children[0] as InstancedMesh;
      expect(mesh.count).toBeLessThan(22000);
      for (let i = 0; i < mesh.count; i++) {
        expect(mesh.instanceMatrix.array[i * 16 + 2]).toBe(0);
        expect(mesh.instanceMatrix.array[i * 16 + 8]).toBe(0);
      }
    }
  });

  test("replacement predicate and memorial collision do not swallow public paths", () => {
    expect(berlinWallMemorialV174SourceColumn(1124, -1635, 5.2, 17.2)).toBe(true);
    expect(berlinWallMemorialV174SourceColumn(1124, -1635, 3, 15)).toBe(false);
    expect(berlinWallMemorialV174SourceColumn(1200, -1700, 5.2, 17.2)).toBe(false);
    expect(berlinWallMemorialV174EnclosureContains(1308, -1755)).toBe(true);
    expect(berlinWallMemorialV174EnclosureContains(1263.828601, -1733.620818)).toBe(false);
    expect(berlinWallMemorialV174SolidAt(1263.828601, -1733.620818, 6.8, 0.35)).toBe(false);
    expect(berlinWallMemorialV174RoofAt(1124, -1635)).toBeGreaterThan(10);
    expect(berlinWallMemorialV174RoofAt(1308, -1755)).toBe(null);
  });

  test("shared distant coverage suppresses exactly the two owned fallback records", async () => {
    const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
    const selected = payload.buildings.filter(p => BERLIN_WALL_MEMORIAL_V174_PRISM_IDS.has(p.id));
    expect([...BERLIN_WALL_MEMORIAL_V174_PRISM_IDS].sort()).toEqual(["45664094", "53333454"]);
    expect(selected.map(p => p.id).sort()).toEqual(["45664094", "53333454"]);
    for (const p of selected) expect(PRISM_SUPPRESSED_IDS.has(p.id)).toBeTrue();
    const distant = createDistantBuildingShells(payload, selected);
    expect(distant.children).toHaveLength(0);
    expect(distant.userData.sourceBuildingCount).toBe(2);
    expect(distant.userData.visibleBuildingCount).toBe(0);
    // A real neighbouring source record remains eligible, without a synthetic
    // stand-in whose geometry might accidentally bypass the integration policy.
    const neighbour = payload.buildings.find(p => p.id === "36985316")!;
    expect(neighbour).toBeDefined();
    expect(PRISM_SUPPRESSED_IDS.has(neighbour.id)).toBeFalse();
    expect(createDistantBuildingShells(payload, [neighbour]).children.length).toBeGreaterThan(0);
  });

  test("shared pedestrian index replaces old museum bodies with all source parts and physical memorial members", () => {
    const fixture = { buildings: navigation.legacyPrisms as PrismBuilding[] };
    const index = compilePedestrianObstacles(fixture);
    const unique = [...new Set([...index.cells.values()].flat())];
    const polygons = unique.filter((o): o is PedestrianPolygonObstacle => o.kind === "polygon");
    const byId = new Map(polygons.map(o => [o.sourceId, o]));
    const expectedIds = new Set([
      ...persistentPedestrianSourceIds,
      ...BERLIN_WALL_MEMORIAL_V174_BUILDINGS.map(p => p.sourceId),
      ...BERLIN_WALL_MEMORIAL_V174_SOLIDS.map((_, i) => `bernauer-wall-v174-${i}`),
      ...BERLIN_WALL_MEMORIAL_V174_POSTS.map((_, i) => `bernauer-post-v174-${i}`),
    ]);
    expect(BERLIN_WALL_MEMORIAL_V174_BUILDINGS).toHaveLength(18);
    expect(index.buildingCount).toBe(18);
    expect(index.obstacleCount).toBe(expectedIds.size);
    expect(unique).toHaveLength(expectedIds.size);
    expect(new Set(byId.keys())).toEqual(expectedIds);
    for (const id of BERLIN_WALL_MEMORIAL_V174_PRISM_IDS) expect(byId.has(id)).toBeFalse();
    for (const part of BERLIN_WALL_MEMORIAL_V174_BUILDINGS) {
      const obstacle = byId.get(part.sourceId)!;
      expect(obstacle.ring).toBe(part.ring);
      expect(obstacle.holes).toBe(part.holes);
      expect(obstacle.coordinateScale).toBe(1);
      expect(obstacle.minY).toBe(part.groundY);
      expect(obstacle.topAt).toBeDefined();
    }
    for (const [i, solid] of BERLIN_WALL_MEMORIAL_V174_SOLIDS.entries()) {
      const obstacle = byId.get(`bernauer-wall-v174-${i}`)!;
      expect(obstacle.ring).toBe(solid.ring);
      expect(obstacle.minY).toBe(solid.y0);
      expect(obstacle.maxY).toBe(solid.y1);
      const x = solid.ring.reduce((n, p) => n + p[0], 0) / solid.ring.length;
      const z = solid.ring.reduce((n, p) => n + p[1], 0) / solid.ring.length;
      expect(pedestrianPointIsBlocked(x, z, 5.2, index)).toBeTrue();
    }
    for (const [i, [x, z, half, top]] of BERLIN_WALL_MEMORIAL_V174_POSTS.entries()) {
      const obstacle = byId.get(`bernauer-post-v174-${i}`)!;
      expect(obstacle.ring).toEqual([[x-half,z-half],[x+half,z-half],[x+half,z+half],[x-half,z+half]]);
      expect(obstacle.maxY).toBe(top);
      expect(pedestrianPointIsBlocked(x, z, 5.2, index)).toBeTrue();
    }
    for (const [x, z] of navigation.publicCrossingPoints) {
      expect(pedestrianPointIsBlocked(x, z, 5.2, index)).toBeFalse();
    }
    // The public lawn and route do not become a broad invisible obstacle.
    expect(pedestrianPointIsBlocked(1250, -1660, 5.2, index)).toBeFalse();
    const unrelated = compilePedestrianObstacles({ buildings: [] });
    const unrelatedIds = new Set([...unrelated.cells.values()].flat().map(o => o.sourceId));
    expect(unrelatedIds).toEqual(persistentPedestrianSourceIds);
    expect(unrelated.obstacleCount).toBe(persistentPedestrianSourceIds.size);
    for (const id of expectedIds) if (!persistentPedestrianSourceIds.has(id)) expect(unrelatedIds.has(id)).toBeFalse();
  });
});
