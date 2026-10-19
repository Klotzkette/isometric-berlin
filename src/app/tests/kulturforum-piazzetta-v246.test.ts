import { expect, test } from "bun:test";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createKulturforumMuseums, createMinecraftKulturforumMuseums, type KulturforumMuseumBlock } from "../src/KulturforumMuseums";
import { KULTURFORUM_PIAZZETTA_V246 as data, kulturforumPiazzettaFloorAt, kulturforumPiazzettaReplacementColumn } from "../src/kulturforumPiazzettaV246Profile";
import { compilePedestrianObstacles } from "../src/pedestrianNavigation";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";

for (const native of [false, true]) test(`Piazzetta ${native ? "native" : "drawn"} walking heights follow actual visible tops`, () => {
  const root = (native ? createMinecraftKulturforumMuseums : createKulturforumMuseums)({ diagnostics: true });
  root.updateMatrixWorld(true);
  const points = native ? data.native.map(([x, z, w, d]) => [x + w / 2, z + d / 2]) : data.triangles.map(ids => {
    const p = ids.map(id => data.positions[id]);
    return [(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][2] + p[1][2] + p[2][2]) / 3];
  });
  let rays = 0;
  for (let i = 0; i < points.length; i += 3) {
    const [x, z] = points[i], y = kulturforumPiazzettaFloorAt(x, z, native);
    expect(y).not.toBeNull();
    expect(y!).toBeGreaterThan(2.5); expect(y!).toBeLessThan(7);
    // Start just above the paving so an unrelated cafe roof is not selected.
    const hits = new Raycaster(new Vector3(x, y! + .08, z), new Vector3(0, -1, 0), 0, .16).intersectObject(root, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].point.y).toBeCloseTo(y!, 3); rays++;
  }
  expect(rays).toBeGreaterThan(100);
  if (native) for (const b of root.userData.blocks as KulturforumMuseumBlock[]) {
    if (b.role !== "piazzetta native granite terrace") continue;
    expect(b.yaw).toBe(0);
    expect(b.size[0] % 2).toBe(0); expect(b.size[2] % 2).toBe(0);
  }
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    if (o instanceof InstancedMesh) o.dispose();
  });
});

test("only exact prior garage-column receipts are retired", () => {
  expect(data.previousNativeColumns.length).toBeGreaterThan(350);
  for (const [x, z, lo, hi] of data.previousNativeColumns) {
    expect(kulturforumPiazzettaReplacementColumn(x, z, lo, hi)).toBeTrue();
    expect(kulturforumPiazzettaReplacementColumn(x, z, lo, hi + .1)).toBeFalse();
    expect(kulturforumPiazzettaReplacementColumn(x, z, lo + .1, hi)).toBeFalse();
    expect(kulturforumPiazzettaReplacementColumn(x + .5, z, lo, hi)).toBeFalse();
  }
  expect(kulturforumPiazzettaReplacementColumn(-500, 1140, 3.3, 7.3)).toBeFalse();
});

test("public-square footprint is no longer an impassable building; adjacent cafes remain", () => {
  const buildings = prisms.buildings.filter(p => ["26444282", "vQ00019Y", "3yj0001b"].includes(p.id));
  for (const mode of ["day", "minecraft"] as const) {
    const index = compilePedestrianObstacles({ buildings }, () => mode);
    expect(index.buildingCount).toBe(2);
  }
  for (const native of [false, true]) {
    for (const [x, z] of [[-400, 1090], [-250, 1100], [-303, 1011], [-340, 1170]]) expect(kulturforumPiazzettaFloorAt(x, z, native)).toBeNull();
    expect(kulturforumPiazzettaFloorAt(-350, 1110, native)).toBeGreaterThan(kulturforumPiazzettaFloorAt(-290, 1090, native)!);
  }
});
