import hospitalCorrection from "./data/bundeswehrHospitalV215Drawn.json";
import springerCorrection from "./data/springerV215Drawn.json";
import source from "./data/altMitteDrawnV169Data";
import type { SurroundingOwnershipOptions } from "./SurroundingCityGeometry";
import {
  buildAltMitteCoreV169Steps as buildCore,
  createAltMitteCoreV169FromSource,
  type AltMitteCoreV169Source,
} from "./AltMitteCoreV169";

const payload = /*#__PURE__*/ (() => ({ ...source, hospitalCorrection, springerCorrection }))() as unknown as AltMitteCoreV169Source;
/** All drawn modes and input profiles use the identical measured envelope. */
export function createAltMitteCoreV169(
  options: { mobileLike?: boolean } & SurroundingOwnershipOptions = {},
) {
  return createAltMitteCoreV169FromSource(payload, false, options);
}
export function buildAltMitteCoreV169Steps(ownership: SurroundingOwnershipOptions = {}) {
  return buildCore(payload, false, ownership);
}
