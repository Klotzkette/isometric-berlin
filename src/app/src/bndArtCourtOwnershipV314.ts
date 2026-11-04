import source from "./data/bndArtCourtsV314.json";
import type { SourceQuarterSourceV303 } from "./SourceQuarterPacketV303";
import type { SurroundingOwnershipOptions } from "./SurroundingCityGeometry";

export type BndArtCourtOptionsV314 = SurroundingOwnershipOptions & {
  /** The art and these bounded court surfaces share the unpublished world. */
  bndPublicArtV314?: boolean;
};

export function bndArtCourtOwnershipV314(
  options: BndArtCourtOptionsV314,
): SurroundingOwnershipOptions {
  if (options.bndPublicArtV314 !== true) return options;
  return {
    ...options,
    sourceQuartersV303: true,
    sourceQuarterSourcesV303: [
      ...(options.sourceQuarterSourcesV303 ?? []),
      { source: source as unknown as SourceQuarterSourceV303, kind: "bnd-public-art-court-v314" },
    ],
  };
}
