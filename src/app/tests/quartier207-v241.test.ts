import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { Group, Mesh } from "three";
import previous from "../src/data/quartier207V241Previous.json";
import source from "../src/data/quartier207V241.json";
import { transferQuartier207TrianglesV241 } from "../src/quartier207V241Ownership";
import { addQuartier207V241 } from "../src/Quartier207V241";
import { disposeSurroundingCityRoot } from "../src/SurroundingCity";
import type { SurroundingCityChunk, SurroundingPackedMesh } from "../src/SurroundingCityGeometry";

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

test("only audited Q207 generic panes retire; all other indices and encoded source stay identical", () => {
  for (const r of previous.records) {
    const part = packets.get(r.tile)!.meshes.find(p => p.kind === r.kind)!;
    const encoded = JSON.stringify(part), original = indices(part), changed = original.slice();
    expect(finish(transferQuartier207TrianglesV241(true, r.tile, false, part, changed, 0))).toBe(r.triangles.length);
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
      expect(finish(transferQuartier207TrianglesV241(enabled, tile, native, candidate, changed, 0))).toBe(0);
      expect(changed).toEqual(original);
    }
  }
});

test("required glass model is one bounded mesh in both modes and cancels before publication", () => {
  for (const native of [false, true]) {
    const cancelled = new Group(), steps = addQuartier207V241(cancelled, native);
    expect(steps.next().done).toBe(false); steps.return();
    expect(cancelled.children.length).toBe(0);
    const root = new Group(); finish(addQuartier207V241(root, native));
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
