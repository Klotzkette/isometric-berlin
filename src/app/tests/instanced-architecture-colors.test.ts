import { expect, test } from "bun:test";
import { Color, InstancedMesh, Mesh, MeshBasicMaterial, type Object3D } from "three";
import { createMinecraftHbfBearingSupports, HBF_BEARING_SUPPORT_PROFILE, planHbfBearingSupport } from "../src/HauptbahnhofBearingSupports";
import { createHumboldthafenBuildingDetails, planHumboldthafenBuildingDetails } from "../src/HumboldthafenBuildings";

function verifyInstancePalette(root: Object3D, colors: number[]) {
  const meshes: InstancedMesh[] = [];
  root.traverse(object => { if (object instanceof InstancedMesh) meshes.push(object); });
  expect(meshes).toHaveLength(1);
  const mesh = meshes[0], material = mesh.material as MeshBasicMaterial;
  expect(mesh.geometry.getAttribute("color")).toBeUndefined();
  // USE_COLOR must remain disabled when the cube has no per-vertex colors.
  // Three.js independently enables USE_INSTANCING_COLOR from instanceColor.
  expect(material.vertexColors).toBeFalse();
  expect(material.color.getHex()).toBe(0xffffff);
  expect(mesh.count).toBe(colors.length);
  expect(mesh.instanceColor?.count).toBe(colors.length);
  const actual = new Color(), expected = new Color();
  colors.forEach((hex, index) => {
    mesh.getColorAt(index, actual); expected.setHex(hex);
    expect(actual.r).toBeCloseTo(expected.r, 6);
    expect(actual.g).toBeCloseTo(expected.g, 6);
    expect(actual.b).toBeCloseTo(expected.b, 6);
  });
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const m of materials) {
      if (m.vertexColors) expect(object.geometry.getAttribute("color")?.count).toBe(object.geometry.getAttribute("position").count);
      m.dispose();
    }
    object.geometry.dispose();
  });
}

test("station steel colors reach the Minecraft instance shader without a missing vertex attribute", () => {
  const colors = HBF_BEARING_SUPPORT_PROFILE.piers.flatMap(([x, z]) => planHbfBearingSupport(x, z, 5.1)).map(b => b.color);
  verifyInstancePalette(createMinecraftHbfBearingSupports(() => 5.1), colors);
});

test("harbour Minecraft block colors and drawn roof colors use their supplied attributes", () => {
  const colors = planHumboldthafenBuildingDetails(undefined, true, true).map(b => b.color);
  verifyInstancePalette(createHumboldthafenBuildingDetails(undefined, { minecraft: true, mobileLike: true }), colors);
});
