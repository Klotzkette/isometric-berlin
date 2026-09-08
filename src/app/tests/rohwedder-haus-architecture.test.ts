import { describe, expect, test } from "bun:test";
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createRohwedderHausArchitecture, createMinecraftRohwedderHausArchitecture, type RohwedderBlock } from "../src/RohwedderHausArchitecture";
import { ROHWEDDER_HAUS_IDS, ROHWEDDER_HAUS_SOURCE as source, rohwedderPrismContains, rohwedderHausColumnTopAt, rohwedderHausFenceSolidAt } from "../src/rohwedderHausProfile";
import { createIsometricCity, fitRectangle, roofRise, type PrismPayload } from "../src/IsometricCityWorld";
import prismJson from "../public/mesh/regierungsviertel/lod2-prisms.json";
import voxelJson from "../public/mesh/regierungsviertel/minecraft-voxels.json";

const prisms = prismJson as unknown as PrismPayload;
const voxels = voxelJson as unknown as Parameters<typeof createMinecraftRohwedderHausArchitecture>[1] extends infer O ? NonNullable<O> extends { voxels?: infer V } ? NonNullable<V> : never : never;
const subset = { ...prisms, buildings: prisms.buildings.filter(p => ROHWEDDER_HAUS_IDS.has(p.id)) };
function blocks(g: Group): RohwedderBlock[] { return g.userData.blocks; }
function columns(): InstancedMesh {
  const records: number[][] = [];
  voxels.building_rows!.forEach((row, zi) => {
    const z = (voxels.grid.min_z_idx + zi + .5) * voxels.cell_m;
    if (z < 1018 || z > 1301) return;
    for (const [xi, count, lo, hi] of row) for (let n = 0; n < count; n++) {
      const x = (voxels.grid.min_x_idx + xi + n + .5) * voxels.cell_m;
      if (x > 690 && x < 920) records.push([x, z, lo / 10, rohwedderHausColumnTopAt(x, z, hi / 10, voxels.cell_m)]);
    }
  });
  const m = new Matrix4(), mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), records.length);
  records.forEach(([x, z, lo, hi], i) => { m.makeScale(voxels.cell_m, hi - lo, voxels.cell_m).setPosition(x, (lo + hi) / 2, z); mesh.setMatrixAt(i, m); });
  mesh.computeBoundingSphere(); mesh.name = "retained ministry source columns"; return mesh;
}
function stats(root: Group): { calls: number; instances: number; bytes: number } {
  let calls = 0, instances = 0, bytes = 0;
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    calls++; for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
    bytes += o.geometry.index?.array.byteLength ?? 0;
    if (o instanceof InstancedMesh) { instances += o.count; bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0); }
  });
  return { calls, instances, bytes };
}

