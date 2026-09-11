import { Material, NormalBlending, Object3D, type BufferGeometry, type LineBasicMaterial, type LineSegments } from "three";

// Only known alpha-preserving shader wrappers can skip a zero-alpha draw.
const safeShaders = new WeakSet([Material.prototype.onBeforeCompile]);
const safeAfterRender = new WeakSet([Object3D.prototype.onAfterRender]);
const callbackMaterials = new WeakSet<Material>();
const suppressed = new WeakSet<Material>();

export function registerInkShaderWrapper(
  previous: Material["onBeforeCompile"],
  wrapped: Material["onBeforeCompile"],
): void {
  if (safeShaders.has(previous)) safeShaders.add(wrapped);
}

/** GPU residency observers preserve the authored draw callback contract. */
export function registerInkRenderObserver(
  original: Object3D["onAfterRender"],
  wrapped: Object3D["onAfterRender"],
): void {
  if (safeAfterRender.has(original)) safeAfterRender.add(wrapped);
}

/** Suppressed ink still needs its ordinary geometry and shader prepared. */
export function isInkDrawSuppressed(material: Material): boolean {
  return suppressed.has(material);
}

export function registerInkDrawObject(line: LineSegments<BufferGeometry, LineBasicMaterial>): void {
  if (line.onBeforeRender !== Object3D.prototype.onBeforeRender ||
      !safeAfterRender.has(line.onAfterRender)) {
    callbackMaterials.add(line.material);
  }
}

/** Release only visibility owned by the zero-alpha optimization, before mode changes. */
export function restoreInkDrawVisibility(material: LineBasicMaterial): boolean {
  if (!suppressed.delete(material)) return false;
  const changed = !material.visible;
  material.visible = true;
  return changed;
}

/** Exact no-op draws only: no threshold, geometry removal or object/child visibility change. */
export function updateInkDrawVisibility(material: LineBasicMaterial): boolean {
  const canSkip = material.opacity === 0 && material.transparent &&
    material.blending === NormalBlending && !material.depthWrite &&
    !material.stencilWrite && !material.alphaToCoverage &&
    safeShaders.has(material.onBeforeCompile) &&
    material.onBeforeRender === Material.prototype.onBeforeRender &&
    !callbackMaterials.has(material);
  if (!canSkip) return restoreInkDrawVisibility(material);
  if (!material.visible) return false;
  suppressed.add(material);
  material.visible = false;
  return true;
}
