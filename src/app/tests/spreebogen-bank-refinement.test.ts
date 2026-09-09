import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import ground from "../public/mesh/regierungsviertel/ground-context.json";
import surfaces from "../public/mesh/regierungsviertel/surface-polygons.json";
import type { VoxelPayload } from "../src/MinecraftVoxelWorld";
import {
  createSpreebogenPark,
  createMinecraftSpreebogenPark,
  createSpreebogenLawnGroundAt,
} from "../src/SpreebogenPark";
import {
  LUDWIG_ERHARD_UFER_WORLD_M,
  PANORAMAWEG_WORLD_M,
  SPREEBOGEN_SHORE_WORLD_M,
  spreebogenBankTopAt,
  spreebogenPromenadeYAt,
  spreebogenTerrainYAt,
  spreebogenPanoramaYAt,
  spreebogenLowerPathYAt,
  spreebogenWalkSurfaceAt,
  isSpreebogenRasterReplacementAt,
} from "../src/spreebogenBankProfile";
const payload = ground as unknown as VoxelPayload;
const park = createSpreebogenPark(payload);
park.updateMatrixWorld(true);
const ray = (mesh: Mesh, x: number, z: number): number | null => {
  const hits = new Raycaster(
    new Vector3(x, 30, z),
    new Vector3(0, -1, 0),
  ).intersectObject(mesh, false);
  return hits[0]?.point.y ?? null;
};
describe("Spreebogen source-bound continuous river bank", () => {
  test("the float32 park boundary and its backing never protrude through the visible river lawn", () => {
    const backing = park.getObjectByName("Spreebogenpark exact OSM park terrain") as Mesh;
    const lawn = park.getObjectByName("Spreebogenpark maintained river lawn strip") as Mesh;
    let samples = 0;
    for (let x = -138; x < 270; x += 4) for (let z = -434; z < -320; z += 4) {
      const baseY = ray(backing, x, z), lawnY = ray(lawn, x, z);
      if (baseY === null || lawnY === null) continue;
      expect(baseY).toBeLessThan(lawnY - 0.03);
      samples++;
    }
    expect(samples).toBeGreaterThan(240);
  });
  test("retains every exact OSM shore vertex and lower path height without changing other banks", () => {
    const shoreVertices = new Set(
      surfaces.water.flatMap((p) => p.ring.map(([x, z]) => `${x}:${z}`)),
    );
    for (const [x, z] of SPREEBOGEN_SHORE_WORLD_M)
      expect(
        shoreVertices.has(`${Math.round(x * 10)}:${Math.round(z * 10)}`),
      ).toBe(true);
    for (const [x, y, z] of LUDWIG_ERHARD_UFER_WORLD_M) {
      expect(spreebogenLowerPathYAt(x, z)).toBeCloseTo(y, 8);
      expect(spreebogenTerrainYAt(x, z, 99)).toBeCloseTo(y + 0.09, 8);
    }
    for (const [x, z] of [
      [40, -490],
      [400, -420],
      [-200, -350],
      [20, -200],
      [200, -500],
    ]) {
      expect(spreebogenTerrainYAt(x, z, 9)).toBe(9);
      expect(spreebogenBankTopAt(x, z)).toBeNull();
      expect(isSpreebogenRasterReplacementAt(x, z, 4)).toBe(false);
    }
  });
  test("promenade actual triangles remain continuous through every joint and match pedestrian support", () => {
    const mesh = park.getObjectByName(
      "Spreebogenpark Ludwig-Erhard-Ufer stone edge bands",
    ) as Mesh;
    for (let i = 0; i < LUDWIG_ERHARD_UFER_WORLD_M.length - 1; i++) {
      const a = LUDWIG_ERHARD_UFER_WORLD_M[i],
        b = LUDWIG_ERHARD_UFER_WORLD_M[i + 1];
      for (const t of [0.001, 0.2, 0.5, 0.8, 0.999]) {
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[2] + (b[2] - a[2]) * t,
          y = a[1] + (b[1] - a[1]) * t;
        expect(ray(mesh, x, z)).not.toBeNull();
        expect(Math.abs(ray(mesh, x, z)! - (y + 0.09))).toBeLessThan(0.025);
        expect(spreebogenPromenadeYAt(x, z)).toBeCloseTo(ray(mesh, x, z)!, 4);
      }
    }
  });
  test("upper path joins have real sloping tops and retain the documented five-metre envelope", () => {
    const mesh = park.getObjectByName(
      "Spreebogenpark raised Panoramaweg",
    ) as Mesh;
    for (let i = 0; i < PANORAMAWEG_WORLD_M.length - 1; i++) {
      const a = PANORAMAWEG_WORLD_M[i],
        b = PANORAMAWEG_WORLD_M[i + 1];
      for (const t of [0.001, 0.25, 0.5, 0.75, 0.999]) {
        const x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        const y =
          spreebogenPanoramaYAt(i) * (1 - t) +
          spreebogenPanoramaYAt(i + 1) * t +
          0.11;
        expect(ray(mesh, x, z)).not.toBeNull();
        expect(Math.abs(ray(mesh, x, z)! - y)).toBeLessThan(0.025);
        expect(spreebogenWalkSurfaceAt(x, z, y)).toBeCloseTo(
          ray(mesh, x, z)!,
          4,
        );
        expect(spreebogenWalkSurfaceAt(x, z, y - 2)).not.toBe(y);
      }
    }
    for (let i = 0; i < PANORAMAWEG_WORLD_M.length; i++)
      expect(
        spreebogenPanoramaYAt(i) -
          spreebogenLowerPathYAt(
            PANORAMAWEG_WORLD_M[i][0],
            PANORAMAWEG_WORLD_M[i][1],
          ),
      ).toBeLessThanOrEqual(5.00001);
  });
  test("replaces stray river slabs and double-raised lawns with bounded source-axis geometry", () => {
    expect(
      park.getObjectByName("Spreebogenpark Gartenspur slabs"),
    ).toBeUndefined();
    const garden = park.getObjectByName(
      "Spreebogenpark source-bound Gartenspur slabs",
    ) as Mesh;
    const b = new Box3().setFromObject(garden);
    expect(b.max.x).toBeLessThan(180);
    for (const side of ["west", "east"]) {
      const lawn = park.getObjectByName(
        `Spreebogenpark ${side} rising lawn`,
      ) as Mesh;
      expect(new Box3().setFromObject(lawn).max.y).toBeLessThan(7.7);
    }
  });
  test("full and mobile Minecraft use one bounded native batch with no smooth double", () => {
    expect(park.userData.keepInMinecraft).toBe(false);
    let full = 0;
    for (const mobileLike of [false, true]) {
      const p = createMinecraftSpreebogenPark(payload, { mobileLike });
      expect(p.children).toHaveLength(1);
      const mesh = p.children[0] as InstancedMesh;
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.count).toBeGreaterThan(2500);
      expect(mesh.count).toBeLessThan(25000);
      if (mobileLike) expect(mesh.count).toBeLessThan(full);
      else full = mesh.count;
    }
  });
  test("compiled walking support follows actual rising turf triangles rather than the old DGM", () => {
    const before = Bun.hash(JSON.stringify(payload));
    const lawnAt = createSpreebogenLawnGroundAt(payload);
    let sampled = 0;
    for (const side of ["west", "east"]) {
      const lawn = park.getObjectByName(`Spreebogenpark ${side} rising lawn`) as Mesh;
      for (let x = -60; x <= 100; x += 10) for (let z = -405; z <= -285; z += 10) {
        const y = ray(lawn, x, z);
        if (y === null) continue;
        expect(lawnAt(x, z)).toBeCloseTo(y, 5);
        sampled++;
      }
    }
    expect(sampled).toBeGreaterThan(100);
    expect(lawnAt(10, -405)).toBeCloseTo(7.3271167255, 5);
    for (const [x, z] of [[20, -350], [500, 500], [20, -230], [-200, -400]])
      expect(lawnAt(x, z)).toBeNull();
    expect(Bun.hash(JSON.stringify(payload))).toBe(before);
  });
  test("both native Minecraft profiles cover every path joint and match actual flat deck support", () => {
    const paths = [
      LUDWIG_ERHARD_UFER_WORLD_M.map(([x, , z]) => [x, z]),
      PANORAMAWEG_WORLD_M,
    ];
    for (const mobileLike of [false, true]) {
      const native = createMinecraftSpreebogenPark(payload, { mobileLike });
      native.updateMatrixWorld(true);
      const mesh = native.children[0] as InstancedMesh;
      for (const path of paths) for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        for (const t of [0.001, 0.2, 0.5, 0.8, 0.999]) {
          const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
          const actual = ray(mesh, x, z);
          expect(actual).not.toBeNull();
          expect(spreebogenWalkSurfaceAt(x, z, Infinity, true, mobileLike)).toBeCloseTo(actual!, 5);
        }
      }
      for (const [x, z] of [[-81.72, -374.15], [37.03, -412.385], [137.34428, -397.98492]]) {
        const top = spreebogenWalkSurfaceAt(x, z, Infinity, true, mobileLike)!;
        expect(ray(mesh, x, z)).toBeCloseTo(top, 5);
        expect(spreebogenWalkSurfaceAt(x, z, top - 2, true, mobileLike)).not.toBe(top);
      }
      // The full profile's 2.8m grid previously lost whole rows/columns when
      // rounded half-cell keys collided. Probe actual turf, away from decks.
      if (!mobileLike) for (const row of [-108, -121]) for (let column = -10; column <= 54; column++) {
        const x = (column + 0.5) * 2.8, z = (row + 0.5) * 2.8;
        expect(ray(mesh, x, z)).not.toBeNull();
      }
    }
  });
});
