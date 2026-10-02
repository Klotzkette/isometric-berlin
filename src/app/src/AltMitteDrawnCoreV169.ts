import source from "./data/altMitteDrawnV169Data";
import {
  buildAltMitteCoreV169Steps as buildCore,
  createAltMitteCoreV169FromSource,
  type AltMitteCoreV169Source,
} from "./AltMitteCoreV169";

const payload = source as unknown as AltMitteCoreV169Source;
/** All drawn modes and input profiles use the identical measured envelope. */
export function createAltMitteCoreV169(
  _options: { mobileLike?: boolean } = {},
) {
  return createAltMitteCoreV169FromSource(payload);
}
export function buildAltMitteCoreV169Steps() {
  return buildCore(payload);
}
