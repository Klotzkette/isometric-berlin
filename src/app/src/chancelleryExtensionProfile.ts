export type WorldRing = readonly (readonly [number, number])[];

/**
 * Current Federal Chancellery extension in the Kanzlerpark.
 *
 * The three rings are the EPSG:25833 OSM geometries transformed into the
 * viewer's world frame (easting - 389500, 5820000 - northing). They are kept
 * separate from the temporary presentation detail: OSM fixes the footprint,
 * while scaffold, crane and fit-out cues remain explicitly reconstructed.
 */
export const CHANCELLERY_EXTENSION_PROFILE = {
  annexFootprintWorldM: [
    [-515.85, -156.28],
    [-515.59, -181.1],
    [-421.38, -180.4],
    [-407.61, -191.74],
    [-407.19, -200.92],
    [-582.43, -204.31],
    [-582.97, -181.83],
    [-574.08, -181.51],
    [-573.92, -184.62],
    [-558.43, -184.37],
    [-558.7, -167.57],
    [-556.39, -167.51],
    [-556.44, -164.83],
    [-553.85, -164.73],
    [-553.86, -157.3],
  ] as WorldRing,
  annexHeightM: 6.2,
  currentStage:
    "shell largely complete; technical fit-out in progress; south bridge installed",
  currentStagePublishedAt: "2026-04-10",
  curvedBuildingFootprintWorldM: [
    [-713.93, -131.36],
    [-710.38, -129.01],
    [-704.49, -126.78],
    [-660.79, -125.47],
    [-668.65, -119.05],
    [-707.76, -119.7],
    [-714.3, -121.37],
    [-718.78, -124.88],
    [-727.55, -115.41],
    [-733.92, -120.2],
    [-737.9, -124.65],
    [-741.03, -129.27],
    [-744.52, -134.85],
    [-746.85, -140.77],
    [-748.87, -146.86],
    [-749.7, -153.17],
    [-749.77, -162.75],
    [-748.29, -172.4],
    [-746.03, -177.77],
    [-742.7, -183.79],
    [-738.08, -190.46],
    [-730.25, -197.95],
    [-721.89, -202.87],
    [-714.04, -206.27],
    [-705.48, -207.82],
    [-696.82, -208.59],
    [-685, -208.22],
    [-582.43, -204.31],
    [-582.97, -181.83],
    [-697.3, -186.4],
    [-707.91, -185.51],
    [-715.7, -182.23],
    [-722.08, -177.26],
    [-724.9, -172.84],
    [-726.85, -168.33],
    [-728.28, -164.78],
    [-728.58, -160.05],
    [-728.69, -155.21],
    [-728.21, -150.85],
    [-727.04, -147.05],
    [-724.23, -142.52],
    [-722.27, -139.09],
  ] as WorldRing,
  curvedBuildingHeightM: 22.2,
  geometryStatus:
    "OSM construction footprints and bridge axis; published six-storey programme; vertical and temporary site details are bounded presentation estimates",
  osmAnnexWayId: "1315319770",
  osmCurvedBuildingWayId: "1434663371",
  osmSiteWayId: "1357789475",
  osmSouthBridgeWayId: "1357796197",
  plannedOfficeStoreys: 6,
  siteFootprintWorldM: [
    [-361.13, -239.06],
    [-361.89, -194.92],
    [-377.07, -186.89],
    [-395.58, -177.89],
    [-528.74, -125.32],
    [-524, -112.17],
    [-594.69, -83.81],
    [-597.29, -89.79],
    [-599.03, -93.78],
    [-642, -73.36],
    [-656.59, -64.38],
    [-726.16, -66.57],
    [-731.01, -67.96],
    [-735.6, -68.24],
    [-735.35, -106.83],
    [-735.34, -107.4],
    [-786.36, -108.62],
    [-784.09, -212.08],
    [-771.51, -211.8],
    [-769.59, -235.02],
    [-607.05, -234.98],
    [-607.26, -243.36],
    [-565.23, -242.68],
    [-540, -241.03],
    [-508, -239.88],
    [-449.88, -286.59],
    [-435.12, -305.64],
    [-418.39, -293.7],
    [-386.89, -296.02],
    [-377.81, -294.34],
    [-369.36, -289.41],
    [-361.44, -279.86],
    [-360.75, -270.88],
    [-356.54, -265.16],
    [-386.58, -239.55],
  ] as WorldRing,
  sourceCheckedAt: "2026-08-12",
  sourceUrls: [
    "https://www.bundesregierung.de/breg-de/bundesregierung/bundeskanzleramt/groesserer-regierungssitz-1799034",
    "https://www.bundesregierung.de/breg-de/mediathek/erweiterungsbau-kanzleramt-1981446",
    "https://www.berlin.de/ba-mitte/aktuelles/mitte-blog/2026/artikel.1650867.php",
    "https://www.openstreetmap.org/way/1357789475",
    "https://www.openstreetmap.org/way/1434663371",
    "https://www.openstreetmap.org/way/1315319770",
    "https://www.openstreetmap.org/way/1357796197",
  ] as const,
  southBridge: {
    documentedLengthM: 180,
    endWorldM: [-400.02, -96.2] as const,
    installedAt: "2026-03-18",
    osmAxisLengthM: 194.32,
    presentationRule:
      "OSM fixes axis and midpoint; official published 180 m fixes displayed structural length",
    startWorldM: [-594.34, -97.1] as const,
  },
} as const;

export function pointInWorldRing(
  x: number,
  z: number,
  ring: WorldRing,
): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [x1, z1] = ring[index];
    const [x2, z2] = ring[previous];
    const crosses = z1 > z !== z2 > z;
    if (
      crosses &&
      x < ((x2 - x1) * (z - z1)) / (z2 - z1 || Number.EPSILON) + x1
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Remove obsolete park staffage only inside the current OSM worksite. */
export function isChancelleryExtensionConstructionPoint(
  x: number,
  z: number,
): boolean {
  return pointInWorldRing(
    x,
    z,
    CHANCELLERY_EXTENSION_PROFILE.siteFootprintWorldM,
  );
}
