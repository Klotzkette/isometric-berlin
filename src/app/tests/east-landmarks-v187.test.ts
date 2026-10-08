import { expect, test } from "bun:test";
import { InstancedMesh, Material, Mesh } from "three";
import { createEastLandmarksV187 } from "../src/EastLandmarksV187";
import { createMinecraftEastLandmarksV187 } from "../src/MinecraftEastLandmarksV187";

test("eastern sites use frozen, spatially culled finite buffers and separate mode families", () => {
  for (const native of [false, true]) {
    const root = native
      ? createMinecraftEastLandmarksV187()
      : createEastLandmarksV187();
    expect(root.userData.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.blockNative).toBe(native);
    expect(root.children.length).toBeLessThanOrEqual(36);
    let bytes = 0,
      triangles = 0;
    for (const child of root.children) {
      const mesh = child as Mesh;
      expect(mesh.frustumCulled).toBe(true);
      expect(mesh.matrixAutoUpdate).toBe(false);
      expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
      const ground = mesh.userData.enclosureGroundV187 === true;
      for (const material of [
        mesh.userData.dayMaterial,
        mesh.userData.nightMaterial,
      ]) {
        expect(material.polygonOffset).toBe(ground);
        if (ground) {
          expect(material.polygonOffsetFactor).toBe(-1);
          expect(material.polygonOffsetUnits).toBe(-2);
        }
      }
      if (mesh instanceof InstancedMesh) {
        expect(mesh.instanceMatrix.count).toBe(mesh.count);
        expect(mesh.instanceColor!.count).toBe(mesh.count);
        expect(mesh.boundingSphere!.radius).toBeLessThan(620);
        bytes +=
          mesh.instanceMatrix.array.byteLength +
          mesh.instanceColor!.array.byteLength;
        if (native)
          for (let i = 0; i < mesh.count; i++)
            for (const n of [1, 2, 4, 6, 8, 9])
              expect(mesh.instanceMatrix.array[i * 16 + n]).toBe(0);
        if (ground)
          for (let i = 0; i < mesh.count; i++)
            expect(mesh.instanceMatrix.array[i * 16 + 13]).toBeCloseTo(3.03, 5);
        mesh.dispose();
      } else {
        expect(native).toBe(false);
        expect(mesh.geometry.boundingSphere!.radius).toBeLessThan(620);
        triangles += mesh.geometry.getAttribute("position").count / 3;
        if (ground)
          for (let i = 0; i < mesh.geometry.getAttribute("position").count; i++)
            expect(mesh.geometry.getAttribute("position").getY(i)).toBeCloseTo(
              3.035,
              5,
            );
      }
      for (const attribute of Object.values(mesh.geometry.attributes))
        bytes += attribute.array.byteLength;
      for (const material of new Set([
        mesh.material,
        mesh.userData.dayMaterial,
        mesh.userData.nightMaterial,
      ]))
        if (material instanceof Material) material.dispose();
      mesh.geometry.dispose();
    }
    expect(bytes).toBeLessThan(native ? 2_300_000 : 1_200_000);
    expect(triangles).toBe(native ? 0 : 4579);
    root.clear();
  }
});
