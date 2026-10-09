/** OSM relation 13918836: separate north/south rings, EPSG:25833 centroids
 * and minimum-rectangle major axes. Dimensions remain the complete v116 fit. */
export const CHARLOTTENBURGER_TOR_PROFILE = Object.freeze({
  centerWorldM: [-2731.136, 568.211] as const,
  anchorWorldM: [-2731.1356797510525, 8, 568.2113939598203] as const,
  roadOpeningM: 34, wingCount: 2, columnCountPerWing: 4,
  sourceUrl: "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/artikel.1368662.php",
  sourceOsmRelation: 13918836,
  wings: [
    { side: -1, name: "north", centerWorldM: [-2733.549343082006, 538.5190140604973] as const, yawRadians: 88.67576739198947 * Math.PI / 180 },
    { side: 1, name: "south", centerWorldM: [-2728.77644200105, 597.2340306686237] as const, yawRadians: 102.29225678025261 * Math.PI / 180 },
  ] as const,
  geometryStatus: "Separate source-ring centroids and transverse major axes; all v116 geometry retained by rigid transforms, with southern bronze translated to the documented east face. Local colonnade/sculpture subdivisions remain presentation fits.",
});
