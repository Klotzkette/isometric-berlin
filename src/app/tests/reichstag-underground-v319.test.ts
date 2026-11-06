import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, ShapeUtils, Vector2, Vector3 } from "three";
import { hbfMergeAdjacentBoxesV291 } from "../src/HbfGeometryOpeningsV291";
import { parliamentRetainedPlanV295 } from "../src/ParliamentRetainedEnvelopeV295";
import { createReichstagUndergroundV319, reichstagUndergroundRevealVolumesV319, REICHSTAG_UNDERGROUND_LAYOUT_V319 as L, setReichstagUndergroundViewV319 } from "../src/ReichstagUndergroundV319";

function dispose(root: Group): void {
  root.traverse(o => { if (o instanceof Mesh) { o.geometry.dispose(); o.userData.dayMaterial?.dispose(); o.userData.nightMaterial?.dispose(); } });
}
function pointInsideVolume(p: number[], v: ReturnType<typeof reichstagUndergroundRevealVolumesV319>[number]): boolean {
  const dx = p[0] - v.center[0], dz = p[2] - v.center[2], c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  return Math.abs(dx * c - dz * s) <= v.size[0] / 2 + .0001 && Math.abs(p[1] - v.center[1]) <= v.size[1] / 2 + .0001 && Math.abs(dx * s + dz * c) <= v.size[2] / 2 + .0001;
}

test("the lazy exhibit has independent complete families, finite final buffers and no normal-world mutation", () => {
  const roots = [createReichstagUndergroundV319(false), createReichstagUndergroundV319(true), createReichstagUndergroundV319(false)];
  const geometries = new Set<BufferGeometry>(), materials = new Set();
  for (let j = 0; j < roots.length; j++) {
    const root = roots[j], native = j === 1;
    let count = 0, bytes = 0, meshes = 0;
    expect(root.userData.archiveBoxes).toBe(5000);
    expect(root.userData.noNavigationChange).toBe(true);
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.sourceCourtyardCount).toBe(6);
    expect(root.matrixAutoUpdate).toBe(false);
    expect(root.children[1].visible).toBe(false);
    root.traverse(o => {
      if (!(o instanceof Mesh)) return;
      meshes++; expect(geometries.has(o.geometry)).toBe(false); geometries.add(o.geometry);
      for (const m of [o.userData.dayMaterial, o.userData.nightMaterial]) { expect(materials.has(m)).toBe(false); materials.add(m); expect(m.map).toBeNull(); }
      expect(o.geometry.getAttribute("uv")).toBeUndefined();
      expect(o.matrixAutoUpdate).toBe(false);
      for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      bytes += o.geometry.index?.array.byteLength ?? 0;
      if (!(o instanceof InstancedMesh)) return;
      count += o.count; expect(o.instanceMatrix.count).toBe(o.count);
      bytes += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      const matrix = new Matrix4();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix); expect(matrix.elements.every(Number.isFinite)).toBe(true);
        if (native) expect([1, 2, 4, 6, 8, 9].every(k => matrix.elements[k] === 0)).toBe(true);
      }
    });
    expect(meshes).toBe(native ? 4 : 7);
    expect(count).toBe(native ? 14996 : 12021);
    expect(bytes).toBe(native ? 1142288 : 932412);
  }
  roots.forEach(dispose);
});

test("private family identity and disposal govern reversible branch visibility", () => {
  const root = createReichstagUndergroundV319(true);
  expect(setReichstagUndergroundViewV319(new Group(), true)).toBe(false);
  expect(setReichstagUndergroundViewV319(root, true)).toBe(true);
  expect(root.children.every(c => c.visible)).toBe(true);
  expect(setReichstagUndergroundViewV319(root, false)).toBe(true);
  expect(root.children[0].visible).toBe(true); expect(root.children[1].visible).toBe(false);
  const routes = root.children[1]; routes.removeFromParent();
  expect(setReichstagUndergroundViewV319(root, true)).toBe(false);
  root.add(routes); dispose(root);
  expect(setReichstagUndergroundViewV319(root, true)).toBe(false);
});