describe("Detlev-Rohwedder-Haus source-bound 21-part campus", () => {
  test("all 21 source records and the four courtyard complements remain unchanged", () => {
    expect(ROHWEDDER_HAUS_IDS.size).toBe(21);
    for (const p of source.buildings) expect(p).toEqual(prisms.buildings.find(b => b.id === p.id));
    for (const [x, z] of [[815, 1090], [855, 1210], [870, 1265], [825, 1179]]) expect(source.buildings.some(p => rohwedderPrismContains(p, x, z))).toBeFalse();
    expect(ROHWEDDER_HAUS_IDS.has("K0001yJa")).toBeTrue();
    expect(source.sourceGroups.filter(p => p.parent === "DEBE01YYK000052O")).toHaveLength(5);
    expect(source.entranceFence.osm).toBe("way/134681699");
    for (const p of source.occluders) expect(p).toEqual(prisms.buildings.find(b => b.id === p.id));
  });
  test("facade tops follow the actual source roof fitter", () => {
    for (const p of source.buildings) {
      let rise = 0;
      if ([3100, 3200, 3500, 2100].includes(p.roof)) { const rect = fitRectangle(p.ring.map(([x, z]) => [x / 10, z / 10])); if (rect && rect.rectangularity >= .72) rise = roofRise(rect, p.h_dm / 10); }
      expect(source.facadeTops[p.id as keyof typeof source.facadeTops]).toBeCloseTo((p.y0_dm + p.h_dm) / 10 - rise, 6);
    }
  });
  for (const minecraft of [false, true]) for (const mobileLike of [false, true]) test(`${minecraft ? "Minecraft" : "drawn"} ${mobileLike ? "mobile" : "full"} retains complete recognition without textures`, () => {
    const before = JSON.stringify(subset), g = (minecraft ? createMinecraftRohwedderHausArchitecture : createRohwedderHausArchitecture)(prisms, { mobileLike, voxels, diagnostics: true }), b = blocks(g), budget = stats(g);
    expect(budget.calls).toBe(1); expect(budget.bytes).toBeLessThan(minecraft ? 1_350_000 : mobileLike ? 950_000 : 2_350_000);
    expect(budget.instances).toBeGreaterThan(9_000); expect(budget.instances).toBeLessThan(31_000);
    expect(b.filter(p => p.role === "Ehrenhof tall hall glazing")).toHaveLength(9);
    expect(b.filter(p => p.role === "Ehrenhof upper office glazing")).toHaveLength(9);
    expect(b.filter(p => p.role === "Ehrenhof tall hall glazing").every(p => p.sourceId === "K0001yJa")).toBeTrue();
    expect(b.filter(p => p.role === "roof lantern kerb")).toHaveLength(47);
    expect(b.filter(p => p.role === "mapped Ehrenhof screen rail")).toHaveLength(6);
    expect(b.some(p => p.role.includes("current ministry name"))).toBeTrue();
    expect(JSON.stringify(subset)).toBe(before);
    if (minecraft) expect(b.every(p => !p.pitch && !p.roll)).toBeTrue();
    g.traverse(o => { if (!(o instanceof Mesh)) return; expect(o.geometry.getAttribute("uv")).toBeUndefined(); for (const a of Object.values(o.geometry.attributes)) expect(Array.from(a.array).every(Number.isFinite)).toBeTrue(); if (o instanceof InstancedMesh) expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue(); });
  });
  for (const minecraft of [false, true]) test(`${minecraft ? "coarse source cubes" : "exact source walls"} do not bury the actual outward-facing hall and representative glazing`, () => {
    const g = (minecraft ? createMinecraftRohwedderHausArchitecture : createRohwedderHausArchitecture)(prisms, { voxels, diagnostics: true }), root = new Group();
    root.add(minecraft ? columns() : createIsometricCity(subset, null, null, null, { includeContext: false }), g); root.updateMatrixWorld(true);
    const all = blocks(g), wanted = all.map((b, index) => ({ b, index })).filter(({ b }) => ["Ehrenhof tall hall glazing", "Wilhelmstrasse representative glazing", "Leipziger representative window"].includes(b.role));
    expect(wanted.length).toBe(32);
    for (const { b, index } of wanted) {
      const n = new Vector3(b.normal[0], 0, b.normal[1]), tangent = new Vector3(Math.cos(b.yaw), 0, -Math.sin(b.yaw));
      const point = new Vector3(...b.position).addScaledVector(tangent, b.size[0] * .24); point.y += b.size[1] * .21;
      const ray = new Raycaster(point.clone().addScaledVector(n, 4), n.clone().negate(), 0, 4.4), hits = ray.intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0); expect(hits[0].object.parent?.name).toBe(g.name); expect(hits[0].instanceId).toBe(index);
    }
  });
  test("Minecraft roof lanterns survive actual source-column rounding", () => {
    const g = createMinecraftRohwedderHausArchitecture(prisms, { voxels, diagnostics: true }), root = new Group(); root.add(columns(), g); root.updateMatrixWorld(true);
    const all = blocks(g), wanted = all.map((b, index) => ({ b, index })).filter(({ b }) => b.role === "block roof lantern glazing");
    expect(wanted).toHaveLength(47);
    for (const { b, index } of wanted) {
      const point = new Vector3(...b.position).addScaledVector(new Vector3(Math.sin(b.yaw), 0, Math.cos(b.yaw)), 1.1); point.y += 3;
      const hits = new Raycaster(point, new Vector3(0, -1, 0), 0, 4).intersectObject(root, true);
      expect(hits.length).toBeGreaterThan(0); expect(hits[0].object.parent?.name).toBe(g.name); expect(hits[0].instanceId).toBe(index);
    }
    expect(rohwedderHausColumnTopAt(0, 0, 400)).toBe(400);
    expect(rohwedderHausColumnTopAt(805, 1140, 80)).toBe(80);
  });
  test("entrance fence collision follows the mapped line with free external approach", () => {
    const a = source.entranceFence.points[1], b = source.entranceFence.points[2], x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    expect(rohwedderHausFenceSolidAt(x, z, 5)).toBeTrue(); expect(rohwedderHausFenceSolidAt(x + 2, z, 5)).toBeFalse(); expect(rohwedderHausFenceSolidAt(x, z, 10)).toBeFalse();
  });
  test("cold Minecraft uses the same five bounded neighbour occluders as the complete source", () => {
    for (const mobileLike of [false, true]) {
      const cold = createMinecraftRohwedderHausArchitecture(undefined, { voxels, mobileLike });
      const fullSource = createMinecraftRohwedderHausArchitecture(prisms, { voxels, mobileLike });
      expect(cold.userData.detailCounts).toEqual(fullSource.userData.detailCounts);
    }
  });
});
