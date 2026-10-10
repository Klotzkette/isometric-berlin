import { expect, test } from "bun:test";
import { Group, InstancedMesh, LineSegments, Mesh } from "three";
import { createWestCivicEnvelopesV210, createWestCivicV210 } from "../src/WestCivicV210";
import { createCityRecognitionV182 } from "../src/CityRecognitionV182";
import { keepCivicBoxV182V210, keepCivicSegmentV182V210, restoreWestCivicPreviousForTestV210 } from "../src/westCivicPreviousV210";
import { westCivicSolidAtV210 } from "../src/westCivicNavigationV210";
import data from "../src/data/westCivicV210.json";
import receipt from "../src/data/westCivicV210Previous.json";
import navigation from "../src/data/westCivicV210Navigation.json";

function dispose(root: Group) {
  root.traverse(o => {
    if (!(o instanceof Mesh || o instanceof LineSegments)) return;
    o.geometry.dispose();
    const materials = new Set([...(Array.isArray(o.material) ? o.material : [o.material]), o.userData.dayMaterial, o.userData.nightMaterial]);
    for (const material of materials) material?.dispose();
    if (o instanceof InstancedMesh) o.dispose();
  });
}
for (const native of [false, true]) test(`west v210 ${native ? "native" : "drawn"}: disjoint required solids and optional facades`, () => {
  const roots = [createWestCivicEnvelopesV210(native), createWestCivicV210(native)];
  let count = 0, bytes = 0, surfaces = 0;
  try {
    expect(roots.map(r => r.children.length)).toEqual([2, 3]);
    expect(new Set(roots.flatMap(r => r.children.map(c => c.name))).size).toBe(5);
    for (const [i, root] of roots.entries()) {
      expect(root.userData.requiredBeforeNavigation).toBe(i === 0);
      expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
      root.traverse(o => {
        expect(o.matrixAutoUpdate).toBeFalse();
        if (!(o instanceof Mesh)) return;
        expect(o.frustumCulled).toBeTrue();
        expect(o.userData.dayMaterial.map).toBeNull();
        expect(o.geometry.getAttribute("uv")).toBeUndefined();
        for (const a of Object.values(o.geometry.attributes)) {
          expect(Array.from(a.array).every(Number.isFinite)).toBeTrue();
          bytes += a.array.byteLength;
        }
        if (o instanceof InstancedMesh) {
          count += o.count;
          bytes += o.instanceMatrix.array.byteLength + o.instanceColor!.array.byteLength;
          expect(Array.from(o.instanceMatrix.array).every(Number.isFinite)).toBeTrue();
          if (native) for (let j = 0; j < o.count; j++) for (const k of [1, 2, 4, 6, 8, 9]) expect(o.instanceMatrix.array[j * 16 + k]).toBe(0);
        } else surfaces++;
      });
    }
    expect(count).toBe(data.groups.reduce((n, g) => n + (native ? g.native : g.boxes).length, 0));
    expect(surfaces).toBe(native ? 1 : 2);
    expect(bytes).toBeLessThan(1_600_000);
  } finally { roots.forEach(dispose); }
});
for (const native of [false, true]) test(`west v210 surgical reverse reproduces legacy ${native} and retains unrelated mutation`, () => {
  const current = createCityRecognitionV182(native, false), original = createCityRecognitionV182(native, true);
  try {
    const lines = current.children[0] as LineSegments, boxes = current.children[1] as InstancedMesh;
    const originalLines = original.children[0] as LineSegments, originalBoxes = original.children[1] as InstancedMesh;
    const originalPosition = lines.geometry.getAttribute("position"), originalMatrix = boxes.instanceMatrix;
    const cleanup = restoreWestCivicPreviousForTestV210(current, native);
    expect(lines.geometry.getAttribute("position").array).toEqual(originalLines.geometry.getAttribute("position").array);
    expect(lines.geometry.getAttribute("color").array).toEqual(originalLines.geometry.getAttribute("color").array);
    expect(boxes.instanceMatrix.array).toEqual(originalBoxes.instanceMatrix.array);
    expect(boxes.instanceColor!.array).toEqual(originalBoxes.instanceColor!.array);
    cleanup();
    expect(lines.geometry.getAttribute("position")).toBe(originalPosition);
    expect(boxes.instanceMatrix).toBe(originalMatrix);
    const value = originalPosition.getX(0);
    originalPosition.setX(0, value + .5);
    const cleanup2 = restoreWestCivicPreviousForTestV210(current, native);
    expect(lines.geometry.getAttribute("position").getX(0)).toBeCloseTo(value + .5, 4);
    expect(() => restoreWestCivicPreviousForTestV210(current, native)).toThrow();
    cleanup2();
  } finally { dispose(current); dispose(original); }
});
test("exact old-row guards fail open, and old owner records are not removed", () => {
  for (const [rows, keep] of [[receipt.boxes, keepCivicBoxV182V210], [receipt.segments, keepCivicSegmentV182V210]] as const) {
    for (const r of rows) {
      expect(keep(r.row, r.index)).toBeFalse();
      expect(keep([r.row[0] + .01, ...r.row.slice(1)], r.index)).toBeTrue();
      expect(keep(r.row, -1)).toBeTrue();
    }
  }
  expect(receipt.ownerTransfers).toEqual([]);
});
test("seven-tier artwork navigation follows tapered geometry and leaves the surrounding plaza open", () => {
  const tier = navigation.volumes.find(v => v.id.startsWith("blue-obelisk blue glass cuboid"))!;
  const [x, z] = [(tier.ring[0][0] + tier.ring[2][0]) / 2, (tier.ring[0][1] + tier.ring[2][1]) / 2];
  expect(westCivicSolidAtV210(x, (tier.lowY + tier.highY) / 2, z)).toBeTrue();
  expect(westCivicSolidAtV210(x + 1.7, 16, z)).toBeFalse();
  expect(westCivicSolidAtV210(x + 5, 5, z)).toBeFalse();
  expect(westCivicSolidAtV210(NaN, 5, z)).toBeFalse();
  expect(navigation.volumes.filter(v => v.id.startsWith("blue-obelisk blue glass cuboid")).length).toBe(7);
});
