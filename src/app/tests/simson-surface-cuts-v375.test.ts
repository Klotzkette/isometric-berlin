import { expect, test } from "bun:test";
import { gzipSync } from "node:zlib";
import { BufferAttribute, BufferGeometry, Mesh } from "three";
import { applySimsonCutsV375, cutSimsonGeometryV375 } from "../src/simsonSurfaceCutsV375";
import { createRestoredRoadBatch, type RestoredRoadBatch } from "../src/restoredRoadSurfaces";
import cuts from "../src/data/simsonCutsV375.json";

const encode = (values: number[]) => gzipSync(new Uint8Array(new Int32Array(values).buffer)).toString("base64");
const fragments = encode([0, 0, 0, 50, 50, 0]); // reverse winding, half-height/half-width
const fixture = (indexed: boolean) => {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array([0,1,0, 1,3,0, 0,5,1, 3,7,2, 4,7,2, 3,7,3]), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array([0,0, 1,0, 0,1, 0,0, 1,0, 0,1]), 2));
  g.setAttribute("color", new BufferAttribute(new Uint8Array([0,0,0, 200,0,0, 0,100,0, 0,0,0, 0,0,0, 0,0,0]), 3, true));
  if (indexed) g.setIndex([0,1,2,3,4,5]);
  g.addGroup(0, 3, 0);
  g.addGroup(3, 3, 1);
  g.setDrawRange(0, 6);
  g.computeBoundingSphere();
  return g;
};

for (const indexed of [false, true]) {
  test(`exact local complement preserves attributes, winding and other faces (indexed=${indexed})`, () => {
    const source = fixture(indexed);
    const sibling = new Mesh(source);
    const result = cutSimsonGeometryV375(source, {records: encode([0,0,1,2,1]), fragments});
    expect(result).not.toBe(source);
    expect(sibling.geometry.getAttribute("position").count).toBe(6);
    expect(Array.from(result.index!.array)).toEqual([6,8,7,3,4,5]);
    const p = result.getAttribute("position"), uv = result.getAttribute("uv"), color = result.getAttribute("color");
    expect([p.getX(7),p.getY(7),p.getZ(7)]).toEqual([0,3,.5]);
    expect([p.getX(8),p.getY(8),p.getZ(8)]).toEqual([.5,2,0]);
    expect([uv.getX(8), uv.getY(7)]).toEqual([.5,.5]);
    expect(color.getY(7)).toBeCloseTo(50/255, 7);
    expect(color.getX(8)).toBeCloseTo(100/255, 7);
    expect(result.groups).toEqual(source.groups);
    expect(result.boundingSphere).not.toBe(source.boundingSphere);

    const removed = cutSimsonGeometryV375(source, {records: encode([0,0,1,2,0]), fragments: encode([])});
    expect(Array.from(removed.index!.array)).toEqual([3,4,5]);
    expect(removed.getAttribute("position")).toBe(source.getAttribute("position"));
    expect(removed.groups.map(g => [g.start,g.count])).toEqual([[0,0],[0,3]]);
    expect(removed.drawRange).toEqual({start:0, count:3});
    for (const records of [[0,0,1,2,1, 1,2,4,5,0], [3,0,1,2,1], [0,0,1,2,2]]) {
      expect(cutSimsonGeometryV375(source,{records:encode(records), fragments})).toBe(source);
    }
  });
}

test("released paving faces admit their original shared geometry exactly once", async () => {
  const id = "restored-paving-0-0";
  const text = await Bun.file(new URL("../src/data/restoredRoadSurfaces.ndjson.txt", import.meta.url)).text();
  const line = text.split("\n").find(s => s.includes('"id":"'+id+'"'));
  const batch = JSON.parse(line!) as RestoredRoadBatch;
  const root = createRestoredRoadBatch(batch, (_x, _z) => 0);
  const tile = root.getObjectByName("smooth paved paths") as Mesh;
  const original = tile.geometry;
  // The runtime creator can already apply the update at its production hook.
  if (!original.userData.simsonCutsV375) {
    const shared = new Mesh(original);
    root.add(shared);
    applySimsonCutsV375(root, "unknown-batch");
    expect(tile.geometry).toBe(original);
    applySimsonCutsV375(root, id);
    expect(tile.geometry).not.toBe(original);
    expect(shared.geometry).toBe(original);
  }
  expect(Object.keys(cuts[id])).toContain(tile.name);
  const revised = tile.geometry;
  expect(revised.userData.simsonCutsV375).toBe(true);
  applySimsonCutsV375(root, id);
  expect(tile.geometry).toBe(revised);
});
