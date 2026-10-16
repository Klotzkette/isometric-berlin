import { DEFAULT_THREE_CAMERA_OFFSET } from "./resetView";
import { findSightBySlug, parseViewHash, type NamedSight } from "./viewNavigation";
import type { NavigationSnapshot } from "./navigationContinuity";

// Match the existing ordinary gallery focus: its catalogue anchor, the default
// orbit direction and 190 m focus distance with the usual 39° → 16° dolly.
// This seeds that same flight view before scene construction, without moving
// the requested gallery arrival back to the separate Reichstag reset view.
const target: [number, number, number] = [-305.13579248450696, 8, 1322.372333274223];
const distance = 190 * Math.tan(39 * Math.PI / 360) / Math.tan(16 * Math.PI / 360);
const offsetLength = Math.hypot(...DEFAULT_THREE_CAMERA_OFFSET);

export const GALLERY_FLIGHT_START_V223: Pick<NavigationSnapshot, "pose" | "fov"> & {
  landmarkName: string;
} = {
  landmarkName: "Neue Nationalgalerie",
  pose: {
    position: target.map((value, i) => value + DEFAULT_THREE_CAMERA_OFFSET[i] / offsetLength * distance) as [number, number, number],
    target,
  },
  fov: 16,
};

/** Ordinary entry floats above the gallery; explicit place links keep priority. */
export function startupViewSelection(landmarks: NamedSight[], hash = ""): {
  name: string;
  automatic: boolean;
} {
  const explicit = findSightBySlug(landmarks, parseViewHash(hash).landmarkSlug);
  return explicit
    ? { name: explicit.name, automatic: false }
    : { name: GALLERY_FLIGHT_START_V223.landmarkName, automatic: true };
}
