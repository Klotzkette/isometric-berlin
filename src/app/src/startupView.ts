import { DEFAULT_THREE_CAMERA_OFFSET } from "./resetView";
import { findSightBySlug, nextSimulationStartSight, parseViewHash, type NamedSight, type StartStorage } from "./viewNavigation";
import type { NavigationSnapshot } from "./navigationContinuity";
import { SIMULATION_START_VIEWS } from "./simulationStartViews";
import type { FocusCamera } from "./ArchitecturalLandmarks";

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

// Metadata only for the existing selection card and place links. These two
// represented buildings do not become extra entries in the 93-stop catalogue.
export const STARTUP_ONLY_SIGHTS = ["Kaiser-Wilhelm-Gedächtniskirche", "Rotes Rathaus"].map(name =>
  ({ name, role: "owner_added" }));

export function startupOnlySight(name: string) {
  return STARTUP_ONLY_SIGHTS.find(sight => sight.name === name) ?? null;
}

export type StartupFlightView = Pick<NavigationSnapshot, "pose" | "fov"> & { landmarkName: string };

/** Retain each established approach and its apparent framing at the ordinary
 * 16-degree flight lens. No pedestrian state is created or enabled. */
export function startupFlightView(name: string): StartupFlightView {
  if (name === GALLERY_FLIGHT_START_V223.landmarkName) return GALLERY_FLIGHT_START_V223;
  const view = SIMULATION_START_VIEWS[name];
  if (!view) return GALLERY_FLIGHT_START_V223;
  const scale = Math.tan(view.fov * Math.PI / 360) / Math.tan(16 * Math.PI / 360);
  return { landmarkName: name, fov: 16, pose: { target: [...view.target],
    position: view.target.map((value, i) => value + (view.position[i] - value) * scale) as [number, number, number] } };
}

/** The same flight pose for an explicit startup-only place link. */
export function startupFlightCamera(name: string): FocusCamera {
  const view = startupFlightView(name);
  const [x, y, z] = view.pose.position.map((value, i) => value - view.pose.target[i]);
  const distance = Math.hypot(x, y, z);
  return { target_world: [...view.pose.target], target_height_m: 0, distance_m: distance,
    azimuth_degrees: Math.atan2(x, z) * 180 / Math.PI,
    polar_degrees: Math.acos(y / distance) * 180 / Math.PI, fov_degrees: view.fov };
}

/** Resolve explicit places before advancing the once-per-launch rotation. */
export function startupViewSelection(landmarks: NamedSight[], hash = "", storage: StartStorage | null = null): {
  name: string;
  automatic: boolean;
} {
  const slug = parseViewHash(hash).landmarkSlug;
  const explicit = findSightBySlug(landmarks, slug) ?? findSightBySlug(STARTUP_ONLY_SIGHTS, slug);
  return explicit
    ? { name: explicit.name, automatic: false }
    : { name: nextSimulationStartSight(storage), automatic: true };
}
