import { describe, expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createPrisonsMemorialsEnvelopesV209, createPrisonsMemorialsV209, PRISONS_MEMORIALS_V209_SOURCE_IDS } from "../src/PrisonsMemorialsV209";
import { prisonsMemorialsV209GroundAt, prisonsMemorialsV209SolidAt } from "../src/prisonsMemorialsV209Navigation";
import data from "../src/data/prisonsMemorialsV209Envelopes.json";

function bytes(root: ReturnType<typeof createPrisonsMemorialsV209>): number {
  let n = 0;
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const a of Object.values(object.geometry.attributes)) n += a.array.byteLength;
    n += object.geometry.index?.array.byteLength ?? 0;
    if (object instanceof InstancedMesh) n += object.instanceMatrix.array.byteLength + (object.instanceColor?.array.byteLength ?? 0);
  });
  return n;
}

describe("v209 Tegel and distinct Lichtenberg/Hohenschoenhausen sites", () => {
  test("complete required envelopes and optional exterior detail have fixed budgets", () => {
    expect(PRISONS_MEMORIALS_V209_SOURCE_IDS).toHaveLength(118);
    for (const native of [false, true]) {
      const shells = createPrisonsMemorialsEnvelopesV209(native), details = createPrisonsMemorialsV209(native);
      expect(shells.children).toHaveLength(native ? 5 : 3);
      expect(details.children).toHaveLength(3);
      expect(bytes(shells)).toBe(native ? 1166768 : 850284);
      expect(bytes(details)).toBe(native ? 3421136 : 2560360);
      for (const root of [shells, details]) {
        expect(root.userData.sourceGeometryRetained).toBe(true);
        expect(root.userData.fullStaticDetailOnTouch).toBe(true);
        expect(root.userData.jvaMoabitAndLehrterMemorialUnchanged).toBe(true);
        for (const mesh of root.children as Mesh[]) {
          expect(mesh.matrixAutoUpdate).toBe(false);
          expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
          expect(mesh.userData.dayMaterial.map).toBeNull();
          expect(mesh.userData.nightMaterial.map).toBeNull();
        }
      }
    }
  });

  test("native envelope and all visible details are independently orthogonal", () => {
    const m = new Matrix4();
    for (const root of [createPrisonsMemorialsEnvelopesV209(true), createPrisonsMemorialsV209(true)])
      for (const mesh of root.children) {
        if (!(mesh instanceof InstancedMesh)) continue;
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          for (const k of [1, 2, 4, 6, 8, 9]) expect(m.elements[k]).toBe(0);
        }
      }
  });

  test("all full source triangles are submitted; source shells never live in optional detail", () => {
    const root = createPrisonsMemorialsEnvelopesV209();
    const count = root.children.reduce((n, o) => n + (o as Mesh).geometry.getAttribute("position").count, 0);
    expect(count).toBe([...data.surfaces, ...data.ground].reduce((n, s) => n + s.triangles.length * 3, 0));
    expect(createPrisonsMemorialsV209().children.every(c => c instanceof InstancedMesh)).toBe(true);
  });

  test("new ground stays finite, building navigation keeps open memorial court", () => {
    expect(prisonsMemorialsV209GroundAt(-5165, -6112)).toBe(3);
    expect(prisonsMemorialsV209GroundAt(7862, 660)).toBe(3);
    expect(prisonsMemorialsV209GroundAt(8900, -2345)).toBe(3);
    expect(prisonsMemorialsV209GroundAt(8500, -1000)).toBeNull();
    expect(prisonsMemorialsV209SolidAt(7863, 5, 660)).toBe(true);
    expect(prisonsMemorialsV209SolidAt(8900, 5, -2345)).toBe(false);
  });

  test("each world owns its disposable geometry, materials and instance arrays", () => {
    const a = createPrisonsMemorialsV209(), b = createPrisonsMemorialsV209();
    a.children.forEach((o, i) => {
      const x = o as InstancedMesh, y = b.children[i] as InstancedMesh;
      expect(x.geometry).not.toBe(y.geometry); expect(x.material).not.toBe(y.material);
      expect(x.instanceMatrix).not.toBe(y.instanceMatrix);
    });
  });
});
