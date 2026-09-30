/** OSM anchors and published overall height, with explicitly approximate
 * architectural subdivisions checked against three licensed street views.
 * Local x follows the north/south facade; +z points towards the east. */
export const GEDAECHTNISKIRCHE_RUIN_PROFILE = {
  centerWorldM: [-2495.572, 1507.709] as const,
  rotationY: (79.93 * Math.PI) / 180,
  footprintM: [31, 18] as const,
  heightM: 71,
  originalHeightM: 113,
  sourceBuildingId: "OSM-way-15218373",
  clock: { centerHeightM: 36.4, diameterM: 7.2, hourMarkers: 12 },
  clockFaceCount: 4,
  portal: {
    archRadiusM: 1.6,
    clearWidthM: 3.2,
    openThrough: true,
    springHeightM: 3.2,
  },
  roseBreach: { centerHeightM: 16.4, radiusM: 5.8 },
  eastBreach: { bottomHeightM: 8.5, springHeightM: 17, radiusM: 5.8 },
  belfry: {
    sides: 8,
    radiusM: 10.3,
    baseHeightM: 43.5,
    eavesHeightM: 55.2,
    gableHeightM: 58.5,
  },
  belfryArchesPerLongFace: 2,
  crownWallCount: 8,
  crownBaseHeightM: 55.4,
  crownRadiusM: 9.1,
  crownTopHeightsM: [71, 70.5, 67.2, 63.3, 61.5, 65.2, 69.1, 70.4] as const,
  sideTurrets: [
    {
      centerLocalM: [-12.5, -6.0] as const,
      radiusM: 2.4,
      shaftTopM: 32.5,
      roofTopM: 46,
      crossTopM: 48.5,
    },
    {
      centerLocalM: [12.5, -6.0] as const,
      radiusM: 2.4,
      shaftTopM: 32.5,
      roofTopM: 36.2,
      crossTopM: 36.2,
    },
  ] as const,
  brokenCrown: {
    maxHeightM: 71,
    patinaColor: "green-grey",
    status:
      "stepped, steep hollow copper sheath with seams and open dormer holes; estimated from licensed photographs",
  },
  recognitionGeometry:
    "raised circular breach above accessible memorial hall, Romanesque gables, asymmetric side spires, four gold clocks, octagonal open bell storey and tall fractured copper sheath",
  facadeDetailStatus:
    "procedural proportions and masonry subdivisions, not a stone-by-stone or component survey; see docs/gedaechtniskirche-visual-audit-v154.md",
} as const;
