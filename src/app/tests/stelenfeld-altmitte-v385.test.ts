import { expect, test } from "bun:test";
import { Group, LineSegments, Mesh, Raycaster, Vector3 } from "three";
import { createAltMitteCoreV169FromSource, type AltMitteCoreV169Source } from "../src/AltMitteCoreV169";
import { altMitteV169RoofAt, ALT_MITTE_V169_PARTS } from "../src/altMitteV169Profile";
import { hasOldStelenfeldFloor, isOldStelenfeldFloorPart, STELENFELD_LOD2_PARENT } from "../src/stelenfeldAltMitteNavigationV385";
import plans from "../src/data/stelenfeldAltMitteV385.json";
import type { SurroundingCityChunk } from "../src/SurroundingCityGeometry";
import { retireStelenfeldAltMitteFloor } from "../src/stelenfeldAltMitteV385";

async function packet(n: number, native: boolean) {
  const filename = "packet-" + String(n).padStart(3, "0") + ".json";
  const url = new URL("../src/data/altMitteV169" + (native ? "Native/" : "Drawn/") + filename, import.meta.url);
  const packet = await Bun.file(url).json() as SurroundingCityChunk & { id: string };
  return { id: packet.id, packet };
}
function ground(root: Group, x: number, z: number) {
  root.updateMatrixWorld(true);
  return new Raycaster(new Vector3(x, 30, z), new Vector3(0, -1, 0))
    .intersectObject(root, true).find(hit => hit.object instanceof Mesh)?.point.y;
}

test.each([false, true])("actual resident LoD2 packets release exactly the memorial floor, native=%s", async native => {
  const indices = native ? [17,18,41,45] : [14,15,16,17,30,31,32,33];
  const chunks = await Promise.all(indices.map(n => packet(n, native)));
  const input: AltMitteCoreV169Source = { schemaVersion: 1, sourceParents: [], drawnChunks: chunks, minecraftChunks: chunks };
  const before = createAltMitteCoreV169FromSource(input, native);
  const after = createAltMitteCoreV169FromSource({ ...input, sourceParents: [STELENFELD_LOD2_PARENT] }, native);
  expect(ground(before, 460.25, 552.25)).toBeGreaterThan(5);
  expect(ground(after, 460.25, 552.25)).toBeUndefined();
  let faces = 0, lines = 0;
  const plan = plans as unknown as Record<string, Record<string, [[number, number][], number]>>;
  for (const [n, { id }] of chunks.entries()) {
    const old = before.children[n].children[0] as Mesh | LineSegments;
    const fresh = after.children[n].children[0] as Mesh | LineSegments;
    const ink = old instanceof LineSegments;
    const identity = plan[ink ? "ink" : native ? "native" : "drawn"][id];
    const removed = new Set(identity[0].flatMap(([start, length]) => Array.from({ length }, (_, i) => start + i)));
    const count = after.children[n].userData[ink ? "stelenfeldFloorLinesV385" : "stelenfeldFloorFacesV385"];
    expect(count).toBe(removed.size);
    if (ink) {
      lines += count;
      const a = old.geometry.getAttribute("position"), b = fresh.geometry.getAttribute("position");
      let different = 0;
      for (let i = 0; i < a.count; i++) {
        const j = i % 2 && removed.has(i >> 1) ? i - 1 : i;
        if (b.getX(i) !== a.getX(j) || b.getY(i) !== a.getY(j) || b.getZ(i) !== a.getZ(j)) different++;
      }
      expect(different).toBe(0);
    } else {
      faces += count;
      const a = old.geometry.index!, b = fresh.geometry.index!;
      let different = 0;
      for (let i = 0; i < a.count; i++) {
        const j = removed.has(Math.floor(i / 3)) ? i - i % 3 : i;
        if (a.getX(j) !== b.getX(i)) different++;
      }
      expect(different).toBe(0);
    }
  }
  expect(faces).toBe(native ? 1341 : 67);
  expect(lines).toBe(native ? 0 : Object.values(plan.ink).flatMap(([runs]) => runs).reduce((n, [,len]) => n + len, 0));
  // A newer packet with a different coordinate must keep its complete geometry.
  const oldMesh = before.children[0].children[0] as Mesh;
  const index = oldMesh.geometry.index!, position = oldMesh.geometry.getAttribute("position");
  const first = plan[native ? "native" : "drawn"][chunks[0].id][0][0][0] * 3;
  const vertex = index.getX(first);
  position.setX(vertex, position.getX(vertex) + 1);
  const backup = index.array.slice();
  retireStelenfeldAltMitteFloor(before.children[0] as Group, chunks[0].id, native);
  expect(before.children[0].userData.stelenfeldFloorFacesV385).toBe(0);
  expect(index.array).toEqual(backup);
});

test("the two retired source parts no longer block alleys or act as roofs", () => {
  expect(ALT_MITTE_V169_PARTS.some(isOldStelenfeldFloorPart)).toBe(false);
  expect(ALT_MITTE_V169_PARTS.length).toBeGreaterThan(100);
  for (const native of [false, true]) {
    expect(hasOldStelenfeldFloor(460.25, 552.25, native)).toBe(true);
    expect(altMitteV169RoofAt(460.25, 552.25, native)).toBeNull();
    expect(hasOldStelenfeldFloor(397, 493, native)).toBe(false);
  }
});
