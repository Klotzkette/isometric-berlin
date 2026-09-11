import { describe, expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createGorkiBuilding } from "../src/GorkiBuilding";
import { bebelplatzPartRoofAt } from "../src/bebelplatzBuildingProfile";
import { GORKI_BUILDING_PROFILE as P, GORKI_BUILDING_SOURCE as source,
  isGorkiBuildingReplacementColumn, gorkiDisplayParts, gorkiPartRoofAt } from "../src/gorkiBuildingProfile";

describe("Maxim Gorki Theater recognition model", () => {
  test("replaces only the old theatre envelope with all three official parts", () => {
    expect(source.parts.length).toBe(3);
    expect(source.replaced_osm_prism_ids).toEqual(["31835798"]);
    expect(source.parts.reduce((n, p) => n + p.surfaces.length, 0)).toBe(64);
    expect(isGorkiBuildingReplacementColumn(1604, 20)).toBeTrue();
    expect(isGorkiBuildingReplacementColumn(1640, 35)).toBeFalse();
    expect(P.largeHallWindows).toContain("bricked-up");
    expect(P.entranceCount).toBe(3);
  });
  test("the hall has a gabled roof below a distinct stage tower without mutating the source", () => {
    const original = JSON.stringify(source), parts = gorkiDisplayParts();
    const main = parts[1];
    const front = bebelplatzPartRoofAt(main, 1605, 35)!;
    const tower = bebelplatzPartRoofAt(main, 1602, 3)!;
    expect(front).toBeGreaterThan(22);
    expect(gorkiPartRoofAt(source.parts[1], 1605, 35)).toBe(front);
    expect(gorkiPartRoofAt(source.parts[1], 1602, 3)).toBe(tower);
    expect(gorkiPartRoofAt(source.parts[1], 1640, 30)).toBeNull();
    expect(gorkiDisplayParts()).toBe(parts);
    expect(front).toBeLessThan(23.56);
    expect(tower).toBeCloseTo(P.sourceStageTopY, 3);
    expect(parts.map((p) => p.ring)).toEqual(source.parts.map((p) => p.ring));
    expect(JSON.stringify(source)).toBe(original);
  });
  test("all three portals are outside the retained source wall and directly visible", () => {
    const root = createGorkiBuilding(); root.updateMatrixWorld(true);
    const [a, b] = P.frontAxis, dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz);
    const nx = -dz / l, nz = dx / l;
    for (const f of [0.2, 0.5, 0.8]) {
      const ray = new Raycaster(new Vector3(a[0] + dx * f + nx * 8, 8, a[1] + dz * f + nz * 8), new Vector3(-nx, 0, -nz));
      const hit = ray.intersectObject(root, true)[0];
      expect(hit.object.name).toContain("Gorki three portals");
      expect(hit.distance).toBeLessThan(7.9);
    }
  });
  for (const minecraft of [false, true]) test(`bounded, finite, texture-free source model (${minecraft})`, () => {
    const root = createGorkiBuilding(minecraft);
    let bytes = 0, instances = 0;
    root.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      expect(o.matrixAutoUpdate).toBeFalse();
      expect(o.userData.dayMaterial.map).toBeNull();
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      bytes += o.geometry.index?.array.byteLength ?? 0;
      if (o instanceof InstancedMesh) {
        instances += o.count; bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
        expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
        if (minecraft) expect(o.geometry.attributes.position.count).toBe(24);
      }
    });
    console.log({ minecraft, draws: root.children.length, instances, bytes });
    expect(root.children.length).toBe(minecraft ? 1 : 2);
    expect(bytes).toBeLessThan(160000);
    expect(instances).toBeLessThan(1700);
    const bounds = new Box3().setFromObject(root);
    expect(bounds.max.y).toBeLessThan(26.8);
    expect(bounds.min.x).toBeGreaterThan(1589);
    expect(bounds.max.x).toBeLessThan(1619);
    expect(bounds.max.z).toBeLessThan(48);
  });
});
