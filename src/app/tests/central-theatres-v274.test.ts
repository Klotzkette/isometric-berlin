import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3 } from "three";
import source from "../src/data/centralTheatresV274.json";
import { createCentralTheatresV274 } from "../src/CentralTheatresV274";
import { centralTheatreRowsV274, palastStageV274TopAt, replacePalastStageV274, type PalastStageBoxV274 } from "../src/palastStageV274";
import { createFriedrichstadtPalast, createMinecraftFriedrichstadtPalast, palastFacadePoint, planFriedrichstadtPalast } from "../src/FriedrichstadtPalastDetails";
import { createVolksbuehneEnvelopeV209 } from "../src/VolksbuehneEnvelopeV209";
import { createIsometricCityCore, type PrismPayload } from "../src/IsometricCityWorld";
import prisms from "../public/mesh/regierungsviertel/lod2-prisms.json";

const evidence = JSON.parse(gunzipSync(readFileSync(new URL("../../../geo_data/regierungsviertel/central-theatres-v274-evidence.json.gz", import.meta.url))).toString());
const down = new Vector3(0, -1, 0);
const buckets = ["stone", "glass", "sign"] as const;
function oldPlan(profile: "full" | "mobile", native: boolean) {
  const r = source.palastPrevious[`${profile}:${native}` as keyof typeof source.palastPrevious];
  return Object.fromEntries(buckets.map(k => [k, r[k].map(b => ({ ...b, position: [...b.position], size: [...b.size], rotation: new Quaternion().fromArray(b.rotation) }))])) as Record<typeof buckets[number], PalastStageBoxV274[]>;
}
function nativeColumns(): InstancedMesh {
  const rows = evidence.nativeRoofColumns.columns as number[][];
  const m = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), rows.length), mat = new Matrix4();
  rows.forEach(([x, z, lo, hi], i) => { mat.makeScale(4, hi - lo, 4).setPosition(x, (lo + hi) / 2, z); m.setMatrixAt(i, mat); });
  m.computeBoundingBox(); m.computeBoundingSphere(); m.name = "Retained actual DT and BE roof columns"; return m;
}
function dispose(root: Group) {
  root.traverse(o => { if (!(o instanceof Mesh)) return; o.geometry.dispose();
    for (const material of new Set([o.material, o.userData.dayMaterial, o.userData.nightMaterial].flat())) material?.dispose(); });
}

