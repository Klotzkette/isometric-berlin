import source from "./data/altMitteV169NavigationData";
import {
  createAltMitteV169NavigationIndex,
  type AltMitteV169Navigation,
} from "./altMitteV169NavigationIndex";
export {
  createAltMitteV169NavigationIndex,
  ALT_MITTE_V169_INDEX_CELL_M,
  type AltMitteV169Navigation,
  type AltMitteV169Part,
} from "./altMitteV169NavigationIndex";
export { ALT_MITTE_V169_PRISM_IDS } from "./altMitteV169Ownership";
const navigationData = source as AltMitteV169Navigation;
let navigation:
  ReturnType<typeof createAltMitteV169NavigationIndex> | undefined;
const preparedNavigation = () =>
  (navigation ??= createAltMitteV169NavigationIndex(navigationData));
/** Prepare during unpublished navigation construction, not on the first step. */
export function prepareAltMitteV169Navigation(): void {
  preparedNavigation();
}
/** Unchanged source rings, holes, solid bases and roof bounds in world metres. */
// This plain JSON property read has no effects. Mark it explicitly so the
// progressive worker, which imports only unrelated ground helpers through
// MinecraftVoxelWorld, can discard the navigation payload together with it.
export const ALT_MITTE_V169_PARTS = /* @__PURE__ */ (() => navigationData.parts)();
export function altMitteV169SourceColumn(
  x: number,
  z: number,
  base: number,
  top: number,
): boolean {
  return preparedNavigation().sourceColumn(x, z, base, top);
}
export function altMitteV169RoofAt(
  x: number,
  z: number,
  native = false,
): number | null {
  return preparedNavigation().roofAt(x, z, native);
}
