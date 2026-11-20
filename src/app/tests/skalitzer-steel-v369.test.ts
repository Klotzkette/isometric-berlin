import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Raycaster, Vector3 } from "three";
import { createSkalitzerSteelV369 } from "../src/SkalitzerSteelV369";
import { SKALITZER_PILOT_V369, skalitzerSectionV369 } from "../src/skalitzerStructureV369";
import { southFidelityGeometryV294, southFidelitySolidsV294 } from "../src/SouthFidelityV294";
import data from "../src/data/southFidelityV294.json";

const tiles = ["6_4", "7_4", "8_4", "9_4"];

test("four distinct tile owners and one bounded batch per tile, with independent cardinal Native members", () => {
  for (const native of [false, true]) {
    let crossSections = 0, feet = 0;
    const matrix = new Matrix4();
    for (const tile of tiles) {
      const root = createSkalitzerSteelV369(tile, native)!;
      expect(root.children).toHaveLength(1);
      const mesh = root.children[0] as InstancedMesh;
      expect(mesh.count).toBeLessThan(1750);
      expect(mesh.boundingBox!.min.z).toBeGreaterThan(2048);
      expect(mesh.boundingBox!.max.z).toBeLessThan(2560);
      crossSections += root.userData.roles["floor-beam-web"];
      expect(root.userData.roles["floor-beam-flange"]).toBe(root.userData.roles["floor-beam-web"]);
      feet += root.userData.roles["column-foot"] || 0;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        expect(matrix.elements.every(Number.isFinite)).toBe(true);
        if (native) expect([1, 2, 4, 6, 8, 9].every(j => matrix.elements[j] === 0)).toBe(true);
      }
    }
    expect(crossSections).toBe(372);
    expect(feet).toBe(36);
    expect(createSkalitzerSteelV369("ring182-6_4", native)).toBeNull();
    expect(createSkalitzerSteelV369("6_5", native)).toBeNull();
  }
});

test("18 m and 12 m paired bays bound the open Radbahn and Mariannenstraße crossing", () => {
  const { west, east } = SKALITZER_PILOT_V369;
  for (const native of [false, true]) {
    const model = southFidelityGeometryV294(native);
    const piers = model.rows.filter(r => r.role === "u1-slender-median-pier" && r.p[0] > west - .25 && r.p[0] < east);
    expect(piers).toHaveLength(36);
    expect(piers.filter(r => r.p[0] > 3395 && r.p[0] < 3410)).toHaveLength(0);
    const firstPair = piers.filter(r => Math.abs(r.p[0] - 3372.6) < .25);
    const easternPair = piers.filter(r => Math.abs(r.p[0] - 3435.2) < .25);
    expect(firstPair).toHaveLength(2);
    expect(easternPair).toHaveLength(2);
    expect(Math.abs(firstPair[0].p[2] - firstPair[1].p[2])).toBeCloseTo(5.5, 1);
    expect(Math.abs(easternPair[0].p[2] - easternPair[1].p[2])).toBeCloseTo(4.18, 1);
    expect(model.rows.some(r => r.role === "u1-lattice-cross-brace" && r.p[0] > west + 1 && r.p[0] < east - 1)).toBe(false);
    const nav = southFidelitySolidsV294(native).filter(r => r.sourceId.endsWith("u1-slender-median-pier"));
    for (const pier of piers) {
      const solid = nav.find(row => Math.abs(row.ring[0][0] + .215 - pier.p[0]) < .001 && Math.abs(row.ring[0][1] + .215 - pier.p[2]) < .001);
      expect(solid?.maxY).toBe(8);
    }
  }
});

test("the underside intercepts overhead rays with 3.1 m cycle headroom and an open station hall", () => {
  for (const native of [false, true]) {
    const root = createSkalitzerSteelV369("6_4", native)!;
    root.updateMatrixWorld(true);
    const x = SKALITZER_PILOT_V369.west + 37 * 2.4;
    const section = skalitzerSectionV369(data.tracks, x)!;
    const up = new Raycaster(new Vector3(x, 3.05, section.z + .5), new Vector3(0, 1, 0), 0, 5.8);
    expect(up.intersectObjects(root.children)[0]?.point.y).toBeCloseTo(8.1825, 2);
    const ride = new Raycaster(new Vector3(3431, 6.1, 2277.16), new Vector3(1, 0, .006).normalize(), 0, 156);
    const nextTile = createSkalitzerSteelV369("7_4", native)!;
    nextTile.updateMatrixWorld(true);
    expect(ride.intersectObjects([...root.children, ...nextTile.children])).toHaveLength(0);
    const hall = new Raycaster(new Vector3(3790, 3.1, 2269.3), new Vector3(0, 1, 0), 0, 20);
    expect(hall.intersectObjects(nextTile.children)).toHaveLength(0);
  }
});
