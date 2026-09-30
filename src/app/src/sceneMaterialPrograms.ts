import { Line, Material, Points, Scene, Sprite, type Object3D } from "three";
import { objectMaterialsIncludingTransferredAlternates } from "./transferableObject3D";

/**
 * Retire shader programs retained by an earlier drawn-mode presentation.
 * Call once at an actual mode boundary, before warming/rendering the new mode.
 *
 * Three's public Material.dispose() releases renderer-side program references;
 * the same material compiles again when next drawn. It leaves its authored
 * properties, callbacks, uniforms and textures intact. Keep hidden descendants
 * and cached alternates in this pass: they can still own old program variants.
 * Its dispose event also invalidates sceneGpuWarmup's residency epoch.
 *
 * This trades mode-switch recompilation for a bounded program cache on touch
 * devices. It must not run on ordinary lighting refreshes or every frame.
 */
export function retireSceneMaterialPrograms(root: Object3D): number {
  const materials = new Set<Material>();
  root.traverse((object) => {
    for (const material of objectMaterialsIncludingTransferredAlternates(object)) {
      materials.add(material);
    }
    // The transfer format covers city meshes/line segments. Also retain the
    // live-only snow particles and any ordinary lines/sprites in this lifecycle.
    if (object instanceof Line || object instanceof Points || object instanceof Sprite) {
      const assigned = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of assigned) materials.add(material);
    }
    if (object instanceof Scene && object.overrideMaterial) materials.add(object.overrideMaterial);
  });
  for (const material of materials) material.dispose();
  return materials.size;
}
