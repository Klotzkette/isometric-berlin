import type { FocusCamera } from "./ArchitecturalLandmarks";
import { DEFAULT_THREE_CAMERA_OFFSET } from "./resetView";

type Point = readonly [number, number, number];
const galleryTarget: Point = [-305.13579248450696, 8, 1322.372333274223];

/** Physical opening poses, in the existing east/up/south viewer frame.
 * Targets follow the committed monument/building anchors. Camera positions
 * are presentation choices over their public approaches, not survey data.
 * An explicit lens prevents the general isometric dolly from moving the
 * camera off Washingtonplatz or Pariser Platz.
 */
export const SIMULATION_START_VIEWS: Record<string, {
  position: Point;
  target: Point;
  fov: number;
}> = {
  "Siegessäule": {
    position: [-1485, 75, 466],
    target: [-1459, 65, 456],
    fov: 31,
  },
  "Reichstagsgebäude": {
    position: [158, 74, 58],
    target: [317.729, 23, 40.477],
    fov: 39,
  },
  "Brandenburger Tor": {
    position: [522, 52, 319],
    target: [417.898, 17, 300.453],
    fov: 39,
  },
  "Bundeskanzleramt": {
    position: [-12, 55, -121],
    target: [-153.882, 20, -144.215],
    fov: 39,
  },
  "Berlin Hauptbahnhof": {
    position: [-60, 62, -530],
    target: [-86.48, 25, -599.79],
    fov: 39,
  },
  // Use the existing Philharmonie catalogue stop; the arrival itself is at
  // Serra's neighbouring, source-bound sculpture, without adding a tour stop.
  "Berliner Philharmonie": {
    position: [-184, 16, 960],
    target: [-201.017, 5.7, 932.914],
    fov: 39,
  },
  // Existing source anchors: old tower OSM way 15218373, and the retained
  // Rotes Rathaus clock-tower LoD2 centre. These are startup-only places,
  // not additions to the frozen 93-stop tour.
  "Kaiser-Wilhelm-Gedächtniskirche": {
    position: [-2620, 110, 1620],
    target: [-2495.572, 25, 1507.709],
    fov: 39,
  },
  "Rotes Rathaus": {
    position: [2610, 100, -10],
    target: [2495.891, 25, 99.061],
    fov: 39,
  },
  "Neue Nationalgalerie": {
    position: galleryTarget.map((value, i) => value +
      DEFAULT_THREE_CAMERA_OFFSET[i] / Math.hypot(...DEFAULT_THREE_CAMERA_OFFSET) * 190) as [number, number, number],
    target: galleryTarget,
    fov: 39,
  },
};

export function simulationStartLabel(name: string): string {
  return name === "Berliner Philharmonie" ? "Richard Serra · Berlin Junction" : name;
}

export function simulationStartCamera(name: string): FocusCamera | null {
  const view = SIMULATION_START_VIEWS[name];
  if (!view) return null;
  const [x, y, z] = view.position.map((value, i) => value - view.target[i]);
  const distance = Math.hypot(x, y, z);
  return {
    target_world: [...view.target],
    target_height_m: 0,
    distance_m: distance,
    azimuth_degrees: Math.atan2(x, z) * 180 / Math.PI,
    polar_degrees: Math.acos(y / distance) * 180 / Math.PI,
    fov_degrees: view.fov,
  };
}
