import { BufferGeometry, Group, Material, Mesh } from "three";
import { createSteglitzV182, createMinecraftSteglitzV182 } from "./SteglitzV182";
import { createCityRecognitionV182 } from "./CityRecognitionV182";
import type { VisualMode } from "./visualMode";

/** One representation at a time, including when the surrounding mode changes. */
export function createOutlineLandmarksV182(
  initialMode: VisualMode,
  beforeRelease?: (root: Group) => void,
): Group {
  const root = new Group();
  root.name = "Berlin outline landmark additions v182";
  let native: boolean | undefined;
  root.userData.setMode = (mode: VisualMode) => {
    const nextNative = mode === "minecraft";
    if (native !== nextNative) {
      // Disposal releases GPU handles, but the viewer's residency/warmup maps
      // intentionally retain CPU owners for re-upload. Unregister the old
      // family while all its children are still reachable, before rebuilding.
      if (root.children.length) beforeRelease?.(root);
      const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
      root.traverse(object => {
        const mesh = object as Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        for (const value of [mesh.material, object.userData.dayMaterial, object.userData.nightMaterial]) {
          for (const material of Array.isArray(value) ? value : [value]) if (material instanceof Material) materials.add(material);
        }
        // Three retains per-instance GPU attributes separately from geometry.
        if ((mesh as Mesh & { isInstancedMesh?: boolean }).isInstancedMesh) (mesh as Mesh & { dispose(): void }).dispose();
      });
      root.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      root.add(nextNative ? createMinecraftSteglitzV182() : createSteglitzV182());
      root.add(createCityRecognitionV182(nextNative));
      native = nextNative;
    }
    root.traverse(object => {
      const mesh = object as Mesh;
      const material = object.userData[mode === "night" ? "nightMaterial" : "dayMaterial"];
      if (material) mesh.material = material;
    });
  };
  root.userData.setMode(initialMode);
  return root;
}
