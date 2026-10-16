import { findSightBySlug, parseViewHash, type NamedSight } from "./viewNavigation";

/**
 * North pavement of Reichpietschufer at Potsdamer Straße. Position is 15% along
 * the retained OSM footway way/1150243117 segment (EPSG:25833 converted to the
 * existing east/up/south frame), not an offset guessed from a road centreline.
 * The delivered paving polygon contains the point with 1.1127 m edge clearance;
 * the closest asphalt is 5.2955 m away. The retained terrain samples give Y5.2.
 * The view target is the represented south glass entrance, local [0, 25.2].
 * Heading/lens are presentation choices; no new tour stop or geometry is added.
 */
export const GALLERY_STARTUP_V220 = {
  landmarkName: "Neue Nationalgalerie",
  footwayId: "1150243117",
  footwaySegment: [
    [-249.47357766272034, 1383.4080051649362],
    [-276.8497492031893, 1382.744646041654],
  ],
  segmentFraction: .15,
  groundY: 5.2,
  // Match the tested 1.8 m pedestrian eye without eagerly importing the complete
  // navigation world into App's otherwise lightweight mode chooser bundle.
  position: [-253.58000339381397, 5.2 + 1.8, 1383.3085012966767],
  target: [-300.3015433816687, 9.82 + 1.8, 1343.2125348237075],
} as const;

/** Explicit place links retain their usual focus; all ordinary starts walk here. */
export function galleryStartupSelectionV220(
  landmarks: NamedSight[],
  hash = "",
): { name: string; automatic: boolean } {
  const explicit = findSightBySlug(landmarks, parseViewHash(hash).landmarkSlug);
  return explicit
    ? { name: explicit.name, automatic: false }
    : { name: GALLERY_STARTUP_V220.landmarkName, automatic: true };
}
