import { expect, test } from "bun:test";
import { Box3, InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { createVolksbuehneEnvelopeV209 } from "../src/VolksbuehneEnvelopeV209";
import { createVolksbuehneOrankeseeV209 } from "../src/VolksbuehneOrankeseeV209";
import theatre from "../src/data/volksbuehneEnvelopeV209.json";
import lake from "../src/data/orankeseeV209.json";

const height = (root: ReturnType<typeof createVolksbuehneEnvelopeV209>, x: number, z: number) => {
  root.updateMatrixWorld(true);
  return new Raycaster(new Vector3(x, 100, z), new Vector3(0, -1, 0), 0, 105)
    .intersectObject(root, true)[0]?.point.y;
};

test("required theatre has real stage and auditorium volume before optional facades load", () => {
  for (const native of [false, true]) {
    const root = createVolksbuehneEnvelopeV209(native);
    expect(root.userData.requiredSourceEnvelope).toBe(true);
    expect(root.userData.originalSurfaceCount).toBe(75);
    expect(root.children.length).toBe(1);
    const stageHeight = height(root, 2770, -854)!;
    const auditoriumHeight = height(root, 2758, -830)!;
    expect(stageHeight).toBeGreaterThan(41.9);
    expect(stageHeight).toBeLessThan(44);
    expect(auditoriumHeight).toBeGreaterThan(28.5);
    expect(auditoriumHeight).toBeLessThan(31.1);
    if (!native) {
      expect(stageHeight).toBeCloseTo(theatre.volumes[0].topY, 3);
      expect(auditoriumHeight).toBeCloseTo(theatre.volumes[1].topY, 3);
      for (const [x, z] of [[2774.5, -882], [2789, -874.5]]) expect(height(root, x, z)).toBeUndefined();
    }
    const bounds = new Box3().setFromObject(root);
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(39);
    expect(bounds.max.x - bounds.min.x).toBeLessThan(80);
    expect(bounds.max.z - bounds.min.z).toBeLessThan(110);
  }
});

test("native theatre is entirely orthogonal and retains all independent original source blocks", () => {
  const { vertices, indices } = theatre.native;
  for (let i = 0; i < indices.length; i += 3) {
    const t = indices.slice(i, i + 3).map(j => vertices[j]);
    expect([0, 1, 2].some(axis => t.every(v => v[axis] === t[0][axis]))).toBe(true);
  }
  expect(indices.length / 3).toBeGreaterThan(13056);
});

test("Orankesee keeps source shore without a duplicate water owner and exact mapped fittings", () => {
  for (const native of [false, true]) {
    const root = createVolksbuehneOrankeseeV209(native);
    expect(root.userData.noNewWaterSurface).toBe(true);
    expect(root.userData.shorelineVertices).toBe(82);
    expect(root.userData.mappedFittings.benches).toBeGreaterThan(15);
    expect(root.userData.mappedFittings.slideWays).toBe(2);
    expect(root.children.length).toBe(2);
    expect(root.children.some(c => /water surface/i.test(c.name))).toBe(false);
    expect(lake.features.every(f => /^(node|way|relation)\/\d+$/.test(f.id))).toBe(true);
    const b = new Box3().setFromObject(root);
    expect(b.max.x - b.min.x).toBeLessThan(500);
    expect(b.max.z - b.min.z).toBeLessThan(450);
  }
});

test("both full representations have bounded image-free buffers and frozen transforms", () => {
  for (const native of [false, true]) {
    let bytes = 0, calls = 0;
    for (const root of [createVolksbuehneEnvelopeV209(native), createVolksbuehneOrankeseeV209(native)]) {
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      root.traverse(object => {
        if (!(object instanceof Mesh)) return;
        calls++;
        expect(object.matrixAutoUpdate).toBe(false);
        expect(object.geometry.getAttribute("uv")).toBeUndefined();
        expect(object.userData.dayMaterial.map).toBeNull();
        expect(object.userData.nightMaterial.map).toBeNull();
        for (const attr of Object.values(object.geometry.attributes)) bytes += attr.array.byteLength;
        if (object.geometry.index) bytes += object.geometry.index.array.byteLength;
        if (object instanceof InstancedMesh) {
          expect(object.instanceMatrix.count).toBe(object.count);
          bytes += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
          if (native) for (let i = 0; i < object.count; i++)
            for (const k of [1, 2, 4, 6, 8, 9]) expect(object.instanceMatrix.array[i * 16 + k]).toBe(0);
        }
      });
    }
    expect(calls).toBe(3);
    expect(bytes).toBeLessThan(native ? 1_150_000 : 250_000);
  }
});
