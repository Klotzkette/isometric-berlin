import source from "./czechEmbassyFacadeSource.json";

/** Existing metric source bodies remain intact; only their authored tones change. */
export const WILHELM_REFINEMENT_PRISM_TONES: ReadonlyMap<string, readonly [number, number]> = new Map(
  source.parts.map(part => [part.short_id, [
    ["gFIHTCRe", "H5JWrRQf"].includes(part.short_id) ? 0x746c5d : 0xb8b1a1,
    0x99958b,
  ] as const]),
);
export const ALTER_DESSAUER_PROFILE = {
  osmNodeId: "966034352",
  world: [812.54033181816, 5.2, 838.494576795] as const,
  // Current granite plinth/bronze statue from the licensed front reference.
  // No current dimensional survey exists in the consulted monument inventory.
  displayHeightM: 6.67,
  frontAngleRad: -2.86,
  groundStatus: "display ground aligned with adjacent retained source building datum",
  dimensionStatus: "procedural photo-proportioned interpretation, not a monument survey",
  materials: { figure: "bronze", pedestal: "polished granite" },
  features: ["tricorne", "uniform coat", "baton in right hand", "sword at left hip", "separate boots", "granite pedestal", "relief panels", "chain-post enclosure"],
} as const;