test("every represented corridor member fits the finite reveal union, including Native staircase corners", () => {
  const volumes = reichstagUndergroundRevealVolumesV319();
  expect(volumes.length).toBe(29); expect(reichstagUndergroundRevealVolumesV319(false).length).toBe(1);
  expect(volumes.every(v => v.center.every(Number.isFinite) && v.size.every(s => s > 0))).toBe(true);
  for (const native of [false, true]) {
    const root = createReichstagUndergroundV319(native), routes = root.children[1], matrix = new Matrix4();
    const misses: number[][] = [];
    routes.traverse(o => {
      if (!(o instanceof InstancedMesh)) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
          const p = new Vector3(x, y, z).applyMatrix4(matrix).toArray();
          if (!volumes.some(v => pointInsideVolume(p, v))) misses.push(p);
        }
      }
    });
    expect(misses).toEqual([]); dispose(root);
  }
});

test("both route floors continuously support every authored centreline and keep goods below pedestrians", () => {
  for (const native of [false, true]) {
    const root = createReichstagUndergroundV319(native);
    const mesh = root.children[1].children.find(o => o.name === "Roofless public connection exhibit") as InstancedMesh;
    const matrix = new Matrix4(), inverses: { y: number; inverse: Matrix4 }[] = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      if (Math.abs(matrix.elements[5] - .24) < .00001) inverses.push({ y: matrix.elements[13] + matrix.elements[5] / 2, inverse: matrix.clone().invert() });
    }
    for (const path of L.paths) {
      expect(path.points[0][1]).toBe(path.kind === "goods" ? -8.2 : .25);
      for (let i = 1; i < path.points.length; i++) for (let j = 0; j <= 30; j++) {
        const a = path.points[i - 1], b = path.points[i], t = j / 30;
        const p = new Vector3(a[0] + (b[0] - a[0]) * t, a[1] - .12, a[2] + (b[2] - a[2]) * t);
        const yes = inverses.some(v => Math.abs(v.y - a[1]) < .00001 && p.clone().applyMatrix4(v.inverse).toArray().every(n => Math.abs(n) < .5001));
        expect(yes).toBe(true);
      }
    }
    dispose(root);
  }
});

