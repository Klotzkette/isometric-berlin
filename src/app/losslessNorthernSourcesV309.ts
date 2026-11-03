/** Finite additive source encodings; the complete earlier registry stays pinned. */
export const LOSSLESS_NORTHERN_SOURCES_V309: ReadonlySet<string> = new Set([
  "data/northSitesV306.json", "data/northParkTerrainV306.json", "data/northSitesV306Navigation.json",
  "data/railTerrainContactV307.json", "data/railTerrainContactApproachV309.json", "data/railSseArchitectureV307.json", "data/railSseTerrainV307.json", "data/railSseNavigationV307.json", "data/railSseLegacyV307.json",
  "data/hospitalArchitectureV308Core.json", "data/hospitalArchitectureV308Profile.json", "data/hospitalArchitectureV308Previous.json",
  "data/northernFidelityV309Packets.json",
  "data/coreTerrainContactV307.json", "data/coreTerrainContactV307Navigation.json",
  "data/railBridgeApproachV307Pavement.json", "data/railBridgeApproachV307Navigation.json",
  "data/railBridgeApproachV307Bodies.json", "data/railBridgeApproachV307Ground.json", "data/railBridgeApproachV307Profile.json",
  "data/gesundbrunnenRoadBridgesV309.json", "data/gesundbrunnenRoadBridgesV309Profile.json", "data/railBridgeUnderdeckV307.json", "data/railBridgeUnderdeckApproachV309.json",
]);

/** These recipes retain private identity after construction; keep their eager
 * strong value, encoding only the exact source literal more compactly. */
export const LOSSLESS_NORTHERN_EAGER_FIELDS_V309: Readonly<Record<string,readonly string[]>> = {
  "data/coreTerrainContactV307.json": ["variants"],
};
