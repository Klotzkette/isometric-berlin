import { expect, test } from "bun:test";
import { InstancedMesh, Matrix4, Mesh } from "three";
import { createWeddingSitesEnvelopesV210, createWeddingSitesV210 } from "../src/WeddingSitesV210";
import { weddingSitesV210SolidAt } from "../src/weddingSitesV210Navigation";
import env from "../src/data/weddingSitesV210Envelopes.json";

const bytes = (root: ReturnType<typeof createWeddingSitesV210>) => {
  let n = 0;
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    for (const a of Object.values(o.geometry.attributes)) n += a.array.byteLength;
    n += o.geometry.index?.array.byteLength ?? 0;
    if (o instanceof InstancedMesh) n += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
  });
  return n;
};
test("Wedding supplements keep fixed GPU budgets, independent native and all touch detail", () => {
  for (const native of [false, true]) {
    const body = createWeddingSitesEnvelopesV210(native), detail = createWeddingSitesV210(native);
    expect(body.children.length + detail.children.length).toBe(3);
    expect(bytes(body) + bytes(detail)).toBe(native ? 3008304 : 1225912);
    const m = new Matrix4();
    for (const root of [body, detail]) {
      expect(root.userData.additiveOnly).toBe(true); expect(root.userData.oldSourceBodiesSuppressed).toBe(0);
      expect(root.userData.fullStaticDetailOnTouch).toBe(true);
      for (const o of root.children as Mesh[]) {
        expect(o.matrixAutoUpdate).toBe(false); expect(o.geometry.getAttribute("uv")).toBeUndefined();
        expect(o.userData.dayMaterial.map).toBeNull(); expect(o.userData.nightMaterial.map).toBeNull();
        if (native && o instanceof InstancedMesh) for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m); for (const k of [1, 2, 4, 6, 8, 9]) expect(m.elements[k]).toBe(0);
        }
      }
    }
  }
});
test("upper hall and radius collision follow the exact retained ring and stay bounded", () => {
  expect(weddingSitesV210SolidAt(-54.2, 12, -2070.4)).toBe(true);
  expect(weddingSitesV210SolidAt(-54.2, 15, -2070.4)).toBe(false);
  expect(weddingSitesV210SolidAt(-54.2, 7, -2070.4)).toBe(false);
  expect(weddingSitesV210SolidAt(-107, 7, -2029)).toBe(false);
  expect(weddingSitesV210SolidAt(0, 12, 0, 1)).toBe(false);
  const ring = env.volumes[0].geometry.coordinates[0];
  const a = ring[0], b = ring[1], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
  expect(weddingSitesV210SolidAt(x + dz / length * .3, 9, z - dx / length * .3, .5)).toBe(true);
  expect(weddingSitesV210SolidAt(x - dz / length * .3, 9, z + dx / length * .3, .5)).toBe(true);
});
test("worlds own disposable arrays and surface vertices stay complete", () => {
  const a = createWeddingSitesV210(), b = createWeddingSitesV210();
  for (let i = 0; i < a.children.length; i++) {
    expect((a.children[i] as InstancedMesh).instanceMatrix).not.toBe((b.children[i] as InstancedMesh).instanceMatrix);
    expect((a.children[i] as Mesh).geometry).not.toBe((b.children[i] as Mesh).geometry);
  }
  const shell = createWeddingSitesEnvelopesV210().children[0] as Mesh;
  expect(shell.geometry.getAttribute("position").count).toBe(env.surfaces.reduce((n, s) => n + s.triangles.length * 3, 0));
});
