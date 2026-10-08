import { expect, test } from "bun:test";
import { InstancedMesh, Material } from "three";
import { createSouthKiezV185 } from "../src/SouthKiezV185";
import { createMinecraftSouthKiezV185 } from "../src/MinecraftSouthKiezV185";

test("southern detail uses one final-sized texture-free batch per representation", () => {
  for (const native of [false, true]) {
    const root = native ? createMinecraftSouthKiezV185() : createSouthKiezV185();
    expect(root.userData.additiveOnly).toBe(true);
    expect(root.userData.sourceGeometryRetained).toBe(true);
    expect(root.userData.frontageCount).toBe(113);
    expect(root.userData.mappedBenchCount).toBe(39);
    expect(root.children.length).toBe(1);
    const mesh = root.children[0] as InstancedMesh;
    expect(mesh.count).toBe(native ? 10018 : 2788);
    expect(mesh.instanceMatrix.count).toBe(mesh.count);
    expect(mesh.matrixAutoUpdate).toBe(false);
    expect(mesh.geometry.getAttribute("uv")).toBeUndefined();
    const bytes = mesh.instanceMatrix.array.byteLength + mesh.instanceColor!.array.byteLength;
    expect(bytes).toBeLessThan(native ? 780000 : 215000);
    if (native) for (let i = 0; i < mesh.count; i++) {
      for (const j of [1, 2, 4, 6, 8, 9]) expect(mesh.instanceMatrix.array[i * 16 + j]).toBe(0);
    }
    mesh.geometry.dispose(); mesh.dispose();
    for (const material of new Set([mesh.material, mesh.userData.dayMaterial, mesh.userData.nightMaterial])) {
      if (material instanceof Material) material.dispose();
    }
    root.clear();
  }
});
