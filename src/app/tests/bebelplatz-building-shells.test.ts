import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import source from "../src/bebelplatzBuildingSource.json";
import { createBebelplatzBuildingShells, createMinecraftBebelplatzBuildingShells } from "../src/BebelplatzBuildingShells";
import { BEBELPLATZ_BUILDING_PRISM_IDS, BEBELPLATZ_CIVIC_SOURCES, bebelplatzPartContains, bebelplatzPartRoofAt,
  bebelplatzSourceForPrism, isBebelplatzBuildingReplacementColumn } from "../src/bebelplatzBuildingProfile";
import { compilePedestrianObstacles, pedestrianPointIsBlocked } from "../src/pedestrianNavigation";
import type { PrismPayload } from "../src/IsometricCityWorld";

describe("Bebelplatz/Humboldt complete official building envelopes", () => {
  test("walking obstacles use metre-scale replacement plans at their real locations", async () => {
    const payload = await Bun.file(new URL("../public/mesh/regierungsviertel/lod2-prisms.json", import.meta.url)).json() as PrismPayload;
    const obstacles = compilePedestrianObstacles({ ...payload,
      buildings: payload.buildings.filter(({id}) => BEBELPLATZ_BUILDING_PRISM_IDS.has(id)) });
    for (const [x,z] of [[1505,120],[1465,305],[1527,380],[1588,381]]) {
      expect(pedestrianPointIsBlocked(x,z,20,obstacles)).toBeTrue();
      expect(pedestrianPointIsBlocked(x/10,z/10,20,obstacles)).toBeFalse();
    }
    for (const [x,z] of [[1506,93],[1505,165],[1519,300]])
      expect(pedestrianPointIsBlocked(x,z,5.2,obstacles)).toBeFalse();
  });
  test("replaces exact source identities while keeping forecourt and neighbours open", () => {
    expect(bebelplatzSourceForPrism("ion-6647")?.parent_id).toBe("DEBE01YYK0000Cm9");
    expect(bebelplatzSourceForPrism("29982783")?.parent_id).toBe("DEBE01YYK00002GD");
    expect(bebelplatzSourceForPrism("75618619")).toBeUndefined();
    for (const [x, z] of [[1505, 120], [1462, 301], [1527, 380], [1580, 380]])
      expect(isBebelplatzBuildingReplacementColumn(x, z)).toBeTrue();
    for (const [x, z] of [[1505, 165], [1519, 300], [1598, 437], [1415, 400], [1506, 93]])
      expect(isBebelplatzBuildingReplacementColumn(x, z)).toBeFalse();
  });

  test("retains source heights and finite normals in three texture-free static batches", () => {
    const root = createBebelplatzBuildingShells();
    root.updateMatrixWorld(true);
    expect(root.children).toHaveLength(3);
    let bytes = 0;
    const expectedTops = [25.018, 27.148, 34.166];
    root.children.forEach((child, i) => {
      expect(child).toBeInstanceOf(Mesh);
      const mesh = child as Mesh;
      expect(mesh.matrixAutoUpdate).toBeFalse();
      expect(new Box3().setFromObject(mesh).max.y).toBeCloseTo(expectedTops[i], 3);
      expect(mesh.userData.dayMaterial.map).toBeNull();
      expect(mesh.userData.nightMaterial.map).toBeNull();
      for (const attribute of Object.values(mesh.geometry.attributes)) {
        expect(Array.from(attribute.array).every(Number.isFinite)).toBeTrue();
        bytes += attribute.array.byteLength;
      }
    });
    expect(bytes).toBeLessThan(160_000);
  });

  test("source roof lookup agrees with rendered slopes, and never roofs over the HU entrance court", () => {
    const root = createBebelplatzBuildingShells();
    root.updateMatrixWorld(true);
    const ray = new Raycaster();
    const samples = [[1450, 80], [1505, 120], [1560, 155], [1465, 305], [1480, 339], [1527, 380], [1530, 440]];
    for (const [x, z] of samples) {
      const tops = BEBELPLATZ_CIVIC_SOURCES.flatMap((profile) => profile.parts)
        .map((part) => bebelplatzPartRoofAt(part, x, z)).filter((top) => top !== null);
      expect(tops.length).toBeGreaterThan(0);
      ray.set(new Vector3(x, 100, z), new Vector3(0, -1, 0));
      const hits = ray.intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].point.y).toBeCloseTo(Math.max(...tops), 3);
    }
    expect(bebelplatzPartContains(source.profiles.humboldt.parts[0], 1505, 165)).toBeFalse();
    ray.set(new Vector3(1505, 100, 165), new Vector3(0, -1, 0));
    expect(ray.intersectObject(root, true)).toHaveLength(0);
  });

  test("Minecraft shares one block batch, keeps source roof shape and has no interior column fill", () => {
    const root = createMinecraftBebelplatzBuildingShells();
    root.updateMatrixWorld(true);
    expect(root.children).toHaveLength(1);
    const mesh = root.children[0] as InstancedMesh;
    expect(mesh).toBeInstanceOf(InstancedMesh);
    expect(mesh.count).toBeGreaterThan(3000);
    expect(mesh.count).toBeLessThan(12_000);
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(900_000);
    expect(root.userData.hiddenSolidInfill).toBeFalse();
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    const matrix = new Matrix4();
    let innerRoofTiles = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const e = matrix.elements, x = e[12], z = e[14], top = e[13] + e[5] / 2;
      expect(x > 1497 && x < 1512 && z > 144 && z < 180).toBeFalse();
      if (x > 1500 && x < 1510 && z > 116 && z < 124) {
        // Deep inside the main HU wing only the thin pitched roof tile exists.
        expect(e[5]).toBeLessThanOrEqual(0.801);
        expect(top).toBeCloseTo(bebelplatzPartRoofAt(source.profiles.humboldt.parts[0], x, z)!, 3);
        innerRoofTiles++;
      }
    }
    expect(innerRoofTiles).toBeGreaterThan(3);
  });
});
