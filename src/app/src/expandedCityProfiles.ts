/**
 * LoD2-anchored front of the Hamburger Bahnhof.
 *
 * The landmark point lies inside the former train hall, not on the entrance
 * facade. The two 26 m LoD2 tower parts fix the facade line and its 30 degree
 * bearing; keeping the offset here prevents a generic point marker from
 * rotating or translating the whole historic head building again.
 */
export const HAMBURGER_BAHNHOF_PROFILE = {
  facadeAxis: [0.8673, -0.4978] as const,
  facadeNormal: [0.4978, 0.8673] as const,
  facadeOffsetFromLandmarkM: [-2.399, 24.148] as const,
  facadeRotationY: Math.PI / 6,
  facadeWidthM: 62,
  forecourtTreatment: "axial-path-and-rondel",
  grounded: true,
  lowerArchCount: 2,
  roofForm: "flat-cornice",
  sourceTowerIds: ["DEBE3DIkXt8PMip6", "DEBE3DlXyRYPJvcY"] as const,
  towerCentresM: [-11.43, 11.43] as const,
  towerHeightM: 26.25,
  upperArcadeCount: 6,
} as const;

/** LoD2-derived envelope of the protected 1960s Rieckhallen freight hall. */
export const RIECKHALLEN_PROFILE = {
  centerOffsetFromLandmarkM: [-2.1326, -1.5085] as const,
  centerWorldM: [-72.289693, -1218.65614] as const,
  crossAxis: [0.931102, -0.364759] as const,
  lengthM: 281.279,
  longAxis: [0.364759, 0.931102] as const,
  measuredHeightM: 9.364,
  minecraftRoofTopY: 17.2,
  roofBandCount: 3,
  roofForm: "flat-mixed-with-low-longitudinal-bands",
  rotationY: 0.373374,
  sourceBuildingId: "DEBE01YYK0002SQl",
  widthM: 16.244,
} as const;

/**
 * Published planning envelope for berlin modern (Museum des 20. Jahrhunderts).
 *
 * The museum is still under construction, so this is deliberately not labelled
 * surveyed as-built geometry. Dimensions come from Herzog & de Meuron's project
 * data; the site axis follows the committed OSM construction boundary.
 */
export const BERLIN_MODERN_PROFILE = {
  bodyHeightM: 11,
  centerWorldM: [-228.499208, 1197.491703] as const,
  footprintLengthM: 120,
  footprintWidthM: 71,
  geometryStatus: "planning-envelope-not-surveyed-as-built",
  groundY: 8,
  grounded: true,
  levelCount: 3,
  roofForm: "north-south-gable-with-photovoltaics",
  roofRiseM: 7,
  rotationY: (-19.74 * Math.PI) / 180,
  source: "Herzog & de Meuron project data and OSM construction-boundary axis",
  totalHeightM: 18,
} as const;
