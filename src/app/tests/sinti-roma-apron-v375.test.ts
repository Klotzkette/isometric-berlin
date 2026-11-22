import { expect, test } from "bun:test";
import { Color, Mesh, Raycaster, Vector3 } from "three";
import raw from "../public/mesh/regierungsviertel/ground-context.json";
import { createDistrictStreets } from "../src/DistrictStreets";
import { SINTI_ROMA_APRON_V375 } from "../src/SintiRomaApronV375";
import type { VoxelPayload } from "../src/terrainPayload";

test("the first drawn ground publishes real granite, turf joints and mineral entrance outside the old memorial", () => {
  const streets = createDistrictStreets(raw as unknown as VoxelPayload, new Set(), true, true);
  streets.updateMatrixWorld(true);
  const apron = streets.getObjectByName(SINTI_ROMA_APRON_V375) as Mesh;
  expect(apron).toBeInstanceOf(Mesh);
  const aim = (x: number, z: number) =>
    new Raycaster(new Vector3(x, 15, z), new Vector3(0, -1, 0)).intersectObject(apron);
  const samples = [
    [305.103, 176.725, 0xc2c0b4], // northern outer granite
    [297.1, 187.2, 0xb6b5a9], // western stone in the entrance
    [308.06, 196.65, 0x9c9b8f], // mineral substrate southeast of the pool
    [310.65, 196.29, 0xa9c592], // grass at the former pale corner
    [316.78, 178.22, 0xa9c592], // grass between northeastern outer stones
  ];
  for (const [x, z, tone] of samples) {
    const first = aim(x, z)[0];
    expect(first).toBeDefined();
    const color = apron.geometry.getAttribute("color"),
      idx = first.face!.a;
    const expected = new Color(tone);
    expect(color.getX(idx)).toBeCloseTo(expected.r, 2);
    expect(color.getY(idx)).toBeCloseTo(expected.g, 2);
    expect(color.getZ(idx)).toBeCloseTo(expected.b, 2);
    expect(first.point.y).toBeGreaterThan(4.69);
    expect(first.point.y).toBeLessThan(4.95);
  }
  // Every old grass joint and stone inside the 9.55 m ring remains exposed.
  const [cx, , cz] = apron.position.toArray();
  for (let a = 0; a < 360; a += 5) {
    const angle = (a * Math.PI) / 180;
    for (const r of [0, 6.2, 8.5, 9.54])
      expect(aim(cx + r * Math.cos(angle), cz + r * Math.sin(angle))).toHaveLength(0);
  }
  expect(aim(320.4, 185)).toHaveLength(0);
  expect(apron.geometry.getIndex()!.count / 3).toBeLessThan(6000);
});
