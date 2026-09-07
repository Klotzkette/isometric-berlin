/** Small, geometry-free source contract for step-10 facade refinement. */
export const GROPIUS_BAU_PRISM_IDS = [
  "RQLhhnrF", "2CxqUMHy", "69M53y8n", "MTJV4dUC",
] as const;

export const GROPIUS_BAU_PRISM_TONES: Record<string, number> = {
  RQLhhnrF: 0xb97962,
};
export const GROPIUS_BAU_PRISM_ROOF_TONES: Record<string, number> = {
  RQLhhnrF: 0x757c77,
};

export const GROPIUS_BAU_DETAILS_GROUP_NAME = "Source-bound Gropius Bau facade detail";
export const MINECRAFT_GROPIUS_BAU_GROUP_NAME = "Block-native Gropius Bau facade detail";
export type GropiusBauDetailProfile = "full" | "mobile";
export type GropiusBauFacade = {
  id: "north" | "east" | "south" | "west";
  start: readonly [number, number];
  end: readonly [number, number];
  bays: number;
};

// Exterior corners from the actual delivered RQLhhnrF ring, clockwise in
// world x/z. Central north/south portal projections stay in the source body.
export const GROPIUS_BAU_FACADES: readonly GropiusBauFacade[] = [
  { id: "north", start: [643.7, 1337.3], end: [713.5, 1332.6], bays: 7 },
  { id: "east", start: [713.5, 1332.6], end: [718.3, 1402.1], bays: 8 },
  { id: "south", start: [718.3, 1402.1], end: [648.5, 1407.3], bays: 7 },
  { id: "west", start: [648.5, 1407.3], end: [643.7, 1337.3], bays: 8 },
];

export const GROPIUS_BAU_SOURCE_RING_DM = [
  [6760, 14100], [6757, 14054], [6485, 14073], [6437, 13373],
  [6733, 13353], [6732, 13347], [6744, 13346], [6745, 13357],
  [6756, 13356], [6756, 13346], [6767, 13345], [6768, 13352],
  [6804, 13350], [6803, 13342], [6816, 13342], [6816, 13353],
  [6828, 13353], [6826, 13341], [6841, 13340], [6841, 13347],
  [7135, 13326], [7183, 14021], [6912, 14043], [6916, 14088],
  [6890, 14090], [6891, 14096], [6783, 14104], [6783, 14098],
] as const;

export const GROPIUS_BAU_PROFILE = {
  name: "Gropius Bau",
  osmKey: "node/11516702",
  lod2Parent: "DEBE02YY40000AAS",
  mainSourceId: "RQLhhnrF",
  sourceCreated: "2026-03-02",
  groundYM: 4.8,
  deliveredHeightM: 29.3,
  measuredHeightM: 29.294,
  topYM: 34.1,
  sourceHoleCount: 2,
  northSouthAxes: 7,
  eastWestAxes: 8,
  architecturalStoreys: 4,
  sourceUrls: [
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031246",
    "https://www.berlinerfestspiele.de/gropius-bau/ueber-uns/ueber-den-gropius-bau",
    "https://www.openstreetmap.org/node/11516702",
  ],
  visualReference: {
    url: "https://commons.wikimedia.org/wiki/File:Gropius_Bau_Berlin_1.jpg",
    author: "Manfred Brückels",
    date: "2009",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    use: "Non-bundled facade visual reference; no tracing or texture use",
  },
  geometryStatus: "Exact delivered LoD2 wall alignment, four source parts, two source holes and roof/height retained. Published facade axis counts/materials; non-surveyed procedural window, pediment, mosaic-field and cornice subdivisions. Facade-only, no filled replacement envelope.",
  textureFree: true,
} as const;
