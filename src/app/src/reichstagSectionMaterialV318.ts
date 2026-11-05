import type { Material, Plane } from "three";
type State = { planes: Plane[] | null; intersection: boolean; shadows: boolean };
const owned = new WeakMap<Material, State>();
/** Private clean state of an actual currently clipped source material. */
export function ownReichstagSectionMaterialV318(material: Material, state: State): void { owned.set(material, state); }
export function releaseReichstagSectionMaterialV318(material: Material): void { owned.delete(material); }
/** A real material factory calls this immediately after cloning. A display
 * cut is not part of the new material's underlying architectural appearance. */
export function restoreInheritedReichstagSectionV318(source: Material, clone: Material): void {
  const state = owned.get(source); if (!state) return;
  clone.clippingPlanes = state.planes; clone.clipIntersection = state.intersection; clone.clipShadows = state.shadows;
}
