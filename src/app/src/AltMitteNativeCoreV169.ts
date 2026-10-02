import {
  buildAltMitteCoreV169Steps as buildCore,
  createAltMitteCoreV169FromSource,
  type AltMitteCoreV169Source,
} from "./AltMitteCoreV169";
import { preloadAltMitteV169NativeNavigation } from "./altMitteV169Profile";

let payload: AltMitteCoreV169Source | undefined;
let loading: Promise<void> | undefined;

/** Entering Minecraft loads its source once; Day never parses native base64. */
export function preloadAltMitteNativeV169Source(): Promise<void> {
  if (payload) return Promise.resolve();
  if (!loading) {
    loading = Promise.all([
      import("./data/altMitteNativeV169Data"),
      preloadAltMitteV169NativeNavigation(),
    ])
      .then(([module]) => {
        const source = module.default as unknown as AltMitteCoreV169Source;
        if (
          source.schemaVersion !== 1 ||
          !Array.isArray(source.sourceParents) ||
          !Array.isArray(source.minecraftChunks)
        ) {
          throw new Error("Invalid Alt-Mitte native source");
        }
        payload = source;
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

/** Separate block-native shell payload, with identical full/touch coverage. */
export function createMinecraftAltMitteCoreV169(
  _options: { mobileLike?: boolean } = {},
) {
  return createAltMitteCoreV169FromSource(preparedSource(), true);
}
export function buildMinecraftAltMitteCoreV169Steps() {
  return buildCore(preparedSource(), true);
}
