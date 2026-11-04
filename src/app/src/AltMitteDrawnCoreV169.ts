import eastCinemasCorrection from "./data/eastCinemasV260Drawn.json";
import hospitalCorrection from "./data/bundeswehrHospitalV215Drawn.json";
import springerCorrection from "./data/springerV215Drawn.json";
import source from "./data/altMitteDrawnV169Data";
import { bndArtCourtOwnershipV314, type BndArtCourtOptionsV314 } from "./bndArtCourtOwnershipV314";
import {
  buildAltMitteCoreV169Steps as buildCore,
  createAltMitteCoreV169FromSource,
  type AltMitteCoreV169Source,
} from "./AltMitteCoreV169";

const payload = /*#__PURE__*/ (() => ({ ...source, hospitalCorrection, springerCorrection, eastCinemasCorrection }))() as unknown as AltMitteCoreV169Source;
/** All drawn modes and input profiles use the identical measured envelope. */
export function createAltMitteCoreV169(
  options: { mobileLike?: boolean } & BndArtCourtOptionsV314 = {},
) {
  return createAltMitteCoreV169FromSource(payload, false, bndArtCourtOwnershipV314(options));
}
export function buildAltMitteCoreV169Steps(ownership: BndArtCourtOptionsV314 = {}) {
  return buildCore(payload, false, bndArtCourtOwnershipV314(ownership));
}
