import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group, InstancedMesh, Mesh } from "three";
import { preparePotsdamerCorridorV288, POTSDAMER_CORRIDOR_KIND_V288 } from "../src/PotsdamerCorridorV288";
import { createPotsdamerCorridorCoreV288, hasCompletePotsdamerCorridorCoreV288 } from "../src/PotsdamerCorridorCoreV288";
import { admitsPotsdamerCorridorCoreV288, admitsPotsdamerCorridorNativeV288, isPotsdamerCorridorOldCoreV288, isPotsdamerCorridorOldNativeColumnV288 } from "../src/PotsdamerCorridorV288Ownership";
import { potsdamerCorridorSolidsV288 } from "../src/PotsdamerCorridorV288Navigation";
import { PRIMARY_WALL_SWATCHES_V273, primaryHousePaletteV273 } from "../src/primaryHousePaletteV273";
import plan from "../src/data/potsdamerCorridorV288.json";
import core from "../src/data/potsdamerCorridorCoreV288.json";
import owners from "../src/data/potsdamerCorridorV288Owners.json";
import profile from "../src/data/potsdamerCorridorV288Profile.json";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";

const json = (file: string) => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8"));
const manifest = json("../public/mesh/surrounding-berlin-v159/manifest.json");
function finish<T>(it: Generator<void, T>): T { let n = it.next(); while (!n.done) n = it.next(); return n.value; }
function packet(id: string, native: boolean): SurroundingCityChunk {
  const d = manifest.chunks.find((v: { id: string }) => v.id === id);
  return JSON.parse(gunzipSync(readFileSync(new URL(`../public/mesh/surrounding-berlin-v159/${d[native ? "minecraft" : "drawn"].url}`, import.meta.url))).toString());
}
function windowCount(faces: { a: number[]; b: number[]; high: number; low: number; omitted: number[] }[], native: boolean): number {
  return faces.reduce((n, f) => n + Math.max(1, Math.trunc((f.high - f.low - 1.5) / (native ? 4 : 3.6))) *
    (Math.max(1, Math.trunc((Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) - 1.5) / (native ? 4 : 3.8))) - f.omitted.length), 0);
}

test("101 retained street fronts gain window surrounds while all original glass, geometry and navigation retain identity", () => {
  const totals = [0, 0];
  for (const [id, families] of Object.entries(plan.chunks)) for (const native of [false, true]) {
    const p = (families as { drawn?: { faces: { a: number[]; b: number[]; high: number; low: number; omitted: number[] }[] }; minecraft?: { faces: { a: number[]; b: number[]; high: number; low: number; omitted: number[] }[] } })[native ? "minecraft" : "drawn"];
    if (!p) continue;
    const before = packet(id, native), original = JSON.stringify(before), result = finish(preparePotsdamerCorridorV288(before, id, native));
    expect(result).not.toBe(before); expect(result.nav).toBe(before.nav); expect(result.origin).toBe(before.origin);
    expect(result.meshes.slice(0, before.meshes.length)).toEqual(before.meshes);
    before.meshes.forEach((m, i) => expect(result.meshes[i]).toBe(m));
    expect(JSON.stringify(before)).toBe(original);
    const appended = result.meshes.at(-1)!; expect(appended.kind).toBe(POTSDAMER_CORRIDOR_KIND_V288);
    const windows = windowCount(p.faces, native); totals[native ? 1 : 0] += windows;
    expect(Buffer.from(appended.positions, "base64").length / 6).toBe(windows * 24);
    expect(Buffer.from(appended.indices, "base64").length / 4).toBe(windows * 36);
    expect(finish(preparePotsdamerCorridorV288(result, id, native))).toBe(result);
  }
  expect(totals).toEqual([1800, 249]);
});

test("changed original glass/indices/positions and cancellation publish no partial fitting mesh", () => {
  const id = Object.keys(plan.chunks)[0], p = packet(id, false);
  for (const field of ["positions", "colors", "indices"] as const) {
    const changed = structuredClone(p); changed.meshes[0][field] = "!" + changed.meshes[0][field].slice(1);
    const before = JSON.stringify(changed); expect(finish(preparePotsdamerCorridorV288(changed, id))).toBe(changed); expect(JSON.stringify(changed)).toBe(before);
  }
  const before = JSON.stringify(p), gen = preparePotsdamerCorridorV288(p, id);
  gen.next(); gen.return(p); expect(JSON.stringify(p)).toBe(before);
  expect(finish(preparePotsdamerCorridorV288(p, "unrelated"))).toBe(p);
});