describe("v274 central theatre roof architecture", () => {
  for (const profile of ["full", "mobile"] as const) for (const native of [false, true]) {
    test(`exact ${profile}/${native} stage transaction preserves every unrelated object`, () => {
      const plan = oldPlan(profile, native);
      const kept = { position: [1, 2, 3], size: [1, 1, 1], rotation: new Quaternion(), color: 0x123456, role: "protected old foyer detail" } as PalastStageBoxV274;
      plan.stone.splice(2, 0, kept); plan.glass.push(kept); plan.sign.push(kept);
      const before = JSON.stringify(plan), next = replacePalastStageV274(plan, profile, native);
      expect(JSON.stringify(plan)).toBe(before); expect(next.stone.includes(kept)).toBeTrue();
      expect(next.glass[0]).toBe(kept); expect(next.sign).toBe(plan.sign);
      expect(next.stone.filter(b => b.role.startsWith("v274 stage"))).toHaveLength(source.counts[native ? "native" : "drawn"].palast);
      expect(next.stone.some(b => b.role.startsWith("stage-"))).toBeFalse();
      expect(() => replacePalastStageV274(next, profile, native)).toThrow("receipt mismatch");
    });
  }
  test("changed geometry, material, rotation, missing or extra old stage record fails before mutation", () => {
    for (const edit of [
      (p: ReturnType<typeof oldPlan>) => { p.stone[0].position = [1, 2, 3]; },
      (p: ReturnType<typeof oldPlan>) => { p.stone[0].color = 0xff0000; },
      (p: ReturnType<typeof oldPlan>) => { p.stone[0].rotation.set(0, 0, 0, 1); },
      (p: ReturnType<typeof oldPlan>) => { p.glass.pop(); },
      (p: ReturnType<typeof oldPlan>) => { p.stone.push({ ...p.stone[0], role: "stage-unreceipted-detail" }); },
    ]) { const p = oldPlan("full", false); edit(p); const before = JSON.stringify(p);
      expect(() => replacePalastStageV274(p, "full", false)).toThrow("receipt mismatch"); expect(JSON.stringify(p)).toBe(before); }
  });
  test("both factories retain full static mobile detail with finite final-sized untextured buffers", () => {
    for (const native of [false, true]) {
      const desktop = createCentralTheatresV274(native), mobile = createCentralTheatresV274(native, { mobileLike: true });
      expect(desktop.children).toHaveLength(1); expect(mobile.children).toHaveLength(1);
      const a = desktop.children[0] as InstancedMesh, b = mobile.children[0] as InstancedMesh;
      expect(a.count).toBe(source.counts[native ? "native" : "drawn"].other);
      expect(a.instanceMatrix.array).toEqual(b.instanceMatrix.array); expect(a.instanceColor!.array).toEqual(b.instanceColor!.array);
      expect(a.instanceMatrix.array.byteLength + a.instanceColor!.array.byteLength).toBeLessThan(90_000);
      expect(a.geometry.getAttribute("uv")).toBeUndefined(); expect((a.material as MeshBasicMaterial).map).toBeNull();
      expect(a.userData.nightMaterial.map).toBeNull(); expect(a.matrixAutoUpdate).toBeFalse();
      const matrix = new Matrix4();
      for (let i = 0; i < a.count; i++) {
        a.getMatrixAt(i, matrix); expect(matrix.elements.every(Number.isFinite)).toBeTrue();
        if (native) for (const k of [1, 2, 4, 6, 8, 9]) expect(Math.abs(matrix.elements[k])).toBe(0);
      }
      expect(desktop.userData.fullStaticDetailOnTouch).toBeTrue(); dispose(desktop); dispose(mobile);
    }
  });
  test("DT, BE and Volksbuehne roof monitors are visible above retained real drawn and native roofs", () => {
    const ids = new Set(["5900rDXT", "6lQyofA6", "G9NcorMt"]);
    for (const native of [false, true]) {
      const detail = createCentralTheatresV274(native), root = new Group().add(detail, createVolksbuehneEnvelopeV209(native));
      root.add(native ? nativeColumns() : createIsometricCityCore({ ...prisms, buildings: prisms.buildings.filter(p => ids.has(p.id)) } as PrismPayload, null, null, null, { includeContext: false }));
      root.updateMatrixWorld(true);
      const fields = source.sourceBoxes.other.filter(r => source.roles[r[8]] === "roof monitor glazing");
      expect(fields).toHaveLength(13);
      for (const field of fields) {
        const hit = new Raycaster(new Vector3(field[0], 70, field[2]), down).intersectObject(root, true).find(h => h.object instanceof Mesh);
        expect(hit?.object.parent === detail, `visible monitor at ${field[0]}, ${field[2]}, native=${native}: first ${hit?.object.name} y=${hit?.point.y}`).toBeTrue();
      }
      dispose(root);
    }
  });
  test("independent native Palast roof cells are closed across the high stage rectangle", () => {
    const rows = centralTheatreRowsV274(true, "palast"), mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), rows.length / 8), m = new Matrix4();
    for (let i = 0; i < rows.length; i += 8) { m.makeScale(rows[i+3], rows[i+4], rows[i+5]).setPosition(rows[i], rows[i+1], rows[i+2]); mesh.setMatrixAt(i/8, m); }
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); mesh.updateMatrixWorld(true);
    for (let u = -14; u <= 13; u += 2.3) for (let out = -76; out <= -57; out += 2.1) {
      const [x, , z] = palastFacadePoint(u, 0, out), hit = new Raycaster(new Vector3(x, 70, z), down).intersectObject(mesh)[0];
      expect(hit?.point.y).toBeGreaterThanOrEqual(37.19);
    }
    mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose();
  });
  test("integrated Palast factories and walking use the corrected high and low roof extents", () => {
    for (const native of [false, true]) {
      const plan = planFriedrichstadtPalast("full", native);
      expect(plan.stone.filter(b => b.role.startsWith("v274 stage"))).toHaveLength(source.counts[native ? "native" : "drawn"].palast);
      const root = native ? createMinecraftFriedrichstadtPalast() : createFriedrichstadtPalast(); root.updateMatrixWorld(true);
      for (const [u, out] of [[0,-66.5],[-13,-66],[13,-72],[0,-48]]) {
        const [x, , z] = palastFacadePoint(u, 0, out), hit = new Raycaster(new Vector3(x,70,z),down).intersectObject(root,true)[0];
        if (out === -48) { expect(palastStageV274TopAt(x,z)).toBeNull(); expect(hit.point.y).toBeLessThan(26); }
        else { expect(hit.point.y).toBeGreaterThan(37.19); expect(Math.abs(hit.point.y - palastStageV274TopAt(x,z)!)).toBeLessThan(.18); }
      }
      dispose(root);
    }
    expect(palastStageV274TopAt(NaN, 0)).toBeNull(); expect(palastStageV274TopAt(0, 0)).toBeNull();
  });
});
