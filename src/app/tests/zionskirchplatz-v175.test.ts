import { describe, expect, test } from "bun:test";
import { InstancedMesh, Mesh } from "three";
import { createMinecraftZionskirchplatzV175, createZionskirchplatzV175 } from "../src/ZionskirchplatzV175";

describe("four additive Zionskirchplatz frontages", () => {
  test("full drawn detail is identical on touch with two small static batches", () => {
    const desktop = createZionskirchplatzV175(), mobile = createZionskirchplatzV175({mobileLike:true});
    expect(desktop.children.length).toBe(2);
    desktop.children.forEach((node, i) => {
      const a = node as Mesh, b = mobile.children[i] as Mesh;
      expect(a.geometry.getAttribute("position").array).toEqual(b.geometry.getAttribute("position").array);
      expect(a.geometry.getAttribute("uv")).toBeUndefined();
      expect(a.matrixAutoUpdate).toBe(false);
      expect(a.userData.dayMaterial).toBeDefined();
      expect(a.userData.nightMaterial).toBeDefined();
      if (a instanceof InstancedMesh && b instanceof InstancedMesh) {
        expect(a.instanceMatrix.array).toEqual(b.instanceMatrix.array);
        expect(a.instanceColor!.array).toEqual(b.instanceColor!.array);
        expect(a.count).toBeLessThan(1600);
      }
    });
  });
  test("Minecraft keeps one independent orthogonal native batch without textures", () => {
    const root = createMinecraftZionskirchplatzV175({mobileLike:true});
    expect(root.children.length).toBe(1);
    const mesh = root.children[0] as InstancedMesh;
    expect(mesh.count).toBeLessThan(5000);
    expect(root.userData.nativeMinecraft).toBe(true);
    const a = mesh.instanceMatrix.array;
    for (let i = 0; i < mesh.count; i++) {
      for (const j of [1,2,4,6,8,9]) expect(a[i*16+j]).toBe(0);
    }
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength).toBeLessThan(400_000);
  });
});