test("complete measured replacement admission binds all old and retained owners without invoking getters", () => {
  const payload = json("../public/mesh/regierungsviertel/lod2-prisms.json");
  expect(admitsPotsdamerCorridorCoreV288(payload)).toBe(true);
  expect(payload.buildings.filter(isPotsdamerCorridorOldCoreV288).map((p: { id: string }) => p.id).sort()).toEqual([...profile.oldCoreIds].sort());
  for (const original of [...owners.oldPrisms, ...owners.retainedPrisms]) {
    const changed = { buildings: [...owners.oldPrisms, ...owners.retainedPrisms].map(p => p.id === original.id ? { ...p, h_dm: p.h_dm + 1 } : p) };
    expect(admitsPotsdamerCorridorCoreV288(changed)).toBe(false);
  }
  let reads = 0;
  const changed = structuredClone(owners.oldPrisms[0]);
  Object.defineProperty(changed, "ring", { get() { reads++; return owners.oldPrisms[0].ring; }, enumerable: true });
  expect(isPotsdamerCorridorOldCoreV288(changed)).toBe(false); expect(reads).toBe(0);
  const duplicate = { buildings: [...owners.oldPrisms, ...owners.retainedPrisms, owners.oldPrisms[0]] };
  expect(admitsPotsdamerCorridorCoreV288(duplicate)).toBe(false);
  const { proxy, revoke } = Proxy.revocable({}, {}); revoke(); expect(admitsPotsdamerCorridorCoreV288(proxy)).toBe(false);
});

test("only exact exclusive native columns yield, with every affected neighbour row guarded", () => {
  const payload = json("../public/mesh/regierungsviertel/minecraft-voxels.json");
  expect(admitsPotsdamerCorridorNativeV288(payload)).toBe(true); expect(profile.nativeColumns.length).toBe(162);
  for (const c of profile.nativeColumns) {
    expect(isPotsdamerCorridorOldNativeColumnV288(c)).toBe(true);
    const changed = [...c]; changed[3]++; expect(isPotsdamerCorridorOldNativeColumnV288(changed)).toBe(false);
  }
  const changed = structuredClone(payload), ri = owners.nativeRows[0].index;
  changed.building_rows[ri][0][3]++;
  expect(admitsPotsdamerCorridorNativeV288(changed)).toBe(false);
  expect(isPotsdamerCorridorOldNativeColumnV288([0, 0, 52, 132, 3])).toBe(false);
});

test("complete factories stay compact, native matrices remain cardinal and added fittings clear their actual native source bodies", () => {
  for (const native of [false, true]) {
    const root = createPotsdamerCorridorCoreV288(native);
    expect(hasCompletePotsdamerCorridorCoreV288(root)).toBe(true); expect(hasCompletePotsdamerCorridorCoreV288(new Group())).toBe(false);
    expect(root.children.length).toBe(native ? 1 : 2);
    const m = root.children.at(-1) as InstancedMesh;
    const expected = profile.owners.reduce((n, p) => n + (native ? p.nativeBody + p.nativeFittings : p.drawnFittings), 0);
    expect(m.count).toBe(expected);
    if (native) for (let i = 0; i < m.count; i++) for (const at of [1, 2, 4, 6, 8, 9]) expect(m.instanceMatrix.array[i * 16 + at]).toBe(0);
    else expect((root.children[0] as Mesh).geometry.getAttribute("position").count).toBe(972);
    expect(m.instanceMatrix.array.byteLength + m.instanceColor!.array.byteLength).toBeLessThan(950_000);
  }
  for (const site of core.sites) for (const row of site.nativeFittings) {
    const [x, y, z, w, h, d] = row as number[];
    for (const block of site.blocks) {
      const overlap = Math.abs(x - block[0]) < (w + block[3]) / 2 - .02 &&
        Math.abs(y - block[1]) < (h + block[4]) / 2 - .02 && Math.abs(z - block[2]) < (d + block[5]) / 2 - .02;
      if (overlap) throw new Error(`Buried native ${site.key} ${row.at(-1)}`);
    }
  }
});

test("walking uses complete measured roof triangles and preserves courtyard apertures", () => {
  const solids = potsdamerCorridorSolidsV288(); expect(solids.length).toBe(12);
  for (const part of profile.navigation) {
    const solid = solids.find(s => s.sourceId === part.id)!;
    expect(solid.ring).toBe(part.ring); expect(solid.holes).toBe(part.holes);
    for (const [a, b, c] of part.roofTriangles) {
      const x = (a[0] + b[0] + c[0]) / 3, z = (a[2] + b[2] + c[2]) / 3, y = (a[1] + b[1] + c[1]) / 3;
      expect(solid.topAt(x, z)).not.toBeNull(); expect(solid.topAt(x, z)!).toBeGreaterThanOrEqual(y - .001);
    }
    expect(solid.topAt(-10000, -10000)).toBeNull();
  }
});

test("unknown fallback paint has stable distinct subdued plaster choices", () => {
  expect(new Set(PRIMARY_WALL_SWATCHES_V273).size).toBe(12);
  for (const rgb of PRIMARY_WALL_SWATCHES_V273) {
    const [r, g, b] = [rgb >>> 16, (rgb >>> 8) & 255, rgb & 255];
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(57);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(40);
  }
  const roofs = new Set<string>(), walls = new Set<string>();
  for (let i = 0; i < 500; i++) {
    const p = primaryHousePaletteV273(`DEBE-v288-${i}`);
    expect(primaryHousePaletteV273(`DEBE-v288-${i}`)).toBe(p); roofs.add(p.roof.join()); walls.add(p.wall.join());
  }
  expect(roofs.size).toBe(8); expect(walls.size).toBe(12);
});
