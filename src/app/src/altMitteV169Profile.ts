import { correctedHospitalRoofAtV215, BUNDESWEHR_HOSPITAL_V215_PART, BUNDESWEHR_HOSPITAL_V215_ROOF_Y } from "./bundeswehrHospitalV215Profile";
import { correctedSpringerPartsV215, correctedSpringerRoofAtV215 } from "./springerV215Profile";
import source from "./data/altMitteV169DrawnNavigationData";
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
type NativeNavigation = Pick<
  AltMitteV169Navigation,
  "legacyPrisms" | "nativeRoofCells" | "nativeRoofSpans"
>;
let nativeData: NativeNavigation | undefined;
let nativeLoading: Promise<void> | undefined;
const preparedNativeData = (): NativeNavigation => {
  if (!nativeData)
    throw new Error(
      "Preload Alt-Mitte native navigation before Minecraft construction",
    );
  return nativeData;
};
const navigationData: AltMitteV169Navigation = /*#__PURE__*/ (() => ({
  ...source,
  get legacyPrisms() {
    return preparedNativeData().legacyPrisms;
  },
  get nativeRoofCells() {
    return preparedNativeData().nativeRoofCells;
  },
  get nativeRoofSpans() {
    return preparedNativeData().nativeRoofSpans;
  },
}))();
let navigation:
  ReturnType<typeof createAltMitteV169NavigationIndex> | undefined;
const preparedNavigation = () =>
  (navigation ??= createAltMitteV169NavigationIndex(navigationData, {
    lazy: true,
  }));
/** Prepare during unpublished navigation construction, not on the first step. */
export function prepareAltMitteV169Navigation(): void {
  preparedNavigation().prepareDrawnRoofs();
}
/** The existing native-world preload is the only production caller. */
export function preloadAltMitteV169NativeNavigation(): Promise<void> {
  if (!nativeLoading) {
    nativeLoading = import("./data/altMitteV169NativeNavigationData")
      .then((module) => {
        const data = module.default as NativeNavigation;
        if (
          !Array.isArray(data.legacyPrisms) ||
          !Array.isArray(data.nativeRoofSpans)
        )
          throw new Error("Invalid Alt-Mitte native navigation source");
        nativeData = data;
        preparedNavigation().prepareNative();
      })
      .catch((error) => {
        nativeLoading = undefined;
        throw error;
      });
  }
  return nativeLoading;
}
/** Unchanged source rings, holes, solid bases and roof bounds in world metres. */
// This plain JSON property read has no effects. Mark it explicitly so the
// progressive worker, which imports only unrelated ground helpers through
// MinecraftVoxelWorld, can discard the navigation payload together with it.
export const ALT_MITTE_V169_PARTS = /* @__PURE__ */ (() =>
  correctedSpringerPartsV215(navigationData.parts.map(part => part.id === BUNDESWEHR_HOSPITAL_V215_PART ? { ...part, topY: BUNDESWEHR_HOSPITAL_V215_ROOF_Y } : part)))();
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
  return correctedSpringerRoofAtV215(x, z, native,
    correctedHospitalRoofAtV215(x, z, native, preparedNavigation().roofAt(x, z, native)));
}