test("Native batching merges only complete equal-paint touching Float32 faces, never gaps or painted edges", () => {
  const source = readFileSync(new URL("../src/ReichstagUndergroundV319.ts", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("function mergeNativeRows("), source.indexOf("\nfunction volume("));
  const js = new Bun.Transpiler({ loader: "ts" }).transformSync(code + ";globalThis.__merge=mergeNativeRows;");
  const merge = new Function("hbfMergeAdjacentBoxesV291", js + ";return globalThis.__merge;")(hbfMergeAdjacentBoxesV291) as (rows: number[][]) => number[][];
  delete (globalThis as Record<string, unknown>).__merge;
  const rows = [[.5, .5, .5, 1, 1, 1, 10], [1.5, .5, .5, 1, 1, 1, 10], [2.5, .5, .5, 1, 1, 1, 11], [3.5001, .5, .5, 1, 1, 1, 11]];
  const result = merge(rows);
  expect(result.length).toBe(3);
  expect(result.find(r => r[6] === 10)).toEqual([1, .5, .5, 2, 1, 1, 10]);
  expect(result.filter(r => r[6] === 11).length).toBe(2);
  expect(result.reduce((s, r) => s + r[3] * r[4] * r[5], 0)).toBe(4);
  // Original arrays and foreign painted neighbours remain unchanged.
  expect(rows[1]).toEqual([1.5, .5, .5, 1, 1, 1, 10]);
});

test("the actual full Drawn area and every Native floor rectangle retain all six source courtyards", () => {
  const plan = parliamentRetainedPlanV295();
  expect(plan.holes!.length).toBe(6);
  const root = createReichstagUndergroundV319(false);
  const floor = root.children[0].children[0] as Mesh;
  const position = floor.geometry.getAttribute("position");
  expect(position.count).toBeGreaterThan(100);
  for (let i = 0; i < position.count; i++) expect(position.getY(i)).toBe(.25);
  const area = (ring: number[][]) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - p[1] * q[0]; }, 0)) / 2;
  const holes = plan.holes!.map(r => r.map(p => [p[0] / 10, p[1] / 10]));
  const expected = area(plan.ring.map(p => [p[0] / 10, p[1] / 10])) - holes.reduce((s, h) => s + area(h), 0);
  let actual = 0;
  for (let i = 0; i < position.count; i += 3) actual += area([0, 1, 2].map(j => [position.getX(i + j), position.getZ(i + j)]));
  expect(Math.abs(actual - expected)).toBeLessThan(.002);
  dispose(root);
  const native = createReichstagUndergroundV319(true), matrix = new Matrix4();
  const mesh = native.children[0].children.find(o => o.name === "Basement archive boxes, labels and open crossing") as InstancedMesh;
  const holeTriangles = holes.flatMap(h => ShapeUtils.triangulateShape(h.map(p => new Vector2(p[0], p[1])), []).map(t => t.map(i => h[i])));
  // Independent convex triangle/rectangle intersection, checking the whole
  // source-hole area rather than just a misleading centre-point sample.
  function clip(poly: number[][], axis: number, edge: number, sign: number): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], da = sign * (a[axis] - edge), db = sign * (b[axis] - edge);
      if (da >= 0) out.push(a);
      if ((da < 0) !== (db < 0)) { const t = da / (da - db); out.push(a.map((v, j) => v + (b[j] - v) * t)); }
    }
    return out;
  }
  let overlap = 0, floorBoxes = 0;
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); const e = matrix.elements;
    if (Math.abs(e[5] - .20) > .00001 || Math.abs(e[13] - .15) > .00001) continue;
    floorBoxes++;
    for (const tri of holeTriangles) {
      let p = tri;
      for (const [axis, edge, sign] of [[0, e[12] - e[0] / 2, 1], [0, e[12] + e[0] / 2, -1], [1, e[14] - e[10] / 2, 1], [1, e[14] + e[10] / 2, -1]]) p = clip(p, axis, edge, sign);
      if (p.length > 2) overlap += area(p);
    }
  }
  expect(floorBoxes).toBeGreaterThan(20);
  expect(overlap).toBeLessThan(.001);
  dispose(native);
});

test("every archive, pipe, lamp and partition footprint remains inside the source floor and outside every court", () => {
  const source = parliamentRetainedPlanV295(), ring = source.ring.map(p => [p[0] / 10, p[1] / 10]), holes = source.holes!.map(h => h.map(p => [p[0] / 10, p[1] / 10]));
  function inside(p: number[], r: number[][]): boolean {
    let yes = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], b = r[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
    }
    return yes;
  }
  for (const native of [false, true]) {
    const root = createReichstagUndergroundV319(native), matrix = new Matrix4();
    let checked = 0;
    root.children[0].traverse(o => {
      if (!(o instanceof InstancedMesh)) return;
      o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox!;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        if (o.name === "Basement archive boxes, labels and open crossing" && Math.abs(matrix.elements[5] - .2) < .00001 && Math.abs(matrix.elements[13] - .15) < .00001) continue;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const q = new Vector3(x, y, z).applyMatrix4(matrix), p = [q.x, q.z];
          expect(inside(p, ring)).toBe(true); expect(holes.every(h => !inside(p, h))).toBe(true);
        }
        checked++;
      }
    });
    expect(checked).toBe(11284); dispose(root);
  }
});
