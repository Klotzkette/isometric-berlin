import { expect, test } from "bun:test";
import { Box3, InstancedMesh, Matrix4, Mesh, Raycaster, Vector3 } from "three";
import { boulevardGroundV210, boulevardPaintHeightV210, createBoulevardTransportV210, createNativeCurbBatchV210 } from "../src/BoulevardTransportV210";
import source from "../src/data/boulevardTransportV210.json";
import curbs from "../src/data/boulevardCurbsV210.json";
import { READONLY_CONSTRUCTION_JSON_FIELDS, transformLosslessJsonData } from "../losslessJsonData";

test("both audited curb construction arrays stay weak and lossless", () => {
  expect(READONLY_CONSTRUCTION_JSON_FIELDS["boulevardCurbsV210.json"]).toEqual(["segments", "nativeRuns"]);
  const transformed = transformLosslessJsonData(JSON.stringify(curbs), "/project/src/app/src/data/boulevardCurbsV210.json")!;
  expect(transformed.code).toContain('get ["segments"]');
  expect(transformed.code).toContain('get ["nativeRuns"]');
  expect(transformed.code).toContain("new WeakRef(value)");
});

for (const native of [false, true]) test(`v210 boulevard ${native ? "native" : "drawn"} retains every source strip with bounded fixed buffers`, () => {
  const root = createBoulevardTransportV210(native);
  let paintCount = 0, curbCount = 0, bytes = 0;
  try {
    expect(root.userData.fullStaticDetailOnTouch).toBeTrue();
    expect(root.userData.additiveOnly).toBeTrue();
    expect(root.children.length).toBeLessThan(65);
    for (const child of root.children) {
      const mesh = child as Mesh;
      expect(mesh.frustumCulled).toBeTrue();
      expect(mesh.matrixAutoUpdate).toBeFalse();
      expect(mesh.userData.dayMaterial.map).toBeNull();
      bytes += Object.values(mesh.geometry.attributes).reduce((n, a) => n + a.array.byteLength, 0);
      bytes += mesh.geometry.index?.array.byteLength ?? 0;
      if (mesh instanceof InstancedMesh) {
        curbCount += mesh.count;
        bytes += mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0);
        if (native) for (let i = 0; i < mesh.count; i++) {
          const a = mesh.instanceMatrix.array;
          for (const j of [1, 2, 4, 6, 8, 9]) expect(a[i * 16 + j]).toBe(0);
        }
      } else {
        const p = mesh.geometry.getAttribute("position");
        paintCount += p.count / 4;
        for (let i = 0; i < p.count; i += 4) {
          expect(Number.isFinite(p.getY(i))).toBeTrue();
          if (native) {
            expect(p.getZ(i)).toBe(p.getZ(i + 1));
            expect(p.getX(i + 1)).toBe(p.getX(i + 2));
            expect(p.getY(i)).toBe(p.getY(i + 3));
          } else {
            expect(p.getY(i)).toBeCloseTo(boulevardPaintHeightV210(p.getX(i), p.getZ(i)), 3);
          }
        }
      }
    }
    expect(paintCount).toBe(native ? source.counts.nativePaintQuads : source.counts.paintStrips);
    expect(curbCount).toBe(native ? curbs.nativeRuns.length : curbs.segments.length);
    expect(bytes).toBeLessThan(1_500_000);
  } finally {
    for (const object of root.children) {
      const mesh = object as Mesh;
      mesh.geometry.dispose();
      mesh.userData.dayMaterial.dispose(); mesh.userData.nightMaterial.dispose();
      if (mesh instanceof InstancedMesh) mesh.dispose();
    }
  }
});


test("native curb matrices restore exact world vertices, bounds and negative cells", () => {
  const root = createBoulevardTransportV210(true); root.updateMatrixWorld(true);
  const reference = new Map(curbs.nativeRuns.map(([ix, iz, width, depth]) => {
    const x = (ix + width / 2) / 4, z = (iz + depth / 2) / 4;
    return [`${x}:${z}`, { minX: ix / 4, maxX: (ix + width) / 4,
      minZ: iz / 4, maxZ: (iz + depth) / 4, y: boulevardGroundV210(x, z, true) + .185 }];
  }));
  const local = new Matrix4(), world = new Matrix4(), point = new Vector3();
  let seen = 0, negativeCell = false;
  for (const object of root.children) {
    if (!(object instanceof InstancedMesh)) continue;
    expect(object.instanceMatrix.array).toBeInstanceOf(Uint16Array);
    expect(object.instanceMatrix.normalized).toBeFalse();
    const expectedBox = new Box3();
    for (let i = 0; i < object.count; i++) {
      object.getMatrixAt(i, local); world.multiplyMatrices(object.matrixWorld, local);
      point.set(0, 0, 0).applyMatrix4(world);
      const r = reference.get(`${point.x}:${point.z}`)!;
      expect(r).toBeDefined(); seen++;
      for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
        point.set(x, y, z).applyMatrix4(world);
        expect(point.x).toBe(x < 0 ? r.minX : r.maxX);
        expect(point.z).toBe(z < 0 ? r.minZ : r.maxZ);
        expect(point.y).toBeCloseTo(r.y + y * .19, 9);
        expectedBox.expandByPoint(point);
      }
    }
    const actualBox = object.boundingBox!.clone().applyMatrix4(object.matrixWorld);
    expect(actualBox.min.distanceTo(expectedBox.min)).toBeLessThan(1e-9);
    expect(actualBox.max.distanceTo(expectedBox.max)).toBeLessThan(1e-9);
    negativeCell ||= object.position.x < 0 || object.position.z < 0;
  }
  expect(seen).toBe(curbs.nativeRuns.length); expect(negativeCell).toBeTrue();
  // Compare all eight decoded vertices with an independent Float32 matrix.
  const row = [-513.125, 3.185, -1.875, .25, .19, .75, 0xd4d0c2];
  const mesh = createNativeCurbBatchV210([row], [-2, -1]); mesh.updateMatrixWorld(true);
  mesh.getMatrixAt(0, local); world.multiplyMatrices(mesh.matrixWorld, local);
  const floats = new Float32Array(new Matrix4().makeScale(row[3], row[4], row[5]).setPosition(row[0], row[1], row[2]).elements);
  const original = new Matrix4().fromArray(floats);
  for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
    const corner = new Vector3(x, y, z);
    expect(corner.clone().applyMatrix4(world).distanceTo(corner.applyMatrix4(original))).toBeLessThan(1e-6);
  }
  const hits = new Raycaster(new Vector3(row[0], 20, row[2]), new Vector3(0, -1, 0)).intersectObject(mesh, false);
  expect(hits.length).toBeGreaterThan(0); expect(hits[0].point.y).toBeCloseTo(3.28, 9);
  expect(hits[0].point.x).toBe(row[0]); expect(hits[0].point.z).toBe(row[2]);
  for (const o of [...root.children, mesh]) {
    const m = o as Mesh; m.geometry.dispose(); m.userData.dayMaterial.dispose(); m.userData.nightMaterial.dispose();
    if (m instanceof InstancedMesh) m.dispose();
  }
});
