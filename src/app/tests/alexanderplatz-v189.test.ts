import { expect, test } from "bun:test";
import { InstancedMesh } from "three";
import { createAlexanderplatzV189 } from "../src/AlexanderplatzV189";

test("Reisens has exact full touch detail, finite texture-free buffers and bounded cost", () => {
  for (const minecraft of [false, true]) {
    const desktop = createAlexanderplatzV189(minecraft), touch = createAlexanderplatzV189(minecraft, true);
    expect(desktop.children.length).toBe(1);
    expect(desktop.userData.parentId).toBe("DEBE01YYK000079q");
    expect(desktop.userData.groundAndNavigationUnchanged).toBe(true);
    const mesh = desktop.children[0] as InstancedMesh, mobile = touch.children[0] as InstancedMesh;
    expect(mesh.count).toBe(minecraft ? 1520 : 732);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    expect(mesh.instanceMatrix.array).toEqual(mobile.instanceMatrix.array);
    expect(mesh.instanceColor!.array).toEqual(mobile.instanceColor!.array);
    expect(Array.from(mesh.instanceMatrix.array).every(Number.isFinite)).toBe(true);
    const bytes = mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength
      + mesh.geometry.getAttribute("position").array.byteLength
      + mesh.geometry.getAttribute("normal").array.byteLength + mesh.geometry.index!.array.byteLength;
    expect(bytes).toBe(minecraft ? 116168 : 56280);
    expect(mesh.boundingBox!.min.y).toBeGreaterThan(12.5);
    expect(mesh.boundingBox!.max.y).toBeLessThan(70);
    if (minecraft) for (let i = 0; i < mesh.count; i++) {
      for (const k of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + k]).toBe(0);
    }
    for (const root of [desktop, touch]) for (const child of root.children) {
      const instance = child as InstancedMesh;
      instance.dispose(); instance.geometry.dispose();
      instance.userData.dayMaterial.dispose(); instance.userData.nightMaterial.dispose();
    }
  }
});
