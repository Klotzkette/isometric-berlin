import { Line, Material, Points, Scene, Sprite, type Object3D } from "three";
import { objectMaterialsIncludingTransferredAlternates } from "./transferableObject3D";

const retiringPrograms = new WeakSet<Material>();

/** Only the synchronous real program-retirement call can qualify this event.
 * Authored disposal outside that scope still ends a material's lifetime. */
export function isSceneMaterialProgramRetirementV321(material: Material): boolean {
  return retiringPrograms.has(material);
}

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
  for (const material of materials) {
    const nested = retiringPrograms.has(material);
    retiringPrograms.add(material);
    try {
      material.dispose();
    } finally {
      if (!nested) retiringPrograms.delete(material);
    }
  }
  return materials.size;
}
