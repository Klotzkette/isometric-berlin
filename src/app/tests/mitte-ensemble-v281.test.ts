import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group, Mesh } from "three";
import previous from "../src/data/mitteEnsembleV281Previous.json";
import source from "../src/data/mitteEnsembleV281.json";
import { transferMitteEnsembleTrianglesV281 } from "../src/mitteEnsembleV281Ownership";
import { addMitteEnsembleV281 } from "../src/MitteEnsembleV281";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";
import { refineEnsembleFrontagesV281, verifyEnsembleFrontagesSourceV281 } from "../src/mitteEnsembleV281Plan";
import { planFriedrichstrasseArchitecture, planFriedrichstrasseArchitectureV281Control, type FriedrichstrasseBlock } from "../src/FriedrichstrasseArchitecture";
import originalSource from "../src/friedrichstrasseArchitectureSource.json";

function finish<T>(steps: Generator<void, T>): T {
  let next = steps.next(); while (!next.done) next = steps.next(); return next.value;
}
function indices(part: SurroundingPackedMesh): Uint32Array {
  const bytes = Buffer.from(part.indices, "base64");
  return new Uint32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}
const packets = new Map(previous.records.map(r => [r.tile, JSON.parse(gunzipSync(readFileSync(
  new URL(`../public/mesh/surrounding-berlin-v159/${r.tile}.drawn.json.gz`, import.meta.url),
)).toString()) as SurroundingCityChunk]));

test("complete source receipt fails closed and full control model loses only audited generic grids", () => {
  expect(verifyEnsembleFrontagesSourceV281(originalSource)).toBe(true);
  const changed=structuredClone(originalSource); changed.prisms[0].ring[0][0]+=.1;
  expect(verifyEnsembleFrontagesSourceV281(changed)).toBe(false);
  expect(verifyEnsembleFrontagesSourceV281({})).toBe(false);
  for (const minecraft of [false,true]) for (const mobileLike of [false,true]) {
    const before=planFriedrichstrasseArchitectureV281Control({minecraft,mobileLike});
    const after=planFriedrichstrasseArchitecture({minecraft,mobileLike});
    expect(before.length-after.length).toBe(minecraft?99:145);
    expect(after).toEqual(refineEnsembleFrontagesV281(before));
    expect(after.filter(b=>b.role==="Neues Haus golden screen field")).toHaveLength(9);
    const allOtherOwners=(rows:typeof before)=>rows.filter(b=>!["YCHo1QS2","K0000BQ7"].includes(b.sourceId));
    expect(allOtherOwners(after)).toEqual(allOtherOwners(before));
  }
});

test("planner transfer is restricted to the two exact former grids and preserves all other features", () => {
  const generic: FriedrichstrasseBlock = {sourceId:"K0000BQ7",role:"exposed window glazing",normal:[1,0],position:[1021.9,12,-292.8],size:[1,2,.08],yaw:0,color:0x41545b,glass:true};
  const preserved = [
    {...generic,sourceId:"other-building"}, {...generic,normal:[-1,0] as const},
    {...generic,role:"previous authored sculpture"},
    {...generic,position:[1021.9,12,-312.8] as [number,number,number]},
    {...generic,sourceId:"YCHo1QS2",role:"Neues Haus golden screen field"},
  ];
  const old = [generic,...preserved];
  const before = JSON.stringify(old);
  const result = refineEnsembleFrontagesV281(old);
  expect(result).toEqual(preserved);
  result.forEach((value,i)=>expect(value).toBe(preserved[i]));
  expect(JSON.stringify(old)).toBe(before);
  expect(refineEnsembleFrontagesV281(result)).toEqual(result);
});

test("only audited Ensemble/Splendid generic panes retire; all other indices and encoded source stay identical", () => {
  for (const r of previous.records) {
    const part = packets.get(r.tile)!.meshes.find(p => p.kind === r.kind)!;
    const encoded = JSON.stringify(part), original = indices(part), changed = original.slice();
    expect(finish(transferMitteEnsembleTrianglesV281(true, r.tile, false, part, changed, 0))).toBe(r.triangles.length);
    const selected = new Set(r.triangles);
    for (let i = 0; i < original.length; i += 3) {
      if (selected.has(i / 3)) expect(Array.from(changed.slice(i, i + 3))).toEqual([original[i], original[i], original[i]]);
      else expect(Array.from(changed.slice(i, i + 3))).toEqual(Array.from(original.slice(i, i + 3)));
    }
    expect(JSON.stringify(part)).toBe(encoded);
  }
});

test("disabled transfer, native source and mismatching packet fingerprints remain intact", () => {
  for (const r of previous.records) {
    const part = packets.get(r.tile)!.meshes.find(p => p.kind === r.kind)!;
    const original = indices(part);
    for (const [enabled, tile, native, candidate] of [
      [false, r.tile, false, part], [true, r.tile, true, part],
      [true, r.tile + "-other", false, part],
      [true, r.tile, false, { ...part, kind: "another-owner" }],
      ...(["positions", "colors", "indices"] as const).map(key => {
        const b = Buffer.from(part[key], "base64"); b[b.length - 1] ^= 1;
        return [true, r.tile, false, { ...part, [key]: b.toString("base64") }] as const;
      }),
    ] as const) {
      const changed = original.slice();
      expect(finish(transferMitteEnsembleTrianglesV281(enabled, tile, native, candidate, changed, 0))).toBe(0);
      expect(changed).toEqual(original);
    }
  }
});

test("required facade model is one bounded mesh in both modes and cancels before publication", () => {
  for (const native of [false, true]) {
    const cancelled = new Group(), steps = addMitteEnsembleV281(cancelled, native);
    expect(steps.next().done).toBe(false); steps.return();
    expect(cancelled.children.length).toBe(0);
    const root = new Group(); finish(addMitteEnsembleV281(root, native));
    expect(root.children.length).toBe(1);
    const child = root.children[0];
    expect(child.userData.fullMobileIdentical).toBe(true);
    expect(child.userData.nativeMinecraft).toBe(native);
    expect(child.userData.facadeOnly).toBe(true);
    const meshes: Mesh[] = []; child.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
    expect(meshes.length).toBe(1);
    const expected = source[native ? "minecraft" : "drawn"].meshes[0];
    expect(meshes[0].geometry.index!.count).toBe(Buffer.from(expected.indices, "base64").length / 4);
    disposeSurroundingCityRoot(root);
  }
});
