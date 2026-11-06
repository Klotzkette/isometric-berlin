import {
  buildAltMitteCoreV169Steps as buildCore,
  createAltMitteCoreV169FromSource,
  type AltMitteCoreV169Source,
} from "./AltMitteCoreV169";
import { preloadAltMitteV169NativeNavigation } from "./altMitteV169Profile";
import { bndArtCourtOwnershipV314, type BndArtCourtOptionsV314 } from "./bndArtCourtOwnershipV314";

let payload: AltMitteCoreV169Source | undefined;
let loading: Promise<void> | undefined;

/** Entering Minecraft loads its source once; Day never parses native base64. */
export function preloadAltMitteNativeV169Source(): Promise<void> {
  if (payload) return Promise.resolve();
  if (!loading) {
    loading = Promise.all([
      import("./data/altMitteNativeV169Data"),
      preloadAltMitteV169NativeNavigation(),
      import("./data/bundeswehrHospitalV215Minecraft.json"),
      import("./data/springerV215Minecraft.json"),
      import("./data/eastCinemasV260Minecraft.json"),
    ])
      .then(([module, , hospital, springer, eastCinemas]) => {
        const source = module.default as unknown as AltMitteCoreV169Source;
        if (
          source.schemaVersion !== 1 ||
          !Array.isArray(source.sourceParents) ||
          !Array.isArray(source.minecraftChunks)
        ) {
          throw new Error("Invalid Alt-Mitte native source");
        }
        payload = { ...source,
          eastCinemasCorrection: eastCinemas.default as unknown as NonNullable<AltMitteCoreV169Source["eastCinemasCorrection"]>,
          hospitalCorrection: hospital.default as unknown as NonNullable<AltMitteCoreV169Source["hospitalCorrection"]>,
          springerCorrection: springer.default as unknown as NonNullable<AltMitteCoreV169Source["springerCorrection"]>,
        };
      })
      .catch((error) => {
        loading = undefined;
        throw error;
      });
  }
  return loading;
}

function preparedSource(): AltMitteCoreV169Source {
  if (!payload)
    throw new Error(
      "Call preloadAltMitteNativeV169Source() before constructing the native world",
    );
  return payload;
}

/** Fail before any world allocation when a synchronous caller forgot preload. */
export function assertAltMitteNativeV169SourceReady(): void {
  preparedSource();
}

/** Borrow the already-preloaded original; never starts a Drawn/native fetch. */
export function preparedWilhelmHousingNativeSourceV324(): AltMitteCoreV169Source {
  return preparedSource();
}

/** Separate block-native shell payload, with identical full/touch coverage. */
export function createMinecraftAltMitteCoreV169(
  options: { mobileLike?: boolean } & BndArtCourtOptionsV314 = {},
) {
  return createAltMitteCoreV169FromSource(preparedSource(), true, bndArtCourtOwnershipV314(options));
}
export function buildMinecraftAltMitteCoreV169Steps(ownership: BndArtCourtOptionsV314 = {}) {
  return buildCore(preparedSource(), true, bndArtCourtOwnershipV314(ownership));
}
